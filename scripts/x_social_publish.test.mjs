import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {sealCredential} from './x_account_credentials.mjs';
import {run,verifyApproval,xWeight} from './x_social_publish.mjs';

const now=new Date('2026-11-01T08:20:00Z');
const env={NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'};
const account={markets:'naojun_markets',juken:'naojun_juken',security:'naojun_security'};
const response=(data,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(data)});
function candidate(channel='security'){
 const c={id:'social_20261101_security_01',selectionId:'gpt_20261101_17',account:channel,
  topicId:'vuln_mitigation',campaignId:'sg_0123456789abcdef',
  canonicalUrl:'https://naojun.jp/ai-dev/daily/2026-11-01/',
  approvedBy:'NINA',approvedAt:now.toISOString(),platform:'x'};
 const postUrl=c.canonicalUrl+'?utm_source=x&utm_medium=organic_social&utm_campaign='+c.campaignId;
 c.text='【セキュリティ】新しい対策手順を確認。適用対象と更新手順の原文を先に確認しましょう。\n'+postUrl;
 c.textSha256=createHash('sha256').update(c.text).digest('hex');
 return c;
}
async function fixture(channel='security'){
 const root=await mkdtemp(join(tmpdir(),'nina-social-x-'));
 await mkdir(join(root,'content'));
 await writeFile(join(root,'content/x-social-approved.json'),JSON.stringify({schemaVersion:1,status:'approved',candidate:candidate(channel)}));
 await writeFile(join(root,'content/x-social-state.json'),JSON.stringify({schemaVersion:1,published:[],uncertain:[]}));
 const accounts=Object.fromEntries(Object.entries(account).map(([_,handle])=>[handle,{
  username:handle,user_id:handle,updated_at:now.toISOString(),
  sealed:sealCredential({accessToken:'token',accessTokenSecret:'token-secret'},env.NAOJUN_X_API_SECRET,handle)
 }]));
 await writeFile(join(root,'content/x-account-credentials.enc.json'),JSON.stringify({
  schema_version:1,encryption:'aes-256-gcm-hkdf-sha256',accounts}));
 return root;
}
test('publisher ignores missing approval, unknown identity, tampering, and replies',async()=>{
 const c=candidate();
 assert.ok(verifyApproval({schemaVersion:1,status:'approved',candidate:c},now));
 for(const bad of [
  {...c,approvedBy:'Muse'}, {...c,account:'other'}, {...c,text:'altered'},
  {...c,canonicalUrl:'https://evil.example/'},
  {...c,text:'@stranger こんにちは'}, {...c,campaignId:'123'}]){
   assert.equal(verifyApproval({schemaVersion:1,status:'approved',candidate:bad},now),null);
 }
 assert.equal(verifyApproval({schemaVersion:1,status:'empty',candidate:c},now),null);
 assert.equal(verifyApproval({schemaVersion:1,status:'approved',candidate:c},
   new Date(now.getTime()+2*3600000+1)),null);
 assert.equal(xWeight('短'.repeat(140)+' https://naojun.jp/tools/3lines/?utm_campaign=sg_abc'),304);
});
test('CJK-heavy copy is rejected before any paid X request',async()=>{
 const root=await fixture();
 const raw=JSON.parse(await readFile(join(root,'content/x-social-approved.json'),'utf8'));
 const orig=raw.candidate.text;
 raw.candidate.text='あ'.repeat(150)+'\n\n'+orig.slice(orig.indexOf('https://'));
 raw.candidate.textSha256=createHash('sha256').update(raw.candidate.text).digest('hex');
 await writeFile(join(root,'content/x-social-approved.json'),JSON.stringify(raw));
 let requests=0;
 const result=await run({root,mode:'publish-one',now,env,fetchImpl:()=>{requests++;throw Error('unexpected')}});
 assert.equal(result.status,'no-valid-nina-approval');
 assert.equal(requests,0);
});
test('dry run never queries X and keeps approval untouched',async()=>{
 const root=await fixture();
 let requests=0;
 const out=await run({root,mode:'dry-run',now,env:{},fetchImpl:()=>{requests++;throw Error('unexpected')}})
 assert.equal(out.status,'dry-run');assert.equal(requests,0);
});
test('all 3 distinct accounts publish only after identity check and exactly once',async()=>{
 for(const kind of Object.keys(account)){
  const root=await fixture(kind),calls=[];
  const res=await run({root,mode:'publish-one',now,env,log:()=>{},fetchImpl:(url,opts)=>{
   calls.push(opts.method);
   if(url.endsWith('/users/me'))return response({data:{id:'42',username:account[kind]}});
   if(url.includes('/users/42/tweets'))return response({data:[]});
   return response({data:{id:'12345',text:JSON.parse(opts.body).text}},201);
  }});
  assert.deepEqual(calls,['GET','GET','POST']);assert.equal(res.status,'posted');
  assert.equal(res.receipt.xUrl,'https://x.com/'+account[kind]+'/status/12345');
  const again=await run({root,mode:'publish-one',now,env,fetchImpl:()=>{throw Error('duplicate network')}})
  assert.equal(again.status,'already-recorded');
 }
});
test('wrong account prevents POST',async()=>{
 const root=await fixture('markets'),calls=[];
 await assert.rejects(()=>run({root,mode:'publish-one',now,env,fetchImpl:(url,opts)=>{
   calls.push(opts.method);return response({data:{id:'42',username:'naojun_juken'}});
 }}),/wrong_x_identity/);
 assert.deepEqual(calls,['GET']);
});
test('uncertain POST outcome stops retries even if next run appears successful',async()=>{
 const root=await fixture('juken'),calls=[];
 const res=await run({root,mode:'publish-one',env,now,log:()=>{},fetchImpl:(url,opts)=>{
  calls.push(opts.method);
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_juken'}});
  if(opts.method==='POST')throw Error('timeout after possible send');
  return response({data:[]});
 }});
 assert.equal(res.status,'uncertain');
 assert.deepEqual(calls,['GET','GET','POST','GET']);
 const again=await run({root,mode:'publish-one',now,env,fetchImpl:()=>{throw Error('no retry allowed')}});
 assert.equal(again.status,'uncertain-pending');
});
test('prior URL/post reconciliation prevents rePOST',async()=>{
 const root=await fixture();
 const c=candidate();
 const url=c.canonicalUrl+'?utm_source=x';
 const res=await run({root,mode:'publish-one',env,now,fetchImpl:(endpoint,opts)=>{
  if(endpoint.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_security'}});
  return response({data:[{id:'already',text:'Existing',entities:{urls:[{expanded_url:c.canonicalUrl+'?utm_source=x&utm_medium=organic_social&utm_campaign='+c.campaignId}]}}]});
 }});
 assert.equal(res.status,'reconciled');
 assert.equal(res.receipt.xId,'already');
});
test('an older tweet of the same article without the same UTM does not reconcile',async()=>{
 const root=await fixture();
 const post=candidate();
 let requests=0;
 const result=await run({root,mode:'publish-one',env,now,log:()=>{},fetchImpl:(url,opts)=>{
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_security'}});
  if(opts.method==='POST'){requests++;return response({data:{id:'fresh'}},201);}
  return response({data:[{id:'old',text:'Old article text',entities:{
    urls:[{expanded_url:post.canonicalUrl+'?utm_source=x'}]}}]});
 }});
 assert.equal(result.status,'posted');
 assert.equal(result.receipt.xId,'fresh');
 assert.equal(requests,1);
});
test('definitive X 4xx never marks a post uncertain',async()=>{
 const root=await fixture();
 await assert.rejects(()=>run({root,mode:'publish-one',env,now,fetchImpl:(url,opts)=>{
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_security'}});
  if(opts.method==='POST')return response({title:'over quota'},429);
  return response({data:[]});
 }}),/X API HTTP 429/);
 const state=JSON.parse(await readFile(join(root,'content/x-social-state.json'),'utf8'));
 assert.deepEqual(state.uncertain,[]);
});
