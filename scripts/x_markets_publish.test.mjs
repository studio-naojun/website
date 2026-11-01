import test from 'node:test';
import assert from 'node:assert/strict';
import {makePost, matchingPosts, run, selectCandidate} from './x_markets_publish.mjs';
import {sealCredential} from './x_account_credentials.mjs';

const feed = {
  entries: [
    {id:'weekly-2026-10-31',type:'weekly',published_at:'2026-10-31',title:'週次タイトル',summary:'週次要約',path:'weekly/2026-10-31/'},
    {id:'monthly-2026-10',type:'monthly',published_at:'2026-10-31',title:'月次タイトル',summary:'月次要約',path:'monthly/2026-10/'},
    {id:'weekly-2026-10-24',type:'weekly',published_at:'2026-10-24',title:'古い記事',summary:'古い要約',path:'weekly/2026-10-24/'},
  ],
};

test('launch cutoff prevents historical backfill and preserves feed priority', () => {
  const state = {launch_cutoff:'2026-10-31',published:[]};
  assert.equal(selectCandidate(feed, state, new Date('2026-11-01T00:00:00Z')).id, 'weekly-2026-10-31');
});

test('published entry advances to next current candidate', () => {
  const state = {launch_cutoff:'2026-10-31',published:[{id:'weekly-2026-10-31'}]};
  assert.equal(selectCandidate(feed, state, new Date('2026-11-01T00:00:00Z')).id, 'monthly-2026-10');
});

test('post copy uses canonical investment URL and stays compact', () => {
  const post = makePost({
    title:'強い米GDPと粘着インフレ、AI投資の採算懸念――10月末の株・金利を読む',
    summary:'米GDP前期比年率+3.4%とCore PCE前年比+3.1%の併存、AI投資への市場評価、Fed・日銀の据え置きを一次資料で整理する。',
    path:'weekly/2026-10-31/',
  });
  assert.equal(post.url, 'https://naojun.jp/investment/weekly/2026-10-31/');
  assert.match(post.text, /^【NAOJUN Markets】/);
  assert.ok([...post.text].length < 180);
});

test('duplicate detection uses expanded URL instead of t.co-rendered text', () => {
  const rows = [{
    id:'p1',
    text:'【NAOJUN Markets】\n週次タイトル\n\n週次要約\n\nhttps://t.co/abc123',
    entities:{urls:[{url:'https://t.co/abc123',expanded_url:'https://naojun.jp/investment/weekly/2026-10-31/'}]},
  }];
  assert.equal(matchingPosts(rows, 'https://naojun.jp/investment/weekly/2026-10-31/').length, 1);
});

test('publish accepts successful X response with id but without echoed text', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([url, init.method]);
    const payload = url.endsWith('/2/users/me')
      ? {data:{id:'u1',username:'naojun_markets'}}
      : url.includes('/tweets?')
        ? {data:[]}
        : {data:{id:'p1',text:'https://t.co/shortened'}};
    return new Response(JSON.stringify(payload), {status: init.method === 'POST' ? 201 : 200});
  };
  const files = new Map([
    ['investment/feed.json', JSON.stringify(feed)],
    ['content/x-markets-state.json', JSON.stringify({schema_version:1,launch_cutoff:'2026-10-31',published:[]})],
  ]);
  const {mkdtemp, mkdir, writeFile, readFile} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'markets-publish-'));
  await mkdir(join(root, 'investment'), {recursive:true});
  await mkdir(join(root, 'content'), {recursive:true});
  for (const [path, body] of files) await writeFile(join(root, path), body);
  await writeFile(join(root,'content/x-account-credentials.enc.json'),JSON.stringify({
    schema_version:1,encryption:'aes-256-gcm-hkdf-sha256',
    accounts:{naojun_markets:{username:'naojun_markets',user_id:'u1',updated_at:'2026-11-01T00:00:00Z',sealed:sealCredential({accessToken:'t',accessTokenSecret:'ts'},'s','naojun_markets')}},
  }));
  const result = await run({
    mode:'publish-one',
    root,
    now:new Date('2026-11-01T00:00:00Z'),
    fetchImpl,
    env:{NAOJUN_X_API_KEY:'k',NAOJUN_X_API_SECRET:'s'},
    log:()=>{},
  });
  assert.equal(result.status, 'posted');
  assert.equal(result.id, 'p1');
  const state = JSON.parse(await readFile(join(root, 'content/x-markets-state.json'), 'utf8'));
  assert.equal(state.published[0].x_id, 'p1');
  assert.equal(calls.filter(([,method]) => method === 'POST').length, 1);
});
