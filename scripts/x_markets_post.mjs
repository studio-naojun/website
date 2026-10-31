// Official X API single-post test only. No licensed market-data content or recurring scheduler.
import {createHmac, randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const HOST = 'https://api.x.com';
const HANDLE = 'naojun_markets';
export const enc = x => encodeURIComponent(String(x)).replace(/[!'()*]/g, x => '%' + x.charCodeAt(0).toString(16).toUpperCase());
export function jstDay(date = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type, x.value]));
  return p.year + '-' + p.month + '-' + p.day;
}
export function testText(date = new Date()) {
  return '【NAOJUN Markets／X API動作確認 ' + jstDay(date) + '】\nこれは公式APIからの自動投稿テストです。市場データの定期配信はまだ開始していません。';
}
export function auth(method, endpoint, c, options={}) {
  for (const k of ['key', 'secret', 'token', 'tokenSecret']) if (!c[k]) throw new Error('Missing X API credentials (four NAOJUN_X_* secrets required).');
  const u = new URL(endpoint);
  if (u.origin !== HOST || u.protocol !== 'https:') throw new Error('Unexpected API origin.');
  const o = {oauth_consumer_key:c.key, oauth_nonce:options.nonce ?? randomBytes(16).toString('hex'), oauth_signature_method:'HMAC-SHA1', oauth_timestamp:String(options.timestamp ?? Math.floor(Date.now()/1000)), oauth_token:c.token, oauth_version:'1.0'};
  const pairs = [...u.searchParams, ...Object.entries(o)].map(([k,v])=>[enc(k),enc(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0);
  const normalized = pairs.map(([k,v])=>k+'='+v).join('&');
  const base = [method.toUpperCase(),enc(u.origin+u.pathname),enc(normalized)].join('&');
  const key = enc(c.secret)+'&'+enc(c.tokenSecret);
  o.oauth_signature = createHmac('sha1',key).update(base).digest('base64');
  return 'OAuth ' + Object.entries(o).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>enc(k)+'="'+enc(v)+'"').join(', ');
}
export async function xRequest(method,path,creds,{body,fetchImpl=fetch}={}) {
  const url = HOST+path;
  const response = await fetchImpl(url,{method,headers:{Authorization:auth(method,url,creds),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});
  const raw = await response.text();
  let payload;
  try {payload=raw?JSON.parse(raw):{};} catch {throw new Error('X API unreadable response: HTTP '+response.status);}
  if (!response.ok) throw new Error('X API HTTP '+response.status+': '+String(payload.title||payload.detail||payload.message||'Request failed').slice(0,120));
  return payload;
}
export async function run({mode=process.env.X_POST_MODE||'dry-run',env=process.env,now=new Date(),fetchImpl=fetch,log=console.log}={}) {
  if (!['dry-run','publish-test'].includes(mode)) throw new Error('Unsupported mode.');
  const text=testText(now);
  if (mode==='dry-run') {log('DRY RUN: no API request or public post.\n'+text);return {status:'dry-run',text};}
  const creds={key:env.NAOJUN_X_API_KEY,secret:env.NAOJUN_X_API_SECRET,token:env.NAOJUN_X_ACCESS_TOKEN,tokenSecret:env.NAOJUN_X_ACCESS_TOKEN_SECRET};
  auth('GET',HOST+'/2/users/me',creds);
  const me=await xRequest('GET','/2/users/me',creds,{fetchImpl});
  if (!me.data?.id || me.data.username?.toLowerCase()!==HANDLE) throw new Error('Wrong X account; expected @'+HANDLE+'. Aborting.');
  const recent=await xRequest('GET','/2/users/'+encodeURIComponent(me.data.id)+'/tweets?max_results=20',creds,{fetchImpl});
  if (recent.data!=null&&!Array.isArray(recent.data)) throw new Error('Unverifiable recent posts; aborting.');
  const old=(recent.data||[]).find(p=>p.text===text);
  if (old) {log('ALREADY POSTED: https://x.com/'+HANDLE+'/status/'+old.id);return {status:'already-posted',id:old.id};}
  // No automatic retry after an uncertain POST outcome.
  const result=await xRequest('POST','/2/tweets',creds,{body:{text},fetchImpl});
  if (!result.data?.id||result.data.text!==text) throw new Error('Uncertain POST response; inspect account before retrying.');
  const url='https://x.com/'+HANDLE+'/status/'+result.data.id;
  log('POSTED: '+url);
  return {status:'posted',url,id:result.data.id};
}
if (process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])) run().catch(e=>{console.error('X test failed: '+e.message);process.exitCode=1;});
