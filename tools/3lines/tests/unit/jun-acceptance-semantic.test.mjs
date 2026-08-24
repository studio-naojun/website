import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { APP_VERSION, MODEL_ID, summarize } from '../../src/summarizer.js';
import { composeThreeLines } from '../../src/composer.js';

const source = await readFile(new URL('../fixtures/jun-legaltech-72-20260824.txt', import.meta.url), 'utf8');
const normalizedSource = source.normalize('NFKC');

const priorBadPhrases = [
  '現時点の技術水準では適法な出力に影響を与えない形で実効的な制限範囲を明確化',
  '5については、「弁護士に代わる判断を提供するものである」',
];

test('Jun legaltech acceptance fixture identity is fixed', () => {
  assert.ok([...source].length > 5000);
  assert.equal(createHash('sha256').update(source).digest('hex'), '6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0');
  assert.match(normalizedSource, /ビジネス分野におけるAI等法務業務支援サービス提供と弁護士法第72条の関係について/u);
  assert.match(normalizedSource, /キモは法律事件の側にある「事件性」/u);
  assert.match(normalizedSource, /まとめ[:：]明日から何をするか/u);
});

test('style-focus route remains model-free and download-free', () => {
  assert.equal(APP_VERSION, '1.6.0');
  assert.equal(MODEL_ID, 'none');
});

test('gist is standalone for a reader who has not read the post', () => {
  const result = composeThreeLines(source, 'gist');
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every((item) => [...item].length <= 140));

  const joined = result.items.join(' ');
  assert.match(result.items[0], /^全体[:：]/u);
  assert.match(result.items[0], /AI法務支援サービス/u);
  assert.match(result.items[0], /弁護士法第?72条/u);
  assert.match(result.items[0], /法務業務/u);
  assert.match(result.items[0], /線引/u);
  assert.doesNotMatch(result.items[0], /AIに契約書を読ませていいのか問題/u);

  assert.match(result.items[1], /^肝[:：]/u);
  assert.match(result.items[1], /弁護士法第?72条/u);
  assert.match(result.items[1], /事件性/u);
  assert.match(result.items[1], /紛争性のある法律案件/u);
  assert.match(result.items[1], /使わせる前提で作らない/u);
  assert.match(result.items[1], /使われ方/u);

  assert.match(result.items[2], /^結局[:：]/u);
  assert.match(result.items[2], /AI法務支援サービス/u);
  assert.match(result.items[2], /リサーチ/u);
  assert.match(result.items[2], /書面/u);
  assert.match(result.items[2], /紛争/u);
  assert.match(result.items[2], /弁護士/u);
  assert.doesNotMatch(result.items[2], /セーフ7類型|グレー/u);

  for (const phrase of priorBadPhrases) assert.doesNotMatch(joined, new RegExp(phrase, 'u'));
});

test('technical shorthand is explained before it is used', () => {
  const items = composeThreeLines(source, 'gist').items;
  assert.match(items[1], /「事件性」とは、紛争性のある法律案件のこと/u);
  assert.doesNotMatch(items[2], /セーフ\d+類型/u);
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
    assert.ok(result.items.every((item) => [...item].length <= 140), style);
  }
});

test('points mode frames three standalone issues instead of copying source headings', async () => {
  const items = (await summarize({ text: source, style: 'points' })).items;
  assert.equal(items.length, 3);
  assert.match(items[0], /^論点1[|｜]/u);
  assert.match(items[0], /弁護士法第?72条/u);
  assert.match(items[0], /紛争性のある法律案件/u);
  assert.match(items[1], /^論点2[|｜]/u);
  assert.match(items[1], /提供側/u);
  assert.match(items[1], /向けに作らない/u);
  assert.match(items[1], /使われ方/u);
  assert.match(items[2], /^論点3[|｜]/u);
  assert.match(items[2], /どこまでAI/u);
  assert.match(items[2], /リサーチ/u);
  assert.match(items[2], /弁護士/u);
  assert.doesNotMatch(items.join(' '), /セーフの分水嶺|設計がセーフでも「用法」でアウト/u);
});

test('four styles have visibly different jobs, not label-only rewrites', async () => {
  const results = {};
  for (const style of ['gist', 'points', 'easy', 'faithful']) results[style] = (await summarize({ text: source, style })).items;
  assert.equal(new Set(Object.values(results).map((items) => JSON.stringify(items))).size, 4);

  assert.match(results.gist[0], /^全体[:：]/u);
  assert.match(results.gist[1], /^肝[:：]/u);
  assert.match(results.gist[2], /^結局[:：]/u);

  assert.match(results.points[0], /^論点1[|｜]/u);
  assert.match(results.points[1], /^論点2[|｜]/u);
  assert.match(results.points[2], /^論点3[|｜]/u);

  assert.match(results.easy[0], /^何の話[?？]/u);
  assert.match(results.easy[1], /^大事なのは、/u);
  assert.match(results.easy[2], /^つまり、/u);
  assert.doesNotMatch(results.easy.join(' '), /事件性|価値中立性|セーフ7類型/u);

  assert.match(results.faithful[0], /^全体[:：]/u);
  assert.match(results.faithful[0], /ビジネス分野におけるAI等法務業務支援サービス提供/u);
  assert.match(results.faithful[1], /^基準[:：]/u);
  assert.match(results.faithful[1], /事件性/u);
  assert.match(results.faithful[2], /^留保[:：]/u);
  assert.match(results.faithful[2], /認識・認容/u);
  assert.match(results.faithful[2], /評価され得る/u);
});
