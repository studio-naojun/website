import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {constants,createDecipheriv,createHash,generateKeyPairSync,privateDecrypt} from 'node:crypto';
import {sealCredential} from './x_account_credentials.mjs';
import {run,verifyApproval,xWeight} from './x_social_publish.mjs';

const now=new Date('2026-11-01T08:20:00Z');
const env={NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'};
const account={markets:'naojun_markets',juken:'naojun_juken',security:'naojun_security'};
const billingKeys=generateKeyPairSync('rsa',{
 modulusLength:2048,
 publicKeyEncoding:{type:'spki',format:'pem'},
 privateKeyEncoding:{type:'pkcs8',format:'pem'},
});
const response=(data,status=200,headers={})=>({ok:status<400,status,
 headers:{get:name=>headers[String(name).toLowerCase()]??null},
 text:async()=>JSON.stringify(data)});
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
 await writeFile(join(root,'content/x-billing-public.pem'),billingKeys.publicKey);
 const accounts=Object.fromEntries(Object.entries(account).map(([_,handle])=>[handle,{
  username:handle,user_id:handle,updated_at:now.toISOString(),
  sealed:sealCredential({accessToken:'token',accessTokenSecret:'token-secret'},env.NAOJUN_X_API_SECRET,handle)
 }]));
 await writeFile(join(root,'content/x-account-credentials.enc.json'),JSON.stringify({
  schema_version:1,encryption:'aes-256-gcm-hkdf-sha256',accounts}));
 return root;
}
function openBilling(receipt){
 const envelope=receipt.billingEnvelope;
 assert.equal(envelope.alg,'RSA-OAEP-SHA256+A256GCM');
 const key=privateDecrypt({
  key:billingKeys.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'
 },Buffer.from(envelope.wrappedKey,'base64'));
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));
 decipher.setAAD(Buffer.from('naojun-x-billing-v1|'+receipt.id+'|'+receipt.xId));
 decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
 return JSON.parse(Buffer.concat([
  decipher.update(Buffer.from(envelope.ciphertext,'base64')),
  decipher.final(),
 ]).toString('utf8'));
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
test('publisher records response-header cost and remaining credit without an extra X request',async()=>{
 const root=await fixture('markets'),calls=[];
 const res=await run({root,mode:'publish-one',now,env,log:()=>{},fetchImpl:(url,opts)=>{
  calls.push(opts.method);
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_markets'}},200,
   {'x-credits-charged':'0.010','x-credits-remaining':'9.990'});
  if(url.includes('/users/42/tweets'))return response({data:[]},200,
   {'x-credits-charged':'0','x-credits-remaining':'9.990'});
  return response({data:{id:'12345',text:JSON.parse(opts.body).text}},201,
   {'x-credits-charged':'0.200','x-credits-remaining':'9.790'});
 }});
 assert.deepEqual(calls,['GET','GET','POST']);
 const billing=openBilling(res.receipt);
 assert.equal(res.receipt.billing,undefined);
 assert.equal(billing.costMode,'response_headers');
 assert.equal(billing.costUsd,0.21);
 assert.equal(billing.remainingUsd,9.79);
 assert.equal(billing.balanceMode,'response_header');
 assert.equal(billing.requestCount,3);
 const publicState=await readFile(join(root,'content/x-social-state.json'),'utf8');
 assert.equal(publicState.includes('"remainingUsd"'),false);
 assert.equal(publicState.includes('"costUsd"'),false);
});
test('publisher falls back to official-rate estimate without making a balance request',async()=>{
 const root=await fixture('security'),calls=[];
 const res=await run({root,mode:'publish-one',now,env,log:()=>{},fetchImpl:(url,opts)=>{
  calls.push(new URL(url).pathname);
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_security'}});
  if(url.includes('/users/42/tweets'))return response({data:[{id:'old1',text:'unrelated'}]});
  return response({data:{id:'new1',text:JSON.parse(opts.body).text}},201);
 }});
 assert.deepEqual(calls,['/2/users/me','/2/users/42/tweets','/2/tweets']);
 const billing=openBilling(res.receipt);
 assert.equal(billing.costMode,'rate_estimate');
 assert.equal(billing.costUsd,0.211);
 assert.equal(billing.remainingUsd,null);
 assert.equal(billing.balanceMode,'unavailable_no_extra_request');
});
test('ambiguous POST can never be labelled exact when the POST response was not observed',async()=>{
 const root=await fixture('security');
 let recentCalls=0;
 const res=await run({root,mode:'publish-one',now,env,log:()=>{},fetchImpl:(url,opts)=>{
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_security'}},200,
   {'x-credits-charged':'0.010','x-credits-remaining':'9.990'});
  if(url.includes('/users/42/tweets')){
   recentCalls++;
   return response({data:recentCalls===1?[]:[{id:'after-timeout',text:candidate('security').text}]},200,
    {'x-credits-charged':'0','x-credits-remaining':'9.790'});
  }
  throw Error('timeout after possible send');
 }});
 assert.equal(res.status,'reconciled');
 const billing=openBilling(res.receipt);
 assert.equal(billing.costMode,'rate_estimate');
 assert.equal(billing.costUsd,0.211);
 assert.equal(billing.remainingUsd,9.79);
 assert.equal(billing.requestCount,4);
});
test('remaining credit from before a POST is discarded when the POST omits a remaining header',async()=>{
 const root=await fixture('markets');
 const res=await run({root,mode:'publish-one',now,env,log:()=>{},fetchImpl:(url,opts)=>{
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_markets'}},200,
   {'x-credits-charged':'0.010','x-credits-remaining':'9.990'});
  if(url.includes('/users/42/tweets'))return response({data:[]},200,
   {'x-credits-charged':'0','x-credits-remaining':'9.990'});
  return response({data:{id:'12345',text:JSON.parse(opts.body).text}},201,
   {'x-credits-charged':'0.200'});
 }});
 const billing=openBilling(res.receipt);
 assert.equal(billing.costMode,'response_headers');
 assert.equal(billing.remainingUsd,null);
 assert.equal(billing.balanceMode,'unavailable_no_extra_request');
});
test('missing billing public key never loses a successful X receipt',async()=>{
 const root=await fixture('markets');
 await rm(join(root,'content/x-billing-public.pem'));
 const logs=[];
 const res=await run({root,mode:'publish-one',now,env,log:x=>logs.push(x),fetchImpl:(url,opts)=>{
  if(url.endsWith('/users/me'))return response({data:{id:'42',username:'naojun_markets'}});
  if(url.includes('/users/42/tweets'))return response({data:[]});
  return response({data:{id:'12345',text:JSON.parse(opts.body).text}},201);
 }});
 assert.equal(res.status,'posted');
 assert.equal(res.receipt.billingEnvelope,undefined);
 assert.ok(logs.some(x=>x.includes('billing public key unavailable')));
 const state=JSON.parse(await readFile(join(root,'content/x-social-state.json'),'utf8'));
 assert.equal(state.published[0].xId,'12345');
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
