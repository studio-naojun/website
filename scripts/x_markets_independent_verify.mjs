// Independent read-only OAuth 1.0a verification using a maintained X API client.
// This is a diagnostic only: no posting, no token storage and no secret logging.
import {TwitterApi} from 'twitter-api-v2';

const required=[
  'NAOJUN_X_API_KEY','NAOJUN_X_API_SECRET',
  'NAOJUN_X_ACCESS_TOKEN','NAOJUN_X_ACCESS_TOKEN_SECRET'
];
const values=required.map(n=>process.env[n]);
if(values.some(x=>typeof x!=='string'||x.length===0||/[\r\n]/.test(x))) {
  throw new Error('Missing or multiline X API credentials');
}
const [appKey,appSecret,accessToken,accessSecret]=values;
const client=new TwitterApi({appKey,appSecret,accessToken,accessSecret});
try {
  const result=await client.v2.me();
  const ok=result?.data?.username?.toLowerCase()==='naojun_markets';
  console.log('INDEPENDENT OAuth1 user authentication: HTTP 200');
  console.log('Verified account matches @naojun_markets: '+ok);
  if(!ok) process.exitCode=1;
} catch(e) {
  // Never stringify or log a library exception: it may contain request metadata.
  const http=Number.isInteger(e?.code)?e.code:(Number.isInteger(e?.status)?e.status:0);
  const codes=Array.isArray(e?.data?.errors)?e.data.errors.map(x=>x?.code).filter(Number.isInteger).slice(0,3):[];
  console.error('INDEPENDENT OAuth1 authentication failed; HTTP '+(http||'unknown'));
  if(codes.length) console.error('X numeric error codes: '+codes.join(','));
  process.exitCode=1;
}
