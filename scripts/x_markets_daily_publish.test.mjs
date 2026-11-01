import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyMarker, matchingDailyPosts, run, selectDailyCandidate, validateDailyEntry} from './x_markets_daily_publish.mjs';

const now = new Date('2026-11-02T00:10:00Z');
const entry = {
  id:'daily-2026-11-02',
  date:'2026-11-02',
  generated_at:'2026-11-02T08:55:00+09:00',
  data_as_of:'2026-11-02T08:50:00+09:00',
  text:'【11/2 朝の市場】\nS&P 500 +0.4% / Nasdaq +0.6% / 米10年 4.20% / USDJPY 153.2。米株は前営業日終値、為替は8:50 JST。今日は米雇用関連指標を確認。',
  sources:[
    {name:'Source A',url:'https://example.com/a'},
    {name:'Source B',url:'https://example.com/b'},
  ],
};

test('daily marker is date-specific', () => {
  assert.equal(dailyMarker(entry), '【11/2 朝の市場】');
});

test('valid same-day morning entry is selected once', () => {
  assert.equal(validateDailyEntry(entry, now).ok, true);
  assert.equal(selectDailyCandidate({entry}, {published:[]}, now).id, entry.id);
  assert.equal(selectDailyCandidate({entry}, {published:[{id:entry.id}]}, now), null);
});

test('stale or late entries do not publish', () => {
  assert.equal(selectDailyCandidate({entry}, {published:[]}, new Date('2026-11-03T00:10:00Z')), null);
  assert.equal(selectDailyCandidate({entry}, {published:[]}, new Date('2026-11-02T03:10:00Z')), null);
});

test('duplicate detection uses the unique date marker', () => {
  const rows = [{id:'x1',text:entry.text},{id:'x2',text:'unrelated'}];
  assert.equal(matchingDailyPosts(rows, entry).length, 1);
});

test('publish posts at most once and records receipt', async () => {
  const {mkdtemp, mkdir, writeFile, readFile} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const root = await mkdtemp(join(tmpdir(), 'markets-daily-'));
  await mkdir(join(root, 'content'), {recursive:true});
  await writeFile(join(root, 'content/x-markets-daily.json'), JSON.stringify({schema_version:1,entry}));
  await writeFile(join(root, 'content/x-markets-state.json'), JSON.stringify({schema_version:1,published:[]}));

  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push([url, init.method]);
    const payload = url.endsWith('/2/users/me')
      ? {data:{id:'u1',username:'naojun_markets'}}
      : url.includes('/tweets?')
        ? {data:[]}
        : {data:{id:'p1'}};
    return new Response(JSON.stringify(payload), {status:init.method === 'POST' ? 201 : 200});
  };

  const result = await run({
    mode:'publish-one',
    root,
    now,
    fetchImpl,
    env:{NAOJUN_X_API_KEY:'k',NAOJUN_X_API_SECRET:'s',NAOJUN_X_ACCESS_TOKEN:'t',NAOJUN_X_ACCESS_TOKEN_SECRET:'ts'},
    log:()=>{},
  });
  assert.equal(result.status, 'posted');
  assert.equal(calls.filter(([,method]) => method === 'POST').length, 1);
  const state = JSON.parse(await readFile(join(root, 'content/x-markets-state.json'), 'utf8'));
  assert.equal(state.published[0].id, entry.id);
  assert.equal(state.published[0].type, 'daily');
});
