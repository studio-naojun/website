import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, segmentSentences, extractLiterals } from '../../src/normalizer.js';
import { summarizeExtractively } from '../../src/fallback.js';
import { validateSummary } from '../../src/validator.js';
import { serializeFeedback } from '../../src/feedback.js';
import { summarize } from '../../src/summarizer.js';
import { composeThreeLines, composeTopicLine } from '../../src/composer.js';
import { tinySummarizerTfScores } from '../../vendor/tiny-summarizer-tf.js';

test('blank and input cap validation are explicit', () => {
  assert.equal(validateInput('   ').code, 'blank');
  assert.equal(validateInput('あ'.repeat(10000)).ok, true);
  assert.equal(validateInput('あ'.repeat(20001)).code, 'too-long');
  assert.match(validateInput('あ'.repeat(20001)).message, /20,000/);
});

test('Japanese sentence segmentation handles punctuation and newlines', () => {
  const text = '今日は晴れです。次に確認します。\nただし、雨なら延期します！';
  const sentences = segmentSentences(text);
  assert.ok(sentences.length >= 3);
  assert.ok(sentences.some(({ text: value }) => value.includes('ただし')));
});

test('adapted TinySummarizer TF signal rewards recurring content terms', () => {
  const scores = tinySummarizerTfScores([
    ['図書館', '改修', '必要'],
    ['図書館', '席', '増設'],
    ['広告', '保存'],
  ]);
  assert.equal(scores.length, 3);
  assert.ok(scores[0] > scores[2]);
  assert.ok(scores[1] > scores[2]);
});

test('extractive ranking remains deterministic for unstructured text', () => {
  const source = '新制度は窓口を速くする。費用は増える可能性がある。一方、利用者の手続きは簡単になる。導入前に条件確認が必要だ。';
  const first = summarizeExtractively(source, 'gist');
  const second = summarizeExtractively(source, 'gist');
  assert.deepEqual(first.items, second.items);
  assert.equal(first.items.length, 3);
});

test('structured title is converted into a standalone topic statement', () => {
  const title = '【保存版】「AIに契約書を読ませていいのか問題」に、法務省がついに線を引いた──弁護士法72条の新ガイドラインを全部まとめた';
  const line = composeTopicLine(title);
  assert.match(line, /法務省/u);
  assert.match(line, /弁護士法72条/u);
  assert.match(line, /線引/u);
});

test('structured document composes topic, boundary, and action', () => {
  const source = [
    '【保存版】「AIに契約書を読ませていいのか問題」に、法務省が線を引いた──弁護士法72条の新ガイドラインをまとめた',
    '■ ポイント①：利用者が入力しても提供者は無関係ではない',
    '利用者の入力も提供者側が企図した機能の契機として評価され得る。',
    '■ ポイント②：セーフの分水嶺は「価値中立性」',
    '事件性のある案件向けに設計されていないサービスなら、提供者が法律事務を扱ったと評価するのは困難。',
    '■ ポイント③：設計がセーフでも「用法」でアウトになる',
    '紛争案件で使われると認識・認容しながら提供すると問題になり得る。',
    '■ まとめ：明日から何をするか',
    '共通して：紛争案件、裁判所への提出書面、和解契約書に近づいたら手を止めて弁護士へ。',
  ].join('\n');
  const result = composeThreeLines(source, 'gist');
  assert.equal(result.items.length, 3);
  assert.match(result.items[0], /法務省/u);
  assert.match(result.items[1], /価値中立/u);
  assert.match(result.items[1], /アウト/u);
  assert.match(result.items[2], /弁護士/u);
});

test('summarize returns exactly three browser-local units with no preparation state', async () => {
  const source = 'この制度は窓口を速くする。費用は増える可能性がある。一方、利用者の手続きは簡単になる。導入前に条件確認が必要だ。';
  const result = await summarize({ text: source, style: 'gist' });
  assert.equal(result.items.length, 3);
  assert.equal(result.engine, 'deterministic-semantic-composer');
  assert.equal(result.modelId, 'none');
  assert.equal(result.preparationState, 'not-required');
});

test('four styles work from the same source without model state', async () => {
  const source = '図書館の改修案では閲覧席を増やす案がある。児童室を優先すると一般席は減る。夜間開館は便利だが職員配置と光熱費が課題になる。結論として、用途の優先順位を決める必要がある。';
  for (const style of ['gist', 'points', 'easy', 'faithful']) {
    const result = await summarize({ text: source, style });
    assert.equal(result.items.length, 3, style);
    assert.ok(result.items.every((item) => [...item].length <= 120), style);
  }
});

test('validator rejects invented literals and composer output stays bounded', () => {
  assert.equal(validateSummary({ items: ['4', 'B', 'C'], notes: [] }, 'A。B。C。').ok, false);
  assert.equal(validateSummary({ items: ['A', 'B', 'C'], notes: [] }, 'A。B。C。').ok, true);
  assert.deepEqual(extractLiterals('12 https://example.com @naojun').numbers, ['12']);
});

test('feedback schema drops text fields and unknown fields', () => {
  const payload = serializeFeedback({
    rating: 'bad', style: 'faithful', bad_reason: 'missing', engine: 'deterministic-semantic-composer', elapsedMs: 12,
    source: 'sample input', summary: 'sample output', user_id: 'sample-user', extra: 'drop',
  });
  assert.equal('source' in payload, false);
  assert.equal('summary' in payload, false);
  assert.equal('user_id' in payload, false);
  assert.equal('extra' in payload, false);
});
