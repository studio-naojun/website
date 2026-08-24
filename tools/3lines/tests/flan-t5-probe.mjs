import { readFile } from 'node:fs/promises';
import { pipeline } from '@huggingface/transformers';
import { buildHierarchicalDigest } from '../src/stage-a.js';
import { assessModelOutput } from '../src/summarizer.js';

const MODEL_ID = 'onnx-community/flan-t5-small-ONNX';
const MODEL_REVISION = '76988c16f73cadb2c2e13e2d7d85608944223105';
const source = await readFile(new URL('./fixtures/jun-legaltech-72-20260824.txt', import.meta.url), 'utf8');
const digest = buildHierarchicalDigest(source, 'gist');

console.log('--- STAGE A DIGEST ---');
console.log(digest);
console.log(`digest-chars:${[...digest].length}`);
console.log('--- END DIGEST ---');

const generator = await pipeline('text2text-generation', MODEL_ID, {
  revision: MODEL_REVISION,
  device: 'cpu',
  dtype: 'q8',
});

const prompt = `日本語で要約してください。次の要点メモを、元の文章を読んでいない人にも意味が分かる3行に言い換えます。\n\n1行目: 何についての文章で、何が示されたのか。\n2行目: 一番重要な条件・線引きは何か。\n3行目: 結局、読者はどう理解・行動すればよいか。\n\n条件:\n- 出力は番号付きの3行だけ。\n- 見出しを並べるだけではなく、短い完全な文にする。\n- メモにない法律名・数字・事実を足さない。\n- 各行120文字以内。\n\n要点メモ:\n${digest}\n\n出力:\n1.`;

const started = performance.now();
const result = await generator(prompt, {
  max_new_tokens: 160,
  num_beams: 4,
  no_repeat_ngram_size: 3,
  length_penalty: 1.0,
  early_stopping: true,
});
const elapsedMs = Math.round(performance.now() - started);
const rawGenerated = String(result?.[0]?.generated_text || '').trim();
const raw = rawGenerated.startsWith('1.') ? rawGenerated : `1. ${rawGenerated}`;

console.log(`generation-ms:${elapsedMs}`);
console.log('--- MODEL OUTPUT ---');
console.log(raw);
console.log('--- END OUTPUT ---');
const assessment = assessModelOutput({ raw }, source, 'gist');
console.log('assessment:', JSON.stringify(assessment));
if (!assessment.ok) process.exitCode = 2;
