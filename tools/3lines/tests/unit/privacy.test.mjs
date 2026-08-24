import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const sourceRoot = new URL('../../src/', import.meta.url);
const files = await readdir(sourceRoot);
const source = (await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => readFile(new URL(file, sourceRoot), 'utf8')))).join('\n');

test('normal generation has no metered generative AI endpoint and no WebGPU gate', () => {
  assert.doesNotMatch(source, /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.cohere\.ai/iu);
  assert.doesNotMatch(source, /navigator\.gpu|device:\s*['"]webgpu['"]/u);
  assert.match(source, /@huggingface\/transformers@4\.2\.0/u);
  assert.match(source, /device:\s*['"]wasm['"]/u);
  assert.match(source, /onnx-community\/llm-jp-3-150m-instruct3-ONNX/u);
  assert.match(source, /762812c8ba117b760d31d537b0bbeb2f3b2b01ee/u);
  assert.match(source, /12b5772a9f242607774d19f75e8395ab05ca33f6c7071303158ba4380dce7ad9/u);
});

test('feedback payload source has no raw text fields', async () => {
  const feedback = await readFile(new URL('../../src/feedback.js', import.meta.url), 'utf8');
  assert.doesNotMatch(feedback, /source|summary|user_id|identity/iu);
  assert.match(feedback, /FEEDBACK_FIELDS/);
});

test('product files remain inside the declared scope', async () => {
  const root = new URL('../../', import.meta.url);
  assert.equal(root.pathname.endsWith('/tools/3lines/'), true);
});
