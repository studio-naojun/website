import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput, segmentSentences, extractLiterals } from '../../src/normalizer.js';
import { summarizeExtractively } from '../../src/fallback.js';
import { parseModelOutput, validateSummary } from '../../src/validator.js';
import { serializeFeedback } from '../../src/feedback.js';
import { buildSlate, canUseWebGPU, summarize } from '../../src/summarizer.js';

test('blank and input cap validation are explicit', () => {
  assert.equal(validateInput('   ').code, 'blank');
  assert.equal(validateInput('あ'.repeat(10000)).ok, true);
  assert.equal(validateInput('あ'.repeat(20001)).code, 'too-long');
  assert.match(validateInput('あ'.repeat(20001)).message, /20,000/);
});

test('Japanese sentence segmentation handles punctuation, newlines, quotes, URL and emoji', () => {
  const text = '「今日は晴れです。」次に確認します。https://example.com/a?x=1 😊\nただし、雨なら延期します！';
  const sentences = segmentSentences(text);
  assert.ok(sentences.length >= 3);
  assert.ok(sentences.some(({ text: value }) => value.includes('https://example.com')));
  assert.ok(sentences.some(({ text: value }) => value.includes('ただし')));
  assert.deepEqual(sentences.map(({ offset }) => offset), [...sentences].map(({ offset }) => offset).sort((a, b) => a - b));
});

test('fallback utility remains deterministic and source-derived but is not the D2 success path', () => {
  const source = '結論として、図書館の改修は必要だ。席を増やせるが、児童室との調整が必要になる。ただし、夜間開館には職員配置の課題がある。';
  const first = summarizeExtractively(source, 'gist');
  const second = summarizeExtractively(source, 'gist');
  assert.deepEqual(first.items, second.items);
  assert.equal(first.items.length, 3);
  assert.ok(first.items.every((item) => [...item].length <= 120));
  assert.ok(first.notes.length <= 3);
  assert.equal(validateSummary(first, source).ok, true);
});

test('four fallback utility styles remain deterministic test helpers', () => {
  const source = 'この制度は窓口を速くする。費用は増える可能性がある。一方、利用者の手続きは簡単になる。';
  for (const style of ['gist', 'points', 'easy', 'faithful']) {
    const result = summarizeExtractively(source, style);
    assert.equal(result.items.length, 3, style);
    assert.equal(result.engine, 'extractive-fallback');
  }
});

test('validator rejects malformed output and invented literals', () => {
  assert.equal(parseModelOutput('1. a\n2. b'), null);
  assert.equal(validateSummary({ items: ['4', 'B', 'C'], notes: [] }, 'A。B。C。').ok, false);
  assert.equal(validateSummary({ items: ['A', 'B', 'C'], notes: [] }, 'A。B。C。').ok, true);
  assert.equal(validateSummary({ items: ['URL https://evil.example', 'B', 'C'], notes: [] }, 'A。B。C。').ok, false);
  assert.deepEqual(extractLiterals('12 https://example.com @naojun').numbers, ['12']);
});

test('feedback schema drops text, summary, user identity and unknown fields', () => {
  const payload = serializeFeedback({
    rating: 'bad', style: 'faithful', bad_reason: 'missing', engine: 'extractive-fallback', elapsedMs: 1200,
    source: 'SECRET CANARY', summary: 'do not send', user_id: 'user-1', extra: 'drop me',
  });
  assert.deepEqual(Object.keys(payload), ['schema_version', 'server_timestamp', 'event_id', 'rating', 'style', 'bad_reason', 'app_version', 'engine', 'model_id', 'latency_bucket']);
  assert.equal('source' in payload, false);
  assert.equal('summary' in payload, false);
  assert.equal('user_id' in payload, false);
});

test('Node/unsupported capability is explicit and never masquerades as fallback success', async () => {
  assert.equal(canUseWebGPU(), false);
  const source = '原文の固有キャナリー文字を失わず、条件がある場合は保持する。';
  assert.ok(buildSlate(source, 'gist').includes('固有キャナリー文字'));
  await assert.rejects(
    summarize({ text: source, style: 'faithful' }),
    (error) => error?.code === 'local-model-unavailable',
  );
});

test('malformed local output is quality-unavailable and timeout is typed', async () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => ({}) } } });
  const source = 'ローカルモデルが失敗しても、この原文は残る。条件があれば保持する。';
  try {
    await assert.rejects(
      summarize({ text: source, style: 'gist', localRunner: async () => ({ raw: 'not a numbered result', modelId: 'test' }) }),
      (error) => error?.code === 'quality-unavailable',
    );
    await assert.rejects(
      summarize({ text: source, style: 'gist', localRunner: async () => { throw new Error('Local inference timed out.'); } }),
      (error) => error?.code === 'local-model-timeout',
    );
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});
