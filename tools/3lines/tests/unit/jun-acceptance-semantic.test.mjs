import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { validateStructuredCoverage } from '../../src/structure.js';
import { summarizeStructurally } from '../../src/structured-fallback.js';
import { buildSlate, MODEL_INPUT_MAX_CHARS, summarize } from '../../src/summarizer.js';

const source = await readFile(new URL('../fixtures/jun-legaltech-72-20260824.txt', import.meta.url), 'utf8');

const observedBadItems = [
  'ただし、利用者のリテラシー向上、不適切利用を把握した場合の注意・警告、悪質なケースでの利用停止措置は自主的に確実に行うことが期待される、とセットで書かれています。',
  'ですが法務省は、現時点の技術水準では適法な出力に影響を与えない形で実効的な制限範囲を明確化するのは困難であり、実効性が低い割に事業者への支障が大きいとして、推奨事項には明記せず今後の検討課題とする。',
  '5については、「弁護士に代わる判断を提供するものである」「法的結論の正確性を保証するものである」と想起させる表現は厳に慎む、とはっきり書かれています。',
];

const goodItems = [
  '法務省の新ガイドラインは、弁護士法72条の解釈自体を変えず、AI法務支援の分水嶺を事件性と価値中立な設計で明確にした。',
  '利用者が入力した場合でも提供者の行為と評価され得て、設計が中立でも紛争利用を認識・認容すれば用法上アウトになり得る。',
  '企業はセーフ7類型を活用しつつガバナンスを整え、紛争案件や裁判提出書面・和解契約書に近づいたら弁護士へつなぐ。',
];

const toRaw = (items) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');

test('Jun legaltech acceptance fixture identity and long-form structure are fixed', () => {
  assert.ok([...source].length > 5000);
  assert.equal(createHash('sha256').update(source).digest('hex'), '6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0');
  assert.match(source, /ポイント②：セーフの分水嶺は「価値中立性」/u);
  assert.match(source, /まとめ：明日から何をするか/u);
});

test('model slate is compact enough for the 4k-token browser model while preserving core meaning', () => {
  const slate = buildSlate(source, 'gist');
  assert.ok([...slate].length <= MODEL_INPUT_MAX_CHARS);
  assert.match(slate, /\[SUMMARY\]/u);
  assert.match(slate, /\[CORE\]/u);
  assert.match(slate, /価値中立/u);
  assert.match(slate, /設計がセーフでも「用法」でアウト/u);
  assert.match(slate, /手を止めて弁護士へ/u);
});

test('the exact Jun-observed detail-only output is semantically rejected', () => {
  const coverage = validateStructuredCoverage({ items: observedBadItems }, source, 'gist');
  assert.equal(coverage.ok, false);
  assert.equal(coverage.reason, 'detail-only');
});

test('meaningful fallback explains topic, boundary, and practical action instead of three excerpts', () => {
  const result = summarizeStructurally(source, 'gist');
  assert.ok(result);
  assert.equal(result.items.length, 3);
  assert.match(result.items[0], /弁護士法72条の新ガイドライン/u);
  assert.match(result.items[0], /価値中立/u);
  assert.match(result.items[0], /事件性/u);
  assert.match(result.items[1], /用法/u);
  assert.match(result.items[1], /法律事務/u);
  assert.match(result.items[2], /^実務では/u);
  assert.match(result.items[2], /弁護士へ/u);
  assert.doesNotMatch(result.items.join('\n'), /原文に含まれる主張/u);
});

test('bad first draft gets one semantic repair and surfaces the repaired document-level summary', async () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => ({}) } } });
  let calls = 0;
  try {
    const result = await summarize({
      text: source,
      style: 'gist',
      localRunner: async (_text, _style, _status, options = {}) => {
        calls += 1;
        if (calls === 1) {
          assert.equal(options.repairFrom, undefined);
          return { raw: toRaw(observedBadItems), modelId: 'test-model' };
        }
        assert.match(options.repairFrom, /利用者のリテラシー/u);
        assert.match(options.repairReason, /semantic:detail-only/u);
        return { raw: toRaw(goodItems), modelId: 'test-model' };
      },
    });
    assert.equal(calls, 2);
    assert.equal(result.engine, 'local-qwen');
    assert.deepEqual(result.items, goodItems);
    assert.equal(result.preparationState, 'ready-repaired');
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});

test('two bad model drafts never surface and fall back to a meaningful three-line explanation', async () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => ({}) } } });
  let calls = 0;
  try {
    const result = await summarize({
      text: source,
      style: 'gist',
      localRunner: async () => {
        calls += 1;
        return { raw: toRaw(observedBadItems), modelId: 'test-model' };
      },
    });
    assert.equal(calls, 2);
    assert.equal(result.engine, 'extractive-fallback');
    assert.match(result.items[0], /弁護士法72条の新ガイドライン/u);
    assert.match(result.items[0], /価値中立/u);
    assert.match(result.items[1], /用法/u);
    assert.match(result.items[2], /弁護士へ/u);
    assert.doesNotMatch(result.items.join('\n'), /出力制限.*推奨事項/u);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});

test('document-level three-line model output passes semantic coverage without repair', async () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: { requestAdapter: async () => ({}) } } });
  let calls = 0;
  try {
    const result = await summarize({
      text: source,
      style: 'gist',
      localRunner: async () => {
        calls += 1;
        return { raw: toRaw(goodItems), modelId: 'test-model' };
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.engine, 'local-qwen');
    assert.deepEqual(result.items, goodItems);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});
