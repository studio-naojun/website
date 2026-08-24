import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  APP_VERSION,
  MODEL_ID,
  MODEL_INPUT_MAX_CHARS,
  assessModelOutput,
  buildSlate,
  summarize,
} from '../../src/summarizer.js';

const source = await readFile(new URL('../fixtures/jun-legaltech-72-20260824.txt', import.meta.url), 'utf8');
const workerSource = await readFile(new URL('../../src/local-worker.js', import.meta.url), 'utf8');

const firstObservedBadItems = [
  'ただし、利用者のリテラシー向上、不適切利用を把握した場合の注意・警告、悪質なケースでの利用停止措置は自主的に確実に行うことが期待される、とセットで書かれています。',
  'ですが法務省は、現時点の技術水準では適法な出力に影響を与えない形で実効的な制限範囲を明確化するのは困難であり、実効性が低い割に事業者への支障が大きいとして、推奨事項には明記せず今後の検討課題とする。',
  '5については、「弁護士に代わる判断を提供するものである」「法的結論の正確性を保証するものである」と想起させる表現は厳に慎む、とはっきり書かれています。',
];

const latestObservedBadItems = [
  '弁護士法72条の新ガイドラインでは、セーフの分水嶺は「価値中立性」。「事件性」のある案件に利用させることを目指して設計されたサービスでない場合、提供者が法律事務を取り扱ったと評価するのは困難。',
  '設計がセーフでも「用法」でアウトになる。こういう状態だと、提供形態・用法の点から、実質的に法律事務を取り扱ったと評価せざるを得ない。',
  '実務では、紛争が顕在化した案件、裁判所への提出書面、和解契約書。この3つに近づいたら手を止めて弁護士へ',
];

const standaloneGoodItems = [
  '法務省は、企業がAIで法務を支援するときに弁護士法72条へ触れる境界を、新ガイドラインで明確にした。',
  'ポイントは、中立な設計だけでなく、実際に紛争へ使われると知りながら提供していないかまで見られること。',
  '企業は安全な法務支援にはAIを使いつつ、紛争や裁判書面・和解契約書に近づいたら弁護士へつなぐ。',
];

const toRaw = (items) => items.map((item, index) => `${index + 1}. ${item}`).join('\n');

function installWebGPU() {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { gpu: { requestAdapter: async () => ({}) } },
  });
  return () => Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
}

test('Jun legaltech acceptance fixture identity is fixed', () => {
  assert.ok([...source].length > 5000);
  assert.equal(createHash('sha256').update(source).digest('hex'), '6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0');
  assert.match(source, /ポイント②：セーフの分水嶺は「価値中立性」/u);
  assert.match(source, /まとめ：明日から何をするか/u);
});

test('D2 pins WebLLM 0.2.82 and Qwen3 1.7B assets', () => {
  assert.equal(APP_VERSION, '1.1.0');
  assert.equal(MODEL_ID, 'Qwen3-1.7B-q4f16_1-MLC');
  assert.match(workerSource, /@mlc-ai\/web-llm@0\.2\.82/u);
  assert.match(workerSource, /80b3abc23aacab805bc16d33cf619fa7c0dcf720/u);
  assert.match(workerSource, /Qwen3-1\.7B-q4f16_1-ctx4k_cs1k-webgpu\.wasm/u);
  assert.match(workerSource, /2036\.66/u);
});

test('D2 model slate stays small while preserving major article structure', () => {
  const slate = buildSlate(source, 'gist');
  assert.equal(MODEL_INPUT_MAX_CHARS, 1500);
  assert.ok([...slate].length <= MODEL_INPUT_MAX_CHARS);
  assert.match(slate, /\[SUMMARY\]/u);
  assert.match(slate, /\[CORE\]/u);
  assert.match(slate, /価値中立/u);
  assert.match(slate, /弁護士へ/u);
});

test('both Jun-observed unintelligible outputs fail the D2 quality gate', () => {
  const first = assessModelOutput({ raw: toRaw(firstObservedBadItems) }, source, 'gist');
  const latest = assessModelOutput({ raw: toRaw(latestObservedBadItems) }, source, 'gist');
  assert.equal(first.ok, false);
  assert.equal(latest.ok, false);
  assert.match(latest.reason, /standalone:/u);
});

test('standalone-comprehensible document summary passes D2 quality gate', () => {
  const assessment = assessModelOutput({ raw: toRaw(standaloneGoodItems) }, source, 'gist');
  assert.equal(assessment.ok, true, assessment.reason);
  assert.deepEqual(assessment.items, standaloneGoodItems);
});

test('bad local output is never surfaced as a fallback success', async () => {
  const restore = installWebGPU();
  let calls = 0;
  try {
    await assert.rejects(
      summarize({
        text: source,
        style: 'gist',
        localRunner: async () => {
          calls += 1;
          return { raw: toRaw(latestObservedBadItems), modelId: MODEL_ID };
        },
      }),
      (error) => error?.code === 'quality-unavailable',
    );
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});

test('good local output succeeds in one generation with the D2 model identity', async () => {
  const restore = installWebGPU();
  let calls = 0;
  try {
    const result = await summarize({
      text: source,
      style: 'gist',
      localRunner: async () => {
        calls += 1;
        return { raw: toRaw(standaloneGoodItems), modelId: MODEL_ID };
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.engine, 'local-qwen');
    assert.equal(result.modelId, MODEL_ID);
    assert.deepEqual(result.items, standaloneGoodItems);
  } finally {
    restore();
  }
});

test('WebGPU absence is explicit unsupported behavior, never fallback output', async () => {
  const originalNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  try {
    await assert.rejects(
      summarize({ text: source, style: 'gist' }),
      (error) => error?.code === 'local-model-unavailable',
    );
  } finally {
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator });
  }
});

test('local inference timeout is typed and never returns extractive success', async () => {
  const restore = installWebGPU();
  try {
    await assert.rejects(
      summarize({
        text: source,
        style: 'gist',
        localRunner: async () => { throw new Error('Local inference timed out.'); },
      }),
      (error) => error?.code === 'local-model-timeout',
    );
  } finally {
    restore();
  }
});
