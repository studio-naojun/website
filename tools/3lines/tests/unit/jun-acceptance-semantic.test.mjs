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

test('D3 final route is model-free and download-free', () => {
  assert.equal(APP_VERSION, '1.3.0');
  assert.equal(MODEL_ID, 'none');
});

test('Jun fixture produces a standalone topic / explained boundary / action gist', () => {
  const result = composeThreeLines(source, 'gist');
  assert.equal(result.items.length, 3);
  assert.ok(result.items.every((item) => [...item].length <= 120));

  const joined = result.items.join(' ');
  assert.match(result.items[0], /法務省/u);
  assert.match(result.items[0], /弁護士法72条/u);
  assert.match(result.items[0], /線引/u);
  assert.match(result.items[1], /価値中立/u);
  assert.match(result.items[1], /事件性/u);
  assert.match(result.items[1], /目指さない設計/u);
  assert.match(result.items[1], /用法/u);
  assert.match(result.items[1], /アウト/u);
  assert.match(result.items[2], /(?:紛争|裁判所)/u);
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

test('structured styles are materially distinct, not three labels over the same result', async () => {
  const results = {};
  for (const style of ['gist', 'points', 'easy', 'faithful']) {
    results[style] = (await summarize({ text: source, style })).items;
  }

  const signatures = Object.values(results).map((items) => JSON.stringify(items));
  assert.equal(new Set(signatures).size, 4);
  assert.notDeepEqual(results.gist, results.easy);
  assert.notDeepEqual(results.gist, results.faithful);
  assert.notDeepEqual(results.easy, results.faithful);

  assert.match(results.easy[0], /どこまでならよいか/u);
  assert.match(results.easy[1], /かんたんに/u);
  assert.match(results.easy[1], /使われ方/u);
  assert.match(results.easy[2], /使う側/u);

  const faithful = results.faithful.join(' ');
  assert.match(faithful, /(?:価値中立|事件性|用法|提供者|利用者)/u);
  assert.doesNotMatch(faithful, /かんたんに：|使う側：/u);
});
