import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sealCredential} from './x_account_credentials.mjs';
import {
  articleUrl,
  makePost,
  matchingPosts,
  runAll,
  runChannel,
  selectCandidate,
  validFeedEntry,
  waitUntilLive,
} from './x_editorial_publish.mjs';

const now=new Date('2026-11-02T05:00:00Z');
const admissions = {
  schema_version:1,
  entries:[
    {id:'weekly-new',published_at:'2026-11-02',title:'新しい中学受験記事',summary:'公開された新しい記事の要約です。',path:'weekly/2026-11-02/'},
    {id:'weekly-old',published_at:'2026-10-26',title:'既存記事',summary:'既存',path:'weekly/2026-10-26/'},
  ],
};
const security = {
  schema_version:1,
  entries:[
    {id:'daily-new',published_at:'2026-11-02',title:'新しいセキュリティ記事',summary:'重要な更新と対処を整理します。',path:'daily/2026-11-02/'},
    {id:'daily-old',published_at:'2026-11-01',title:'既存記事',summary:'既存',path:'daily/2026-11-01/'},
  ],
};

function state(){
  return {
    schema_version:1,
    channels:{
      juken:{baseline_ids:['weekly-old'],published:[],uncertain:[]},
      security:{baseline_ids:['daily-old'],published:[],uncertain:[]},
    },
  };
}

async function fixture(){
  const root=await mkdtemp(join(tmpdir(),'x-editorial-'));
  await mkdir(join(root,'admissions'),{recursive:true});
  await mkdir(join(root,'ai-dev'),{recursive:true});
  await mkdir(join(root,'content'),{recursive:true});
  await writeFile(join(root,'admissions/feed.json'),JSON.stringify(admissions));
  await writeFile(join(root,'ai-dev/feed.json'),JSON.stringify(security));
  await writeFile(join(root,'content/x-editorial-state.json'),JSON.stringify(state()));
  await writeFile(join(root,'content/x-account-credentials.enc.json'),JSON.stringify({
    schema_version:1,
    encryption:'aes-256-gcm-hkdf-sha256',
    accounts:{
      naojun_juken:{
        username:'naojun_juken',user_id:'j1',updated_at:'2026-11-01T00:00:00Z',
        sealed:sealCredential({accessToken:'jt',accessTokenSecret:'js'},'shared-secret','naojun_juken'),
      },
      naojun_security:{
        username:'naojun_security',user_id:'s1',updated_at:'2026-11-01T00:00:00Z',
        sealed:sealCredential({accessToken:'st',accessTokenSecret:'ss'},'shared-secret','naojun_security'),
      },
    },
  }));
  return root;
}

test('baseline entries never become candidates, but a new feed id does',()=>{
  assert.equal(selectCandidate('juken',admissions,state(),now).id,'weekly-new');
  const s=state();
  s.channels.juken.baseline_ids.push('weekly-new');
  assert.equal(selectCandidate('juken',admissions,s,now),null);
});

test('candidate validation rejects future or incomplete entries and oldest unseen wins',()=>{
  assert.equal(validFeedEntry('juken',admissions.entries[0],now),true);
  assert.equal(validFeedEntry('juken',{...admissions.entries[0],published_at:'2026-11-03'},now),false);
  assert.equal(validFeedEntry('juken',{...admissions.entries[0],summary:''},now),false);
  const feed={entries:[
    {...admissions.entries[0],id:'newer',published_at:'2026-11-02'},
    {...admissions.entries[0],id:'older',published_at:'2026-11-01',path:'weekly/2026-11-01/'},
  ]};
  assert.equal(selectCandidate('juken',feed,state(),now).id,'older');
});

test('article URL is channel-bound and post copy is compact',()=>{
  const url=articleUrl('security',security.entries[0]);
  assert.equal(url,'https://naojun.jp/ai-dev/daily/2026-11-02/');
  const post=makePost('security',{...security.entries[0],summary:'長い要約'.repeat(100)});
  assert.match(post.text,/^【AI・セキュリティ日報】/);
  assert.ok([...post.text].length<=260);
  assert.ok(post.text.endsWith(url));
  assert.throws(()=>articleUrl('security',{path:'../admissions/'}),/Invalid article path/);
});

