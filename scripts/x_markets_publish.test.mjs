import test from 'node:test';
import assert from 'node:assert/strict';
import {makePost, selectCandidate} from './x_markets_publish.mjs';

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
