/* NINA-only X publisher. No search, replies, reposts, scheduled discovery or new credentials. */
import {readFile,writeFile} from 'node:fs/promises';
import {constants,createCipheriv,createHash,publicEncrypt,randomBytes} from 'node:crypto';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadAccountCredentials} from './x_account_runtime.mjs';
import {xRequest} from './x_markets_post.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ACCOUNTS=Object.freeze({
  markets:'naojun_markets',juken:'naojun_juken',security:'naojun_security'
});
const POINTS=x=>[...String(x)];
const HEX=/^[a-f0-9]{64}$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{5,78}$/;
const CAMPAIGN=/^sg_[a-z0-9]{16,32}$/;
const RATE=Object.freeze({userRead:0.010,ownedPostRead:0.001,postCreateWithUrl:0.200});
const date=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
// Conservative X weighted length: CJK / astral characters weigh two,
// a URL occupies the fixed t.co length (23) even when very long.
export function xWeight(value){
  const parts=String(value).split(/(https?:\/\/\S+)/g);
  return parts.reduce((sum,part)=>{
    if(/^https?:\/\//.test(part))return sum+23;
    return sum+[...part].reduce((n,ch)=>{
      const point=ch.codePointAt(0);
      return n+(point>=0x1100||point<0x20&&point!==0x0a?2:1);
    },0);
  },0);
}
const readJson=async(path,fallback)=>{try{return JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}};
const roundUsd=value=>Math.round((Number(value)||0)*1e6)/1e6;
function billingTracker(now=new Date()){
  const rows=[],ownedPostIds=new Set();
  let observedCost=0,headerCoverage=true,remaining=null,remainingSequence=0,postCreateObserved=false,attemptCount=0;
  const attempt=()=>{attemptCount++;};
  const observe=event=>{
    const charged=event.creditsChargedUsd;
    if(charged==null)headerCoverage=false; else observedCost+=charged;
    if(event.creditsRemainingUsd!=null){remaining=event.creditsRemainingUsd;remainingSequence=attemptCount;}
    const path=String(event.path||'');
    if(event.method==='POST'&&path==='/2/tweets')postCreateObserved=true;
    if(event.method==='GET'&&/^\/2\/users\/[^/]+\/tweets\?/.test(path)){
      for(const item of Array.isArray(event.payload?.data)?event.payload.data:[]){
        if(item?.id)ownedPostIds.add(String(item.id));
      }
    }
    rows.push({method:event.method,path:path.replace(/\?.*$/,''),chargedUsd:charged});
  };
  const finish=({posted=false,postMayHaveSucceeded=false}={})=>{
    let estimate=RATE.userRead+ownedPostIds.size*RATE.ownedPostRead;
    if(posted||postMayHaveSucceeded)estimate+=RATE.postCreateWithUrl;
    const completeHeaders=headerCoverage&&rows.length&&(!postMayHaveSucceeded||postCreateObserved);
    const currentRemaining=remainingSequence===attemptCount?remaining:null;
    return {
      schemaVersion:1,
      costUsd:roundUsd(completeHeaders?observedCost:estimate),
      costMode:completeHeaders?'response_headers':'rate_estimate',
      remainingUsd:currentRemaining==null?null:roundUsd(currentRemaining),
      balanceMode:currentRemaining==null?'unavailable_no_extra_request':'response_header',
      observedAt:now.toISOString(),
      requestCount:attemptCount,
      postCreateObserved,
    };
  };
  return {attempt,observe,finish};
}
async function sealBilling(root,billing,receiptId,xId,log=()=>{}){
  let pem;
  try{pem=await readFile(resolve(root,'content/x-billing-public.pem'),'utf8');}
  catch(error){
    log('::warning::X billing public key unavailable; billing notification will be unavailable. code='+
      String(error?.code||error?.name||'error').slice(0,40));
    return null;
  }
  try{
    const aesKey=randomBytes(32),iv=randomBytes(12);
    const aad=Buffer.from('naojun-x-billing-v1|'+receiptId+'|'+xId);
    const cipher=createCipheriv('aes-256-gcm',aesKey,iv);
    cipher.setAAD(aad);
    const ciphertext=Buffer.concat([
      cipher.update(JSON.stringify(billing),'utf8'),
      cipher.final(),
    ]);
    const wrappedKey=publicEncrypt({
      key:pem,
      padding:constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash:'sha256',
    },aesKey);
    return {
      schemaVersion:1,
      alg:'RSA-OAEP-SHA256+A256GCM',
      wrappedKey:wrappedKey.toString('base64'),
      iv:iv.toString('base64'),
      tag:cipher.getAuthTag().toString('base64'),
      ciphertext:ciphertext.toString('base64'),
    };
  }catch(error){
    log('::warning::X billing envelope could not be sealed: '+String(error?.code||error?.name||'error').slice(0,80));
    return null;
  }
}
const cleanUrl=v=>{
  try{
    const x=new URL(v);
    if(x.protocol!=='https:'||x.hostname!=='naojun.jp'||x.username||x.password||x.hash)return null;
    if(!/^\/(?:investment|admissions|ai-dev|tools|works)\/[a-zA-Z0-9/_-]{1,170}\/$/.test(x.pathname))return null;
    return x;
  }catch{return null;}
};
export function verifyApproval(document,now=new Date()){
  if(!document||document.schemaVersion!==1||document.status!=='approved'||typeof document.candidate!=='object')return null;
  const c=document.candidate;
  if(!SLUG.test(c.id)||!SLUG.test(c.selectionId)||!Object.hasOwn(ACCOUNTS,c.account))return null;
  if(c.approvedBy!=='NINA'||!date(c.approvedAt)||c.platform!=='x')return null;
  if(now.getTime()-Date.parse(c.approvedAt)<-300000||now.getTime()-Date.parse(c.approvedAt)>2*3600000)return null;
  if(typeof c.topicId!=='string'||c.topicId.length>120)return null;
  if(typeof c.text!=='string'||!c.text.trim()||xWeight(c.text)>280||POINTS(c.text).length<25)return null;
  if(c.text.includes('@')||c.text.includes('#')||/\b(?:reply_to|in_reply_to_tweet_id)\b/i.test(c.text))return null;
  if(!HEX.test(c.textSha256)||createHash('sha256').update(c.text).digest('hex')!==c.textSha256)return null;
  const url=cleanUrl(c.canonicalUrl);
  if(!url||url.search||!CAMPAIGN.test(c.campaignId))return null;
  const utm=new URL(url);
  utm.searchParams.set('utm_source','x');
  utm.searchParams.set('utm_medium','organic_social');
  utm.searchParams.set('utm_campaign',c.campaignId);
  // UTM must be in the exact approved body. This prohibits publishers from
  // inventing a different destination after NINA's final decision.
  if(c.text.split(/https?:\/\/\S+/g).length!==2||!c.text.endsWith(utm.href))return null;
  if(!c.text.includes(utm.href))return null;
  return {...c,postUrl:utm.href,handle:ACCOUNTS[c.account]};
}
const asUrl=(row,source,campaign)=>{
  const wanted=source.replace(/[?#].*$/,'').replace(/\/$/,'');
  const expanded=(row?.entities?.urls||[]).flatMap(u=>[u.expanded_url,u.unwound_url]);
  return expanded.some(v=>{
    try{
      const u=new URL(v);
      return u.href.replace(/[?#].*$/,'').replace(/\/$/,'')===wanted
        &&u.searchParams.get('utm_source')==='x'
        &&u.searchParams.get('utm_medium')==='organic_social'
        &&u.searchParams.get('utm_campaign')===campaign;
    }catch{return false;}
  });
};
const once=(state,candidate,record)=>{
  const old=(state.published||[]).find(x=>x.id===candidate.id);
  if(old)return {status:'already-recorded',receipt:old};
  const unknown=(state.uncertain||[]).find(x=>x.id===candidate.id);
  if(unknown)return {status:'uncertain-pending',candidate:candidate.id};
  if((state.published||[]).some(x=>x.account===candidate.account&&
      (x.textSha256===candidate.textSha256||x.canonicalUrl===candidate.canonicalUrl)))
    return {status:'duplicate-blocked',candidate:candidate.id};
  if((state.uncertain||[]).some(x=>x.account===candidate.account))
    return {status:'uncertain-other-post',candidate:candidate.id};
  return null;
};
export async function run({mode=process.env.X_SOCIAL_MODE||'dry-run',env=process.env,root=ROOT,
    fetchImpl=fetch,now=new Date(),log=console.log}={}){
  if(!['dry-run','publish-one'].includes(mode))throw Error('invalid_social_mode');
  const approval=await readJson(resolve(root,'content/x-social-approved.json'),{});
  const candidate=verifyApproval(approval,now);
  if(!candidate)return {status:'no-valid-nina-approval'};
  const statePath=resolve(root,'content/x-social-state.json');
  const state=await readJson(statePath,{schemaVersion:1,published:[],uncertain:[]});
  if(state.schemaVersion!==1||!Array.isArray(state.published)||!Array.isArray(state.uncertain))throw Error('invalid_social_state');
  const prior=once(state,candidate);
  if(prior)return prior;
  if(mode==='dry-run')return {status:'dry-run',candidate:candidate.id,account:candidate.account,text:candidate.text};
  // Receipts and scheduling are owned by the existing GitHub publisher lane.
  // If a response was lost, an uncertain item stops further automatic POSTs.
  const creds=await loadAccountCredentials({target:candidate.handle,env,
    storePath:resolve(root,'content/x-account-credentials.enc.json')});
  const billing=billingTracker(now);
  const request=(method,path,options={})=>{
    billing.attempt();
    return xRequest(method,path,creds,{...options,fetchImpl,onResponse:billing.observe});
  };
  const me=await request('GET','/2/users/me');
  if(!me.data?.id||me.data?.username?.toLowerCase()!==candidate.handle)throw Error('wrong_x_identity');
  const recentUrl='/2/users/'+encodeURIComponent(me.data.id)+'/tweets?max_results=20&tweet.fields=entities';
  const recent=await request('GET',recentUrl);
  if(!Array.isArray(recent.data)&&recent.data!==undefined)throw Error('unverifiable_x_recent_posts');
  let matching=(recent.data||[]).find(row=>row.text===candidate.text||
    asUrl(row,candidate.canonicalUrl,candidate.campaignId));
  let id=matching?.id,status='reconciled';
  let postAttempted=false;
  if(!id){
    try{
      postAttempted=true;
      const posted=await request('POST','/2/tweets',{body:{text:candidate.text}});
      if(!posted.data?.id)throw Error('uncertain_x_post_response');
      id=posted.data.id;status='posted';
    }catch(error){
      // A received 4xx is a definite rejected request, not a potentially
      // committed tweet. Do not poison the durable uncertain-state ledger.
      const match=/X API HTTP (\d{3})\b/.exec(String(error?.message||''));
      if(match&&Number(match[1])>=400&&Number(match[1])<500)throw error;
      try{
        const after=await request('GET',recentUrl);
        matching=(after.data||[]).find(row=>row.text===candidate.text||
          asUrl(row,candidate.canonicalUrl,candidate.campaignId));
        id=matching?.id;
      }catch{id=null;}
      if(!id){
        state.uncertain.push({id:candidate.id,account:candidate.account,
          attemptedAt:now.toISOString(),canonicalUrl:candidate.canonicalUrl});
        await writeFile(statePath,JSON.stringify(state,null,2)+'\n','utf8');
        log('UNCERTAIN: X POST result cannot be determined, will never automatically repost.');
        return {status:'uncertain',candidate:candidate.id};
      }
    }
  }
  const billingReceipt=billing.finish({
    posted:status==='posted',
    postMayHaveSucceeded:postAttempted&&status==='reconciled'
  });
  const billingEnvelope=await sealBilling(root,billingReceipt,candidate.id,String(id),log);
  const receipt={id:candidate.id,selectionId:candidate.selectionId,account:candidate.account,
    topicId:candidate.topicId,campaignId:candidate.campaignId,textSha256:candidate.textSha256,
    canonicalUrl:candidate.canonicalUrl,xId:String(id),xUrl:'https://x.com/'+candidate.handle+'/status/'+id,
    publishedAt:now.toISOString(),status,...(billingEnvelope?{billingEnvelope}:{})};
  state.published.push(receipt);
  state.updatedAt=now.toISOString();
  await writeFile(statePath,JSON.stringify(state,null,2)+'\n','utf8');
  log('NINA VERIFIED POST: '+receipt.xUrl);
  return {status,candidate:candidate.id,receipt};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  run().then(x=>{console.log(JSON.stringify(x));if(x.status==='uncertain')process.exitCode=2;})
    .catch(e=>{console.error('NINA social publisher: '+e.message);process.exitCode=1;});
}
