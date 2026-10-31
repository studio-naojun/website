import test from 'node:test';
import assert from 'node:assert/strict';
import { jstDay,testText,run } from './x_markets_oauth2_post.mjs';

const TIME=new Date('2026-10-31T03:00:00.000Z');
const TOKEN='fake-oauth2-token';
const me={data:{id:'12345',username:'naojun_markets'}};
function response(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
}
test('JST preview uses correct day',()=>{
  assert.equal(jstDay(TIME),'2026-10-31');
  assert.match(testText(TIME),/2026-10-31/);
});
test('dry-run never calls X API',async()=>{
  let calls=0;
  const result=await run({mode:'dry-run',now:TIME,log:()=>{},fetchImpl:()=>{calls++;throw Error('network called');}});
  assert.equal(result.status,'dry-run');
  assert.equal(calls,0);
});
test('verify-only refuses missing token',async()=>{
  await assert.rejects(()=>run({mode:'verify-only',accessToken:'',log:()=>{},fetchImpl:()=>{throw Error('network called');}}),/OAuth2 token not provided/);
});
test('verify-only checks expected X account without posting',async()=>{
  const calls=[];
  const result=await run({mode:'verify-only',accessToken:TOKEN,log:()=>{},fetchImpl:(url,opts)=>{
    calls.push({url,method:opts.method,auth:opts.headers.Authorization});
    return response(me);
  }});
  assert.equal(result.status,'verified');
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'GET');
  assert.equal(calls[0].auth,'Bearer '+TOKEN);
});
test('wrong account is blocked before checking history or posting',async()=>{
  let calls=0;
  await assert.rejects(()=>run({mode:'publish-test',accessToken:TOKEN,log:()=>{},fetchImpl:()=>{
    calls++; return response({data:{id:'12345',username:'other_account'}});
  }}),/does not match/);
  assert.equal(calls,1);
});
test('duplicate test post is skipped',async()=>{
  const calls=[];
  const result=await run({mode:'publish-test',accessToken:TOKEN,now:TIME,log:()=>{},fetchImpl:(url,opts)=>{
    calls.push(opts.method);
    return response(calls.length===1?me:{data:[{id:'77',text:testText(TIME)}]});
  }});
  assert.equal(result.status,'already-posted');
  assert.deepEqual(calls,['GET','GET']);
});
test('unverifiable history prevents a new post',async()=>{
  const calls=[];
  await assert.rejects(()=>run({mode:'publish-test',accessToken:TOKEN,log:()=>{},fetchImpl:(url,opts)=>{
    calls.push(opts.method);
    return calls.length===1?response(me):response({errors:[{message:'failed'}]},403);
  }}),/X API HTTP 403/);
  assert.deepEqual(calls,['GET','GET']);
});
test('one explicit test post only after account and history verified',async()=>{
  const methods=[];
  const result=await run({mode:'publish-test',accessToken:TOKEN,now:TIME,log:()=>{},fetchImpl:(url,opts)=>{
    methods.push(opts.method);
    if(methods.length===1)return response(me);
    if(methods.length===2)return response({meta:{result_count:0}});
    assert.equal(opts.headers.Authorization,'Bearer '+TOKEN);
    assert.equal(JSON.parse(opts.body).text,testText(TIME));
    return response({data:{id:'88',text:testText(TIME)}});
  }});
  assert.equal(result.status,'posted');
  assert.deepEqual(methods,['GET','GET','POST']);
});
test('failed publish request is never retried',async()=>{
  const methods=[];
  await assert.rejects(()=>run({mode:'publish-test',accessToken:TOKEN,log:()=>{},fetchImpl:(url,opts)=>{
    methods.push(opts.method);
    return methods.length===1?response(me):methods.length===2?response({meta:{result_count:0}}):response({error:'denied'},403);
  }}),/X API HTTP 403/);
  assert.deepEqual(methods,['GET','GET','POST']);
});
test('unknown mode is rejected before any request',async()=>{
  await assert.rejects(()=>run({mode:'unrecognized',accessToken:TOKEN,log:()=>{},fetchImpl:()=>{throw Error('network called');}}),/Unsupported/);
});
