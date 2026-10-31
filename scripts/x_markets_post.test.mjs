import test from 'node:test';
import assert from 'node:assert/strict';
import {enc,jstDay,testText,auth,run} from './x_markets_post.mjs';
const time=new Date('2026-10-30T16:00:00Z');
const c={key:'a',secret:'b',token:'c',tokenSecret:'d'};
const env={NAOJUN_X_API_KEY:'a',NAOJUN_X_API_SECRET:'b',NAOJUN_X_ACCESS_TOKEN:'c',NAOJUN_X_ACCESS_TOKEN_SECRET:'d'};
const response=(data,status=200)=>({ok:status<400,status,text:async()=>JSON.stringify(data)});
test('encoding and JST date boundary',()=>{
 assert.equal(enc("!'()*"),'%21%27%28%29%2A');
 assert.equal(jstDay(new Date('2026-10-30T14:59:59Z')),'2026-10-30');
 assert.equal(jstDay(new Date('2026-10-30T15:00:00Z')),'2026-10-31');
 assert.match(testText(time),/2026-10-31/);
});
test('OAuth signature deterministic and signs query',()=>{
 const opts={nonce:'abcd',timestamp:1793520000};
 const a=auth('GET','https://api.x.com/2/users/me',c,opts);
 assert.equal(a,auth('GET','https://api.x.com/2/users/me',c,opts));
 assert.notEqual(a,auth('GET','https://api.x.com/2/users/me?foo=1',c,opts));
 assert.match(a,/oauth_signature=/);
 assert.throws(()=>auth('GET','https://example.com/path',c),/origin/);
});
test('dry run never calls API',async()=>{
 const r=await run({mode:'dry-run',env:{},now:time,log:()=>{},fetchImpl:()=>{throw Error('network');}});
 assert.equal(r.status,'dry-run');
});
test('missing secrets fail before API call',async()=>{
 await assert.rejects(()=>run({mode:'publish-test',env:{},now:time,log:()=>{},fetchImpl:()=>{throw Error('network');}}),/credentials/);
});
test('multiline secrets are rejected before API calls',async()=>{
 let calls=0;
 const bad={...env,NAOJUN_X_API_SECRET:'first\nsecond'};
 await assert.rejects(()=>run({mode:'verify-only',env:bad,log:()=>{},fetchImpl:()=>{calls++;throw Error('called');}}),/Malformed X API secrets.*NAOJUN_X_API_SECRET/);
 assert.equal(calls,0);
});
test('duplicate consumer and user credentials are rejected before network requests',async()=>{
 for(const field of ['NAOJUN_X_ACCESS_TOKEN','NAOJUN_X_ACCESS_TOKEN_SECRET']){
   const replacement=field==='NAOJUN_X_ACCESS_TOKEN' ? 'NAOJUN_X_API_KEY' : 'NAOJUN_X_API_SECRET';
   const bad={...env,[field]:env[replacement]};
   let calls=0;
   await assert.rejects(()=>run({mode:'verify-only',env:bad,log:()=>{},fetchImpl:()=>{calls++;throw new Error('network called');}}),/GitHub Secrets mismatch/);
   assert.equal(calls,0);
 }
});
test('wrong account blocked',async()=>{
 let n=0;
 await assert.rejects(()=>run({mode:'publish-test',env,now:time,log:()=>{},fetchImpl:()=>{n++;return response({data:{id:'9',username:'naojunjp'}});}}),/Wrong X account/);
 assert.equal(n,1);
});
test('duplicate text on verified account skips POST',async()=>{
 let methods=[];
 const r=await run({mode:'publish-test',env,now:time,log:()=>{},fetchImpl:(url,opt)=>{
   methods.push(opt.method);
   return response(url.endsWith('/users/me')?{data:{id:'9',username:'naojun_markets'}}:{data:[{id:'42',text:testText(time)}]});
 }});
 assert.equal(r.status,'already-posted');assert.deepEqual(methods,['GET','GET']);
});
test('only one POST after preflight',async()=>{
 let methods=[];
 const r=await run({mode:'publish-test',env,now:time,log:()=>{},fetchImpl:(url,opt)=>{
   methods.push(opt.method);
   if (url.endsWith('/users/me')) return response({data:{id:'9',username:'naojun_markets'}});
   if (url.includes('/users/9/tweets')) return response({data:[]});
   return response({data:{id:'99',text:JSON.parse(opt.body).text}},201);
 }});
 assert.equal(r.url,'https://x.com/naojun_markets/status/99');assert.deepEqual(methods,['GET','GET','POST']);
});
test('read failures prevent POST',async()=>{
 await assert.rejects(()=>run({mode:'publish-test',env,now:time,log:()=>{},fetchImpl:url=>url.endsWith('/users/me')?response({data:{id:'9',username:'naojun_markets'}}):response({title:'Rate limited'},429)}),/HTTP 429/);
});
test('unknown mode rejected',async()=>{
 await assert.rejects(()=>run({mode:'publish',env,log:()=>{}}),/Unsupported mode/);
});
