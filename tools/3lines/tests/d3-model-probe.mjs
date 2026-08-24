import { readFile } from 'node:fs/promises';
import { pipeline } from '@huggingface/transformers';
import { buildHierarchicalDigest } from '../src/stage-a.js';
import { assessModelOutput } from '../src/summarizer.js';

const MODEL_ID = 'onnx-community/llm-jp-3-150m-instruct3-ONNX';
const MODEL_REVISION = '762812c8ba117b760d31d537b0bbeb2f3b2b01ee';
const source = await readFile(new URL('./fixtures/jun-legaltech-72-20260824.txt', import.meta.url), 'utf8');
const digest = buildHierarchicalDigest(source, 'gist');

console.log('--- STAGE A DIGEST ---');
console.log(digest);
console.log(`digest-chars:${[...digest].length}`);
console.log('--- END DIGEST ---');

// Node's Transformers.js build exposes this execution provider as "cpu".
// The product worker remains explicitly browser WASM. This probe isolates
// the pinned model + prompt + semantic quality before browser-runtime testing.
const generator = await pipeline('text-generation', MODEL_ID, {
  revision: MODEL_REVISION,
  device: 'cpu',
  dtype: 'q8',
});

const prompt = `次の「要点メモ」を、元の文章を読んでいない人にも分かる3行に言い換えてください。\n1行目は「何の話で、何が示されたか」。2行目は「一番重要な条件・線引き」。3行目は「結局どう理解・行動するか」。\n要点メモの見出し語をそのまま繰り返すだけにせず、意味が通る短い文にしてください。原文にない事実は足さないでください。\n出力は必ず次の3行だけです。\n1. ...\n2. ...\n3. ...\n\n要点メモ:\n${digest}`;

const started = performance.now();
const result = await generator([
  { role: 'system', content: '以下は、タスクを説明する指示です。要求を適切に満たす応答を書きなさい。' },
  { role: 'user', content: prompt },
], {
  max_new_tokens: 120,
  do_sample: true,
  top_p: 0.95,
  temperature: 0.7,
  repetition_penalty: 1.05,
});
const elapsedMs = Math.round(performance.now() - started);

const generated = result?.[0]?.generated_text;
const raw = typeof generated === 'string'
  ? generated.trim()
  : Array.isArray(generated)
    ? String([...generated].reverse().find((message) => message?.role === 'assistant')?.content || '').trim()
    : '';

console.log(`generation-ms:${elapsedMs}`);
console.log('--- MODEL OUTPUT ---');
console.log(raw);
console.log('--- END OUTPUT ---');

const assessment = assessModelOutput({ raw }, source, 'gist');
console.log('assessment:', JSON.stringify(assessment));
if (!assessment.ok) process.exitCode = 2;
