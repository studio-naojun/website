import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { APP_VERSION, MODEL_ID, summarize } from '../../src/summarizer.js';
import { composeThreeLines } from '../../src/composer.js';

const source = await readFile(new URL('../fixtures/jun-legaltech-72-20260824.txt', import.meta.url), 'utf8');

const priorBadPhrases = [
  '現時点の技術水準では適法な出力に影響を与えない形で実効的な制限範囲を明確化',
  '5については、「弁護士に代わる判断を提供するものである」',
];

test('Jun legaltech acceptance fixture identity is fixed', () => {
  assert.ok([...source].length > 5000);
  assert.equal(createHash('sha256').update(source).digest('hex'), '6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0');
  assert.match(source, /ポイント②：セーフの分水嶺は「価値中立性」/u);
  assert.match(source, /まとめ：明日から何をするか/u);
});

test('D3 semantic-ladder route is model-free and download-free', () => {
  assert.equal(APP_VERSION, '1.4.0');
  assert.equal(MODEL_ID, 'none');
});

test('gist is a semantic ladder: complete overview -> core thesis -> bottom line', () => {
  const result = composeThreeLines(source, 'gist');
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every((item) => [...item].length <= 120));

  const joined = result.items.join(' ');
  assert.match(result.items[0], /^全体[:：]/u);
  assert.match(result.items[0], /AIに契約書/u);
  assert.match(result.items[0], /法務省/u);
  assert.match(result.items[0], /弁護士法72条/u);
  assert.match(result.items[0], /線引/u);
  assert.match(result.items[0], /実務/u);

  assert.match(result.items[1], /^肝[:：]/u);
  assert.match(result.items[1], /価値中立/u);
  assert.match(result.items[1], /事件性/u);
  assert.match(result.items[1], /提供者/u);
  assert.match(result.items[1], /用法/u);
  assert.match(result.items[1], /アウト/u);

  assert.match(result.items[2], /^結局[:：]/u);
  assert.match(result.items[2], /言いたい/u);
  assert.match(result.items[2], /全面禁止/u);
  assert.match(result.items[2], /セーフ7類型/u);
  assert.match(result.items[2], /社内規程/u);
  assert.match(result.items[2], /弁護士/u);

  for (const phrase of priorBadPhrases) assert.doesNotMatch(joined, new RegExp(phrase, 'u'));
});

test('Jun fixture is stable across repeated gist runs', async () => {
  const first = await summarize({ text: source, style: 'gist' });
  const second = await summarize({ text: source, style: 'gist' });
  assert.deepEqual(first.items, second.items);
  assert.equal(first.engine, 'deterministic-semantic-composer');
  assert.equal(first.modelId, 'none');
});

test('all four styles return exactly three bounded semantic units without re-pasting', async () => {
  for (const style of ['gist', 'points', 'easy', 'faithful']) {
    const result = await summarize({ text: source, style });
    assert.equal(result.items.length, 3, style);
    assert.ok(result.items.every((item) => [...item].length <= 120), style);
  }
});

test('points mode is three real core points, not preface plus two points', async () => {
  const items = (await summarize({ text: source, style: 'points' })).items;
  assert.equal(items.length, 3);
  assert.match(items[0], /入力したのは利用者.*提供者は無関係/u);
  assert.match(items[1], /価値中立/u);
  assert.match(items[2], /用法.*アウト/u);
  assert.doesNotMatch(items.join(' '), /^前提/u);
});

test('non-points styles share the semantic ladder but materially change wording', async () => {
  const results = {};
  for (const style of ['gist', 'easy', 'faithful']) {
    results[style] = (await summarize({ text: source, style })).items;
  }

  const signatures = Object.values(results).map((items) => JSON.stringify(items));
  assert.equal(new Set(signatures).size, 3);

  for (const style of ['gist', 'easy', 'faithful']) {
    assert.match(results[style][0], /^全体[:：]/u, style);
    assert.ok(/^(?:肝|大事)[:：]/u.test(results[style][1]), style);
    assert.ok(/^(?:結局|つまり|結論)[:：]/u.test(results[style][2]), style);
  }

  assert.match(results.easy[0], /どこまでよいのか/u);
  assert.match(results.easy[1], /紛争案件/u);
  assert.match(results.easy[1], /使われ方/u);
  assert.match(results.easy[2], /全面禁止/u);

  const faithful = results.faithful.join(' ');
  assert.match(faithful, /価値中立的なサービス提供/u);
  assert.match(faithful, /提供者の行為.*評価され得る/u);
  assert.match(faithful, /用法/u);
  assert.match(faithful, /全面禁止/u);
  assert.doesNotMatch(faithful, /紛争案件向けに作らないこと/u);
});
