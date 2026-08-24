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

test('Jun legaltech acceptance fixture identity is fixed', () => {
  assert.ok([...source].length > 5000);
  assert.equal(createHash('sha256').update(source).digest('hex'), '6268b1b6e2224f024896b315c080c04a36289e796725215944391e1e945f71b0');
  assert.match(source, /ポイント②：セーフの分水嶺は「価値中立性」/u);
  assert.match(source, /まとめ：明日から何をするか/u);
});

test('D3 pins Transformers.js WASM and Japanese 150M model assets', () => {
  assert.equal(APP_VERSION, '1.2.0');
  assert.equal(MODEL_ID, 'onnx-community/llm-jp-3-150m-instruct3-ONNX');
  assert.match(workerSource, /@huggingface\/transformers@4\.2\.0/u);
  assert.match(workerSource, /device:\s*'wasm'/u);
  assert.match(workerSource, /dtype:\s*MODEL_DTYPE/u);
  assert.match(workerSource, /MODEL_DTYPE = 'q8'/u);
  assert.match(workerSource, /762812c8ba117b760d31d537b0bbeb2f3b2b01ee/u);
  assert.match(workerSource, /12b5772a9f242607774d19f75e8395ab05ca33f6c7071303158ba4380dce7ad9/u);
  assert.doesNotMatch(workerSource, /webgpu|WebGPU/u);
});

test('Stage A keeps the Jun article core meaning within 1000 chars', () => {
  const digest = buildSlate(source, 'gist');
  assert.equal(MODEL_INPUT_MAX_CHARS, 1000);
  assert.ok([...digest].length <= MODEL_INPUT_MAX_CHARS, [...digest].length);
  assert.match(digest, /^題名:/mu);
  assert.match(digest, /価値中立/u);
  assert.match(digest, /(?:用法|運用)/u);
  assert.match(digest, /(?:弁護士|紛争|裁判所|和解)/u);
  assert.match(digest, /①②/u);
  assert.ok(digest.split('\n').length >= 6, digest);
});

test('both Jun-observed unintelligible outputs remain rejected', () => {
  const first = assessModelOutput({ raw: toRaw(firstObservedBadItems) }, source, 'gist');
  const latest = assessModelOutput({ raw: toRaw(latestObservedBadItems) }, source, 'gist');
  assert.equal(first.ok, false);
  assert.equal(latest.ok, false);
});

test('standalone-comprehensible document summary passes the D3 quality gate', () => {
  const assessment = assessModelOutput({ raw: toRaw(standaloneGoodItems) }, source, 'gist');
  assert.equal(assessment.ok, true, assessment.reason);
  assert.deepEqual(assessment.items, standaloneGoodItems);
});

test('bad model output is never surfaced as successful output', async () => {
  let calls = 0;
  await assert.rejects(
    summarize({
      text: source,
      style: 'gist',
      localRunner: async (digest) => {
        calls += 1;
        assert.ok([...digest].length <= 1000);
        return { raw: toRaw(latestObservedBadItems), modelId: MODEL_ID };
      },
    }),
    (error) => error?.code === 'quality-unavailable',
  );
  assert.equal(calls, 1);
});

test('good model output succeeds without any WebGPU capability check', async () => {
  let seenDigest = '';
  const result = await summarize({
    text: source,
    style: 'gist',
    localRunner: async (digest) => {
      seenDigest = digest;
      return { raw: toRaw(standaloneGoodItems), modelId: MODEL_ID };
    },
  });
  assert.match(seenDigest, /価値中立/u);
  assert.equal(result.engine, 'local-llm-jp-wasm');
  assert.equal(result.modelId, MODEL_ID);
  assert.deepEqual(result.items, standaloneGoodItems);
});

test('local inference timeout is typed and never returns extractive success', async () => {
  await assert.rejects(
    summarize({
      text: source,
      style: 'gist',
      localRunner: async () => { throw new Error('Local inference timed out.'); },
    }),
    (error) => error?.code === 'local-model-timeout',
  );
});
