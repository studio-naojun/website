// Read-only authentication diagnostics. No credential, token, response body or authorization header is logged.
// OAuth2 app-only exchange is used solely to validate the Consumer Key / Consumer Secret pair.
import {auth,enc} from './x_markets_post.mjs';

const HOST = 'https://api.x.com';
const NAMES = [
  'NAOJUN_X_API_KEY',
  'NAOJUN_X_API_SECRET',
  'NAOJUN_X_ACCESS_TOKEN',
  'NAOJUN_X_ACCESS_TOKEN_SECRET',
];

export async function diagnose({env=process.env,fetchImpl=fetch,log=console.log}={}) {
  const values=NAMES.map(name => env[name]);
  if (values.some(value => !value)) throw new Error('One or more GitHub Secrets are missing');
  const [key,secret,token,tokenSecret]=values;
  const creds={key,secret,token,tokenSecret};
  log('Credential presence: all four provided; values withheld');
  log('Credential formatting: ' + (
    values.some(value => value.trim() !== value) ? 'leading/trailing whitespace detected' : 'no leading/trailing whitespace'
  ));

  const basic=Buffer.from(enc(key)+':'+enc(secret),'utf8').toString('base64');
  const appResp=await fetchImpl(HOST+'/oauth2/token',{
    method:'POST',
    headers:{Authorization:'Basic '+basic,'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
    body:'grant_type=client_credentials',
    signal:AbortSignal.timeout(15000),
  });
  // Parse only error-code metadata; never log the bearer token, response body, or arbitrary errors.
  const appRaw=await appResp.text();
  let appBody={};
  if (!appResp.ok) {
    try {appBody=JSON.parse(appRaw);} catch {}
  }
  log('App-only Consumer Key/Secret exchange: HTTP '+appResp.status);
  const appCode=Array.isArray(appBody?.errors) ? appBody.errors.map(e=>e?.code).find(Number.isInteger) : undefined;
  if (appCode!==undefined) log('App-only X error numeric code: '+appCode);
  const allowedAppReasons=['invalid_client','client-not-enrolled','client-forbidden','unsupported_authentication','invalid_grant'];
  if (allowedAppReasons.includes(appBody?.error)) log('App-only X error category: '+appBody.error);
  if (allowedAppReasons.includes(appBody?.reason)) log('App-only X reason: '+appBody.reason);

  const userUrl=HOST+'/2/users/me';
  const userResp=await fetchImpl(userUrl,{
    method:'GET',
    headers:{Authorization:auth('GET',userUrl,creds)},
    signal:AbortSignal.timeout(15000),
  });
  const raw=await userResp.text();
  log('OAuth1 user authentication: HTTP '+userResp.status);
  if (userResp.ok) {
    let payload;
    try {payload=JSON.parse(raw);} catch {throw new Error('Unexpected user response');}
    log('User identity matches @naojun_markets: '+(payload?.data?.username?.toLowerCase()==='naojun_markets'));
  } else {
    // Only fixed diagnostic categories; never print arbitrary response text.
    let body={};
    try {body=JSON.parse(raw);} catch {}
    const code=Array.isArray(body?.errors) ? body.errors.map(e=>e?.code).find(x=>Number.isInteger(x)) : undefined;
    if (code!==undefined) log('X error numeric code: '+code);
    const known=['invalid_client','invalid_grant','unauthorized_client','invalid_token','expired_token'];
    if (known.includes(body?.error)) log('X error category: '+body.error);
  }
  if (appResp.status===200 && userResp.status===401)
    log('DIAGNOSIS: Consumer Key/Secret pair is accepted; OAuth1 user token pair or signature/app association is rejected.');
  else if ((appResp.status===401 || (appResp.status===403 && appCode===99)) && userResp.status===401)
    log('DIAGNOSIS: App credential exchange rejected as invalid; Consumer Key/Secret pair or app identity is the first suspect.');
  else
    log('DIAGNOSIS: review both independent HTTP statuses; no posting attempted.');
  return {appStatus:appResp.status,userStatus:userResp.status};
}

if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1].replaceAll('\\','/')).href)
  diagnose().catch(e=>{console.error('Authentication probe failed: '+e.name); process.exitCode=1;});
