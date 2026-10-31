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

function diagnosticCategory(raw) {
  let body;
  try { body=JSON.parse(raw); } catch { return 'non-json-response'; }
  const result=[];
  const codes=Array.isArray(body?.errors) ? body.errors.map(e=>e?.code).filter(Number.isInteger) : [];
  if (codes.length) result.push('x-codes='+codes.slice(0,3).join(','));
  const categories=new Set([
    'invalid_client','invalid_grant','unauthorized_client','invalid_token','expired_token',
    'authentication_failure','authenticity_token_error',
    'client-not-enrolled','client-forbidden','user-not-enrolled',
    'not-authorized-for-resource','invalid-credentials','usage-capped',
    'CreditsDepleted','insufficient-credits'
  ]);
  for (const value of [body?.error,body?.reason,body?.errors?.[0]?.label]) {
    if (categories.has(value)) result.push('category='+value);
  }
  const note=[body?.detail,body?.message,body?.errors?.[0]?.message].filter(x=>typeof x==='string').join(' ');
  if (/unable to verify your credentials/i.test(note)) result.push('message=credentials-not-verified');
  else if (/not enrolled|attached to a project/i.test(note)) result.push('message=app-not-enrolled');
  else if (/no credits|credits depleted|insufficient credits/i.test(note)) result.push('message=credits-depleted');
  else if (/rate limit|too many requests/i.test(note)) result.push('message=rate-limit');
  const type=body?.type;
  if (typeof type==='string') {
    const suffix=type.match(/^https:\/\/api\.(?:x|twitter)\.com\/2\/problems\/([a-z-]{1,60})$/)?.[1];
    if (suffix) result.push('problem-type='+suffix);
  }
  return result.join('; ')||'generic-error';
}

