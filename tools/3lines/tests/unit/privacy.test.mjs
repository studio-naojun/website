import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const sourceRoot = new URL('../../src/', import.meta.url);
const files = await readdir(sourceRoot);
const source = (await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => readFile(new URL(file, sourceRoot), 'utf8')))).join('\n');

test('normal summarization source has no external generative model/runtime route', () => {
  assert.doesNotMatch(source, /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.cohere\.ai/iu);
  assert.doesNotMatch(source, /web-llm|transformers|huggingface|navigator\.gpu|device:\s*['"](?:webgpu|wasm)['"]/iu);
  assert.doesNotMatch(source, /new\s+Worker\s*\(/u);
});

test('feedback payload source has no raw text fields', async () => {
  const feedback = await readFile(new URL('../../src/feedback.js', import.meta.url), 'utf8');
  assert.doesNotMatch(feedback, /source|summary|user_id|identity/iu);
  assert.match(feedback, /FEEDBACK_FIELDS/);
});

test('product package has no runtime dependencies', async () => {
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.deepEqual(pkg.dependencies || {}, {});
});

test('product files remain inside the declared scope', () => {
  const root = new URL('../../', import.meta.url);
  assert.equal(root.pathname.endsWith('/tools/3lines/'), true);
});
