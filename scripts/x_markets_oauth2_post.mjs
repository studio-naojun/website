// NAOJUN Markets - OAuth 2.0 user-context publisher.
// The access token is supplied at runtime by a trusted credential provider.
// Never log or store a token here. Default mode is dry-run (no API request).
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const X_API='https://api.x.com';
export const EXPECTED_HANDLE='naojun_markets';

export function jstDay(date=new Date()) {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return [p.year,p.month,p.day].join('-');
}
export function testText(date=new Date()) {
  return '【NAOJUN Markets／X API動作確認 '+jstDay(date)+'】\nこれは公式APIからの自動投稿テストです。市場データの定期配信はまだ開始していません。';
}

export async function apiRequest(method,path,accessToken,{body,fetchImpl=fetch}={}) {
  if(!accessToken || /\s/.test(accessToken)) throw new Error('Missing or malformed OAuth2 access token.');
  if(!path.startsWith('/2/') || path.startsWith('//')) throw new Error('Unexpected X API path.');
  const url=new URL(path,X_API);
  if(url.origin!==X_API) throw new Error('Unexpected API origin.');
  const response=await fetchImpl(url.toString(),{
    method,
    headers:{Authorization:'Bearer '+accessToken,...(body?{'Content-Type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{}),
    signal:AbortSignal.timeout(15000)
  });
  const raw=await response.text();
  let payload={};
  try { payload=raw?JSON.parse(raw):{}; }
  catch { throw new Error('X API non-JSON response: HTTP '+response.status); }
  if(!response.ok) throw new Error('X API HTTP '+response.status);
  return payload;
}

export async function run({mode=process.env.X_MARKETS_MODE||'dry-run',accessToken=process.env.NAOJUN_X_OAUTH2_ACCESS_TOKEN,now=new Date(),fetchImpl=fetch,log=console.log}={}) {
  if(!['dry-run','verify-only','publish-test'].includes(mode)) throw new Error('Unsupported OAuth2 test mode.');
  const text=testText(now);
  if(mode==='dry-run') { log('DRY RUN: no X API requests and no post.\n'+text); return {status:'dry-run',text}; }
  if(!accessToken) throw new Error('OAuth2 token not provided; no post attempted.');

  const me=await apiRequest('GET','/2/users/me',accessToken,{fetchImpl});
  if(!me.data?.id || me.data?.username?.toLowerCase()!==EXPECTED_HANDLE)
    throw new Error('X account identity does not match @'+EXPECTED_HANDLE+'; no post attempted.');
  if(mode==='verify-only') {
    log('OAUTH2 VERIFIED: @'+EXPECTED_HANDLE+'; no post sent.');
    return {status:'verified',username:me.data.username};
  }

  // Publishing is explicitly opt-in. Confirm the account and recent history first.
  const history=await apiRequest('GET','/2/users/'+encodeURIComponent(me.data.id)+'/tweets?max_results=20',accessToken,{fetchImpl});
  if(history.data!=null && !Array.isArray(history.data))
    throw new Error('Cannot verify existing posts; no new post attempted.');
  const old=(history.data||[]).find(x=>x.text===text);
  if(old?.id) {
    const url='https://x.com/'+EXPECTED_HANDLE+'/status/'+old.id;
    log('ALREADY POSTED: '+url);
    return {status:'already-posted',url,id:old.id};
  }

  // Never automatically retry after a request may have reached the API.
  const posted=await apiRequest('POST','/2/tweets',accessToken,{body:{text},fetchImpl});
  if(!posted.data?.id || posted.data.text!==text)
    throw new Error('Uncertain X post result; inspect the account before retrying.');
  const url='https://x.com/'+EXPECTED_HANDLE+'/status/'+posted.data.id;
  log('POSTED: '+url);
  return {status:'posted',url,id:posted.data.id};
}

if(process.argv[1] && fileURLToPath(import.meta.url)===resolve(process.argv[1]))
  run().catch(e=>{console.error('X OAuth2 test failed: '+e.message);process.exitCode=1;});