test('duplicate detection uses expanded article URL',()=>{
  const url='https://naojun.jp/admissions/weekly/2026-11-01/';
  const rows=[{id:'x1',text:'https://t.co/a',entities:{urls:[{expanded_url:url}]}}];
  assert.equal(matchingPosts(rows,url).length,1);
});

test('live check retries boundedly and succeeds when Pages catches up',async()=>{
  let calls=0;
  const title='新しい中学受験記事';
  const url='https://naojun.jp/admissions/weekly/2026-11-02/';
  const fetchImpl=async requestUrl=>{
    calls++;
    const body=calls<3?'':`<link rel="canonical" href="${url}"><h1>${title}</h1>`;
    const response=new Response(body,{status:calls<3?404:200});
    Object.defineProperty(response,'url',{value:requestUrl});
    return response;
  };
  const ok=await waitUntilLive(url,{
    expectedTitle:title,
    fetchImpl,
    attempts:3,
    delayMs:0,
    requestTimeoutMs:100,
    sleep:async()=>{},
  });
  assert.equal(ok,true);
  assert.equal(calls,3);
});

test('live check rejects a redirect mismatch or wrong canonical page',async()=>{
  const url='https://naojun.jp/ai-dev/daily/2026-11-02/';
  const wrong=new Response('<link rel="canonical" href="https://naojun.jp/ai-dev/daily/other/"><h1>新しいセキュリティ記事</h1>',{status:200});
  Object.defineProperty(wrong,'url',{value:url});
  assert.equal(await waitUntilLive(url,{expectedTitle:'新しいセキュリティ記事',fetchImpl:async()=>wrong,attempts:1,requestTimeoutMs:100}),false);
  const redirected=new Response('<link rel="canonical" href="'+url+'"><h1>新しいセキュリティ記事</h1>',{status:200});
  Object.defineProperty(redirected,'url',{value:'https://naojun.jp/ai-dev/'});
  assert.equal(await waitUntilLive(url,{expectedTitle:'新しいセキュリティ記事',fetchImpl:async()=>redirected,attempts:1,requestTimeoutMs:100}),false);
});

test('dry-run makes no public or X request',async()=>{
  const root=await fixture();
  const result=await runChannel({
    channel:'juken',
    mode:'dry-run',
    root,
    now,
    fetchImpl:()=>{throw new Error('network called');},
    log:()=>{},
  });
  assert.equal(result.status,'dry-run');
});

test('JUKEN publishes once, verifies account, and records receipt',async()=>{
  const root=await fixture();
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push([url,init?.method||'GET']);
    if(url.startsWith('https://naojun.jp/')){
      const response=new Response('<link rel="canonical" href="'+url+'"><h1>新しい中学受験記事</h1>',{status:200});
      Object.defineProperty(response,'url',{value:url});
      return response;
    }
    if(url.endsWith('/2/users/me')) return new Response(JSON.stringify({data:{id:'j1',username:'naojun_juken'}}),{status:200});
    if(url.includes('/tweets?')) return new Response(JSON.stringify({data:[]}),{status:200});
    return new Response(JSON.stringify({data:{id:'p1'}}),{status:201});
  };
  const result=await runChannel({
    channel:'juken',
    root,
    now,
    fetchImpl,
    env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},
    liveDelayMs:0,
    sleep:async()=>{},
    log:()=>{},
  });
  assert.equal(result.status,'posted');
  assert.equal(calls.filter(([,method])=>method==='POST').length,1);
  const saved=JSON.parse(await readFile(join(root,'content/x-editorial-state.json'),'utf8'));
  assert.equal(saved.channels.juken.published[0].id,'weekly-new');
  assert.equal(selectCandidate('juken',admissions,saved,now),null);
});

test('matching existing article URL reconciles without POST',async()=>{
  const root=await fixture();
  let postCalls=0;
  const target='https://naojun.jp/admissions/weekly/2026-11-02/';
  const fetchImpl=async(url,init)=>{
    if(url.startsWith('https://naojun.jp/')){
      const response=new Response('<link rel="canonical" href="'+target+'"><h1>新しい中学受験記事</h1>',{status:200});
      Object.defineProperty(response,'url',{value:url});
      return response;
    }
    if(url.endsWith('/2/users/me')) return new Response(JSON.stringify({data:{id:'j1',username:'naojun_juken'}}),{status:200});
    if(url.includes('/tweets?')) return new Response(JSON.stringify({data:[{id:'existing',text:'https://t.co/x',entities:{urls:[{expanded_url:target}]}}]}),{status:200});
    if(init?.method==='POST') postCalls++;
    throw new Error('unexpected request');
  };
  const result=await runChannel({channel:'juken',root,now,fetchImpl,env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},sleep:async()=>{},liveDelayMs:0,log:()=>{}});
  assert.equal(result.status,'reconciled');
  assert.equal(postCalls,0);
});

