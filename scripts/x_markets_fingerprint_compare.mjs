// One-time/read-only OAuth1 secret equality check.
// Compare SHA256 fingerprints inside GitHub Actions; NEVER print secrets, hashes, or fragments.
import {createHash, timingSafeEqual} from 'node:crypto';

export const FIELDS=[
  'NAOJUN_X_API_KEY',
  'NAOJUN_X_API_SECRET',
  'NAOJUN_X_ACCESS_TOKEN',
  'NAOJUN_X_ACCESS_TOKEN_SECRET'
];
export function compareAll(env=process.env) {
  const expected=env.X_EXPECT_SECRET_SHA256?.split(',')||[];
  if(expected.length!==FIELDS.length||expected.some(x=>!/^[a-f0-9]{64}$/.test(x))) throw new Error('Expected 4 SHA256 fingerprints; no comparisons attempted');
  const outcomes=FIELDS.map((name,i)=>{
    const value=env[name];
    if(typeof value!=='string'||value.length===0) throw new Error('Missing GitHub secret: '+name);
    const current=createHash('sha256').update(value,'utf8').digest();
    const expectedBytes=Buffer.from(expected[i],'hex');
    return timingSafeEqual(current,expectedBytes);
  });
  return Object.fromEntries(FIELDS.map((name,i)=>[name,outcomes[i]]));
}
if(import.meta.url===new URL('file://'+process.argv[1]?.replaceAll('\\','/')).href) {
  try {
    const results=compareAll();
    for(const [name,equal] of Object.entries(results)) console.log('X_CONSOLE_EQUALS_GITHUB '+name+': '+equal);
    const all=Object.values(results).every(Boolean);
    console.log('X_CONSOLE_EQUALS_GITHUB_ALL: '+all);
    if(!all) process.exitCode=1;
  }catch(e){
    console.error('FINGERPRINT_COMPARE_ERROR: '+String(e?.message||'Unable to compare').replace(/[a-f0-9]{64}/g,'[redacted]'));
    process.exitCode=1;
  }
}
