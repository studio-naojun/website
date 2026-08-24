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
console.log('--- END DIGEST ---');

// Node's Transformers.js build exposes this execution provider as "cpu".
// The product worker remains explicitly browser WASM. This probe isolates
// the pinned model + prompt + semantic quality before browser-runtime testing.
const generator = await pipeline('text-generation', MODEL_ID, {
  revision: MODEL_REVISION,
  device: 'cpu',
  dtype: 'q8',
  progress_callback: (progress) => {
    if (progress?.status === 'progress' && Number.isFinite(progress.progress)) {
      const value = Math.round(progress.progress);
      if (value % 20 === 0) console.log(`model-progress:${value}%`);
    }
  },
});

const prompt = `以下は長文から重要部分を選んだ内部ダイジェストです。抜粋をそのまま3本並べず、文章全体の意味を初見の人にも分かる自然な日本語へ言い直してください。\n\n1行目=何についての文章で何が示されたか。2行目=理解を左右する最重要の条件・線引き。3行目=読者が結局どう理解・行動すればよいか。\n\n必須条件:\n- 3行だけを読めば、元の長文を読んでいない人でも何の話か説明できる。\n- 抽象語・専門用語を置くだけで終わらず、それが何を意味するか短く説明する。\n- 同じ節の細部だけで3行を埋めない。\n- 原文にない事実、数字、固有名詞、評価を加えない。\n- 原文の否定、条件、例外を逆転させない。\n- 各行120文字以内。\n\n次の形式だけを返す:\n1. ...\n2. ...\n3. ...\n\n内部ダイジェスト:\n${digest}`;

const result = await generator([
  { role: 'system', content: '以下は、タスクを説明する指示です。要求を適切に満たす応答を書きなさい。' },
  { role: 'user', content: prompt },
], {
  max_new_tokens: 180,
  do_sample: false,
  repetition_penalty: 1.08,
});

const generated = result?.[0]?.generated_text;
const raw = typeof generated === 'string'
  ? generated.trim()
  : Array.isArray(generated)
    ? String([...generated].reverse().find((message) => message?.role === 'assistant')?.content || '').trim()
    : '';

console.log('--- MODEL OUTPUT ---');
console.log(raw);
console.log('--- END OUTPUT ---');

const assessment = assessModelOutput({ raw }, source, 'gist');
console.log('assessment:', JSON.stringify(assessment));
if (!assessment.ok) process.exitCode = 2;