test('wrong SECURITY account aborts before POST',async()=>{
  const root=await fixture();
  let posts=0;
  const fetchImpl=async(url,init)=>{
    if(url.startsWith('https://naojun.jp/')){
      const response=new Response('<link rel="canonical" href="'+url+'"><h1>新しいセキュリティ記事</h1>',{status:200});
      Object.defineProperty(response,'url',{value:url});
      return response;
    }
    if(init?.method==='POST') posts++;
    return new Response(JSON.stringify({data:{id:'m1',username:'naojun_markets'}}),{status:200});
  };
  await assert.rejects(
    ()=>runChannel({
      channel:'security',
      root,
      now,
      fetchImpl,
      env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},
      liveDelayMs:0,
      sleep:async()=>{},
      log:()=>{},
    }),
    /expected @naojun_security/,
  );
  assert.equal(posts,0);
});

test('ambiguous POST is reconciled by article URL without a second POST',async()=>{
  const root=await fixture();
  let postCalls=0;
  let historyCalls=0;
  const target='https://naojun.jp/ai-dev/daily/2026-11-02/';
  const fetchImpl=async(url,init)=>{
    if(url.startsWith('https://naojun.jp/')){
      const response=new Response('<link rel="canonical" href="'+target+'"><h1>新しいセキュリティ記事</h1>',{status:200});
      Object.defineProperty(response,'url',{value:url});
      return response;
    }
    if(url.endsWith('/2/users/me')) return new Response(JSON.stringify({data:{id:'s1',username:'naojun_security'}}),{status:200});
    if(url.includes('/tweets?')){
      historyCalls++;
      const data=historyCalls===1?[]:[{id:'recovered',text:'https://t.co/z',entities:{urls:[{expanded_url:target}]}}];
      return new Response(JSON.stringify({data}),{status:200});
    }
    postCalls++;
    return new Response(JSON.stringify({title:'temporary failure'}),{status:503});
  };
  const result=await runChannel({
    channel:'security',
    root,
    now,
    fetchImpl,
    env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},
    liveDelayMs:0,
    reconcileDelayMs:0,
    sleep:async()=>{},
    log:()=>{},
  });
  assert.equal(result.status,'reconciled');
  assert.equal(postCalls,1);
  assert.equal(historyCalls,2);
});

test('unreconciled POST becomes uncertain and future runs never re-POST',async()=>{
  const root=await fixture();
  let postCalls=0;
  const target='https://naojun.jp/ai-dev/daily/2026-11-02/';
  const fetchImpl=async(url,init)=>{
    if(url.startsWith('https://naojun.jp/')){
      const response=new Response('<link rel="canonical" href="'+target+'"><h1>新しいセキュリティ記事</h1>',{status:200});
      Object.defineProperty(response,'url',{value:url});
      return response;
    }
    if(url.endsWith('/2/users/me')) return new Response(JSON.stringify({data:{id:'s1',username:'naojun_security'}}),{status:200});
    if(url.includes('/tweets?')) return new Response(JSON.stringify({data:[]}),{status:200});
    if(init?.method==='POST'){
      postCalls++;
      return new Response(JSON.stringify({title:'temporary failure'}),{status:503});
    }
    throw new Error('unexpected request');
  };
  const first=await runChannel({channel:'security',root,now,fetchImpl,env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},sleep:async()=>{},liveDelayMs:0,reconcileDelayMs:0,log:()=>{}});
  assert.equal(first.status,'uncertain');
  assert.equal(postCalls,1);
  const saved=JSON.parse(await readFile(join(root,'content/x-editorial-state.json'),'utf8'));
  assert.equal(saved.channels.security.uncertain[0].id,'daily-new');
  const second=await runChannel({channel:'security',root,now,fetchImpl,env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},sleep:async()=>{},liveDelayMs:0,reconcileDelayMs:0,log:()=>{}});
  assert.equal(second.status,'uncertain-pending');
  assert.equal(postCalls,1);
});