export async function diagnose({env=process.env,fetchImpl=fetch,log=console.log}={}) {
  const values=NAMES.map(name => env[name]);
  if (values.some(value => !value)) throw new Error('One or more GitHub Secrets are missing');
  const [key,secret,token,tokenSecret]=values;
  const creds={key,secret,token,tokenSecret};
  log('Credential presence: all four provided; values withheld');
  // Compare only shape and length against the newly issued X Developer Console pair.
  // Never display credential values, prefixes, suffixes, or hashes.
  log('Access Token X-console format match: '+(token.length===50 && /^\d+-[A-Za-z0-9_-]+$/.test(token)));
  log('Access Token Secret X-console length/form match: '+(tokenSecret.length===45 && /^[A-Za-z0-9_-]+$/.test(tokenSecret)));

  if (env.X_EXPECT_API_KEY_SUFFIX) {
    const expected=String(env.X_EXPECT_API_KEY_SUFFIX);
    if (!/^[A-Za-z0-9_-]{4,12}$/.test(expected)) throw new Error('Unexpected expected Consumer Key suffix format');
    log('Publisher Consumer Key suffix matches GitHub Secret: '+key.endsWith(expected));
  }

  log('Per-secret newline flags (values withheld):');
  for (let i=0;i<NAMES.length;i++) {
    const value=values[i];
    log('  '+NAMES[i]+': newline='+/[\r\n]/.test(value)+
        '; lineCount='+value.split(/\r\n|\r|\n/).length+
        '; surrounding-spaces='+(value!==value.trim()));
  }

  log('Credential structure: embedded-newline='+values.some(v=>/[\r\n]/.test(v))+
      '; surrounding-quotes='+values.some(v=>/^['"]|['"]$/.test(v))+
      '; duplicate-values='+(new Set(values).size !== values.length));
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
  if (!userResp.ok) log('OAuth1 diagnostic: '+diagnosticCategory(raw));
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
  if (values.some(v=>/[\r\n]/.test(v))) {
    // Diagnostic only: never persist or log the normalized keys.
    const cleaned=values.map(v=>v.replace(/[\r\n]/g,''));
    const [cleanKey,cleanSecret,cleanToken,cleanTokenSecret]=cleaned;
    const cleanBasic=Buffer.from(enc(cleanKey)+':'+enc(cleanSecret),'utf8').toString('base64');
    const altApp=await fetchImpl(HOST+'/oauth2/token',{
      method:'POST',
      headers:{Authorization:'Basic '+cleanBasic,'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
      body:'grant_type=client_credentials',
      signal:AbortSignal.timeout(15000),
    });
    await altApp.text(); // Never log the token or response.
    log('App-only exchange with internal CR/LF removed in memory: HTTP '+altApp.status);
    const cleanAuth=auth('GET',userUrl,{key:cleanKey,secret:cleanSecret,token:cleanToken,tokenSecret:cleanTokenSecret});
    const altUser=await fetchImpl(userUrl,{
      method:'GET',headers:{Authorization:cleanAuth},signal:AbortSignal.timeout(15000),
    });
    const altText=await altUser.text();
    log('OAuth1 with internal CR/LF removed in memory: HTTP '+altUser.status);
    if (altUser.ok) {
      let cleanMe={};
      try { cleanMe=JSON.parse(altText); } catch {}
      log('Corrected OAuth1 username matches: '+(cleanMe?.data?.username?.toLowerCase()==='naojun_markets'));
    }
  }
  if (values.some(v=>/[\r\n]/.test(v))) {
    const segments=values.map(v=>v.split(/\r\n|\r|\n/).filter(Boolean));
    const lineChoices=segments.map(lines=>lines.length>1?lines.slice(0,2):lines);
    // Never log a credential, candidate, Authorization header, response body, or bearer token.
    // At most two app-only exchanges; stop early if a pairing succeeds.
    let appMatch=null;
    for (let i=0;i<lineChoices[1].length;i++) {
      const basicCandidate=Buffer.from(enc(lineChoices[0][0])+':'+enc(lineChoices[1][i]),'utf8').toString('base64');
      const resp=await fetchImpl(HOST+'/oauth2/token',{
        method:'POST',
        headers:{Authorization:'Basic '+basicCandidate,'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},
        body:'grant_type=client_credentials',signal:AbortSignal.timeout(15000),
      });
      await resp.text();
      log('App-only with API_SECRET segment '+(i+1)+': HTTP '+resp.status);
      if (resp.ok) {appMatch=i;break;}
    }
    // At most eight read-only user authentication requests across possible two-line selections.
    // This is diagnostic only and never alters credentials or sends posts.
    const candidates=[];
    for (let i=0;i<lineChoices[1].length;i++) {
      if (appMatch!==null && i!==appMatch) continue;
      for (let j=0;j<lineChoices[2].length;j++) {
        for (let k=0;k<lineChoices[3].length;k++) candidates.push([i,j,k]);
      }
    }
    let matched=false;
    for (const [i,j,k] of candidates.slice(0,8)) {
      const trial={
        key:lineChoices[0][0],
        secret:lineChoices[1][i],
        token:lineChoices[2][j],
        tokenSecret:lineChoices[3][k],
      };
      const resp=await fetchImpl(userUrl,{
        method:'GET',
        headers:{Authorization:auth('GET',userUrl,trial)},
        signal:AbortSignal.timeout(15000),
      });
      const rawTrial=await resp.text();
      if (resp.ok) {
        let data={};
        try {data=JSON.parse(rawTrial);} catch {}
        log('VALID COMBINATION: API_SECRET segment='+(i+1)+
          '; ACCESS_TOKEN segment='+(j+1)+'; ACCESS_TOKEN_SECRET segment='+(k+1)+
          '; correct_account='+(data?.data?.username?.toLowerCase()==='naojun_markets'));
        matched=true;break;
      }
    }
    if (!matched) log('No valid OAuth1 pair among '+Math.min(8,candidates.length)+' newline-separated combinations.');
  }
  if (appResp.status===200 && userResp.status===401)
    log('DIAGNOSIS: Consumer Key/Secret pair is accepted; OAuth1 user token pair or signature/app association is rejected.');
  else if ((appResp.status===401 || (appResp.status===403 && appCode===99)) && userResp.status===401)
    log('DIAGNOSIS: App credential exchange rejected as invalid; Consumer Key/Secret pair or app identity is the first suspect.');
  else
    log('DIAGNOSIS: review both independent HTTP statuses; no posting attempted.');
  if (userResp.status !== 200) throw new Error('OAuth1 authentication not verified; see safe diagnostic statuses above.');
  return {appStatus:appResp.status,userStatus:userResp.status};
}

if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1].replaceAll('\\','/')).href)
  diagnose().catch(e=>{console.error('Authentication probe failed: '+e.name); process.exitCode=1;});
