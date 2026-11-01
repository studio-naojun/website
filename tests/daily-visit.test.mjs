import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const code=readFileSync(new URL('../assets/js/main.js',import.meta.url),'utf8');
function storage(map=new Map()){ return {getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map}; }
function visit({local=storage(),session=storage(),at='2026-10-30T14:59:00Z',navigator={},search='',host='naojun.jp'}={}){
 const requests=[];const NativeDate=Date;class FixedDate extends NativeDate{constructor(...args){super(...(args.length?args:[at]));} static now(){return NativeDate.parse(at);}}
 const nav={sendBeacon:(url,payload)=>{requests.push({url,data:Object.fromEntries(payload)});return true;},...navigator};
 const context={location:{hostname:host,pathname:'/',search},navigator:nav,document:{querySelectorAll:()=>[],querySelector:()=>null,referrer:'',addEventListener:()=>{}},sessionStorage:session,localStorage:local,URL,URLSearchParams,Date:FixedDate,fetch:()=>Promise.resolve({ok:true}),console};
 runInNewContext(code,context);return {requests,local,session};
}
const daily=out=>out.requests.filter(x=>x.data.action==='daily_visit');
test('one daily beacon over repeated pages; date-only storage',()=>{
 const local=storage();assert.equal(daily(visit({local})).length,1);assert.equal(daily(visit({local})).length,0);
 assert.equal(local.getItem('naojun-daily-visit-v1'),'2026-10-30');
 assert.equal(local.map.size,1);
});
test('JST midnight resets once; UTC midnight does not',()=>{
 const local=storage();visit({local,at:'2026-10-30T14:59:00Z'});
 assert.equal(daily(visit({local,at:'2026-10-30T15:00:00Z'})).length,1);
 assert.equal(daily(visit({local,at:'2026-10-31T00:00:00Z'})).length,0);
});
test('test browsers, opted-out visitors and QA campaigns do not create traffic',()=>{
 for(const options of [{navigator:{webdriver:true}},{navigator:{doNotTrack:'1'}},{search:'?utm_source=qa'},{search:'?utm_source=internal_test'},{host:'localhost'},{local:storage(new Map([['naojun-analytics-off','1']]))}]){
  assert.equal(visit(options).requests.length,0);
 }
});
test('unavailable local storage is unknown rather than a fresh person on every page',()=>{
 const local={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.equal(daily(visit({local})).length,0);
});
test('campaign attribution stays on the daily beacon; no visitor ID',()=>{
 const out=visit({search:'?utm_source=bluesky&utm_medium=organic_social&utm_campaign=ametsuta-play-20261030'});
 const event=daily(out)[0];assert.equal(event.data.source,'bluesky');assert.equal(event.data.campaign,'ametsuta-play-20261030');
 assert.deepEqual(Object.keys(event.data).sort(),['action','campaign','landing','medium','path','source']);
});

test('rejected Web Lock falls back to the existing date-only deduplication', async () => {
 const local=storage();
 const navigator={locks:{request:()=>Promise.reject(new Error('Web Lock unavailable'))}};
 const first=visit({local,navigator});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(daily(first).length,1);
 const repeat=visit({local,navigator});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(daily(repeat).length,0);
 assert.equal(local.getItem('naojun-daily-visit-v1'),'2026-10-30');
 assert.equal(local.map.size,1);
});
test('synchronous Web Lock error cannot suppress daily and campaign landing', () => {
 const navigator={locks:{request(){throw new Error('Lock API blocked');}}};
 const out=visit({navigator,search:'?utm_source=bluesky&utm_medium=organic_social&utm_campaign=demo'});
 assert.equal(daily(out).length,1);
 assert.equal(out.requests.filter(x=>x.data.action==='landing').length,1);
});