test('failed reconciliation GET still stores uncertain before any future run',async()=>{
  const root=await fixture();
  let postCalls=0;
  let historyCalls=0;
  const target='https://naojun.jp/ai-dev/daily/2026-11-02/';
  const fetchImpl=async(url,init)=>{
    if(url.startsWith('https://naojun.jp/')){
      const response=new Response('<link rel="canonical" href="'+target+'"><h1>新しいセキュリティ記事</h1>',{status:200});
      Object.defineProperty(response,'url',{value:url});
      return response;
    }
    if(url.endsWith('/2/users/me')) return new Response(JSON.stringify({data:{id:'s1',username:'naojun_security'}}),{status:200});
    if(url.includes('/tweets?')){
      historyCalls++;
      if(historyCalls===1) return new Response(JSON.stringify({data:[]}),{status:200});
      return new Response(JSON.stringify({title:'rate limited'}),{status:429});
    }
    if(init?.method==='POST'){
      postCalls++;
      return new Response(JSON.stringify({title:'temporary failure'}),{status:503});
    }
    throw new Error('unexpected request');
  };
  const result=await runChannel({channel:'security',root,now,fetchImpl,env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},sleep:async()=>{},liveDelayMs:0,reconcileDelayMs:0,log:()=>{}});
  assert.equal(result.status,'uncertain');
  assert.equal(postCalls,1);
  const saved=JSON.parse(await readFile(join(root,'content/x-editorial-state.json'),'utf8'));
  assert.equal(saved.channels.security.uncertain[0].id,'daily-new');
});

test('receipt already present means a correction run makes no network call',async()=>{
  const root=await fixture();
  const saved=JSON.parse(await readFile(join(root,'content/x-editorial-state.json'),'utf8'));
  saved.channels.juken.published.push({id:'weekly-new',article_url:'https://naojun.jp/admissions/weekly/2026-11-02/',x_id:'p',x_url:'https://x.com/naojun_juken/status/p',posted_at:now.toISOString(),status:'posted'});
  await writeFile(join(root,'content/x-editorial-state.json'),JSON.stringify(saved));
  const result=await runChannel({channel:'juken',root,now,fetchImpl:()=>{throw new Error('network called');},env:{},log:()=>{}});
  assert.equal(result.status,'up-to-date');
});

test('article not live waits for hourly recovery without loading X credentials',async()=>{
  const root=await fixture();
  const seen=[];
  const result=await runChannel({
    channel:'juken',root,now,liveAttempts:2,liveDelayMs:0,liveRequestTimeoutMs:100,sleep:async()=>{},log:()=>{},
    env:{},
    fetchImpl:async(url)=>{
      seen.push(url);
      const response=new Response('',{status:404});
      Object.defineProperty(response,'url',{value:url});
      return response;
    },
  });
  assert.equal(result.status,'waiting-live');
  assert.equal(seen.length,2);
  assert.ok(seen.every(url=>url.startsWith('https://naojun.jp/')));
});

test('runAll continues to the other channel while one channel waits for live deployment',async()=>{
  const root=await fixture();
  const targetSecurity='https://naojun.jp/ai-dev/daily/2026-11-02/';
  const calls=[];
  const fetchImpl=async(url,init)=>{
    calls.push(url);
    if(url.includes('/admissions/')) throw new Error('juken live check failed');
    if(url.startsWith('https://naojun.jp/')){
      const response=new Response('<link rel="canonical" href="'+targetSecurity+'"><h1>新しいセキュリティ記事</h1>',{status:200});
      Object.defineProperty(response,'url',{value:url});
      return response;
    }
    if(url.endsWith('/2/users/me')) return new Response(JSON.stringify({data:{id:'s1',username:'naojun_security'}}),{status:200});
    if(url.includes('/tweets?')) return new Response(JSON.stringify({data:[{id:'s-existing',text:'https://t.co/s',entities:{urls:[{expanded_url:targetSecurity}]}}]}),{status:200});
    throw new Error('unexpected request');
  };
  const results=await runAll({root,now,liveAttempts:1,liveDelayMs:0,liveRequestTimeoutMs:100,sleep:async()=>{},fetchImpl,env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},log:()=>{}});
  assert.equal(results.find(row=>row.channel==='juken').status,'waiting-live');
  assert.equal(results.find(row=>row.channel==='security').status,'reconciled');
  assert.ok(calls.some(url=>url.includes('/ai-dev/')));
});
