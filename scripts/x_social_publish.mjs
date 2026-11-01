/* NINA-only X publisher. No search, replies, reposts, scheduled discovery or new credentials. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
  const me=await xRequest('GET','/2/users/me',creds,{fetchImpl});
  if(!me.data?.id||me.data?.username?.toLowerCase()!==candidate.handle)throw Error('wrong_x_identity');
  const recentUrl='/2/users/'+encodeURIComponent(me.data.id)+'/tweets?max_results=20&tweet.fields=entities';
  const recent=await xRequest('GET',recentUrl,creds,{fetchImpl});
  if(!Array.isArray(recent.data)&&recent.data!==undefined)throw Error('unverifiable_x_recent_posts');
  let matching=(recent.data||[]).find(row=>row.text===candidate.text||
    asUrl(row,candidate.canonicalUrl,candidate.campaignId));
  let id=matching?.id,status='reconciled';
  if(!id){
    try{
      const posted=await xRequest('POST','/2/tweets',creds,{body:{text:candidate.text},fetchImpl});
      if(!posted.data?.id)throw Error('uncertain_x_post_response');
      id=posted.data.id;status='posted';
    }catch(error){
      // A received 4xx is a definite rejected request, not a potentially
      // committed tweet. Do not poison the durable uncertain-state ledger.
      const match=/X API HTTP (\d{3})\b/.exec(String(error?.message||''));
      if(match&&Number(match[1])>=400&&Number(match[1])<500)throw error;
      try{
        const after=await xRequest('GET',recentUrl,creds,{fetchImpl});
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
  const receipt={id:candidate.id,selectionId:candidate.selectionId,account:candidate.account,
    topicId:candidate.topicId,campaignId:candidate.campaignId,textSha256:candidate.textSha256,
    canonicalUrl:candidate.canonicalUrl,xId:String(id),xUrl:'https://x.com/'+candidate.handle+'/status/'+id,
    publishedAt:now.toISOString(),status};
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
