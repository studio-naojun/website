import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const sourceRoot = new URL('../../src/', import.meta.url);
const files = await readdir(sourceRoot);
const source = (await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => readFile(new URL(file, sourceRoot), 'utf8')))).join('\n');

test('normal generation has no metered generative AI endpoint', () => {
  assert.doesNotMatch(source, /api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.cohere\.ai/iu);
  assert.match(source, /web-llm@0\.2\.82/);
  assert.match(source, /8c14ce481d4c692769976ad52afea453a102df19/);
  assert.match(source, /025bcaf3780fa8254f5e5efd3bfea0a5397248f4/);
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
