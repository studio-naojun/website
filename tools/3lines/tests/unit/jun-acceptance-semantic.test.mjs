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
  assert.match(normalizedSource, /まとめ：明日から何をするか/u);
});

test('body-grounded semantic route remains model-free and download-free', () => {
  assert.equal(APP_VERSION, '1.5.0');
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

test('points mode is three real core points', async () => {
  const items = (await summarize({ text: source, style: 'points' })).items;
  assert.equal(items.length, 3);
  assert.match(items[0], /入力したのは利用者.*提供者は無関係/u);
  assert.match(items[1], /価値中立/u);
  assert.match(items[2], /用法.*アウト/u);
});

test('non-points styles preserve the same meaning ladder with different wording', async () => {
  const results = {};
  for (const style of ['gist', 'easy', 'faithful']) results[style] = (await summarize({ text: source, style })).items;
  assert.equal(new Set(Object.values(results).map((items) => JSON.stringify(items))).size, 3);

  for (const style of ['gist', 'easy', 'faithful']) {
    assert.match(results[style][0], /^全体[:：]/u, style);
    assert.ok(/^(?:肝|大事)[:：]/u.test(results[style][1]), style);
    assert.ok(/^(?:結局|つまり|結論)[:：]/u.test(results[style][2]), style);
    assert.doesNotMatch(results[style][2], /セーフ7類型/u, style);
  }

  assert.match(results.easy[0], /AIを使う法務支援サービス/u);
  assert.match(results.easy[1], /紛争性のある法律案件/u);
  assert.match(results.easy[2], /裁判所に出す書面/u);

  const faithful = results.faithful.join(' ');
  assert.match(faithful, /ビジネス分野におけるAI等法務業務支援サービス提供と弁護士法第72条の関係について/u);
  assert.match(faithful, /事件性/u);
  assert.match(faithful, /用法・運用実態/u);
});
