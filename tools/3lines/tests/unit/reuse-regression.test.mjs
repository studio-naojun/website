import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeForAnalysis } from '../../src/normalizer.js';
import { summarizeExtractively } from '../../src/fallback.js';
import { buildSlate, LocalWorkerClient } from '../../src/summarizer.js';

test('single-sentence fallback reaches exactly three source-derived items without filler', () => {
  const source = '新しい制度は申請を簡単にするが、費用負担は増える可能性があり、導入前に利用者への説明が必要になる。';
  const result = summarizeExtractively(source, 'gist');
  assert.equal(result.items.length, 3);
  assert.equal(result.items.some((item) => item.includes('原文に含まれる主張は')), false);
  const normalized = normalizeForAnalysis(source);
  for (const item of result.items) assert.ok(normalized.includes(item.replace(/…$/u, '')), item);
});

test('ranked model slate retains a material conclusion from the middle of a long source', () => {
  const filler = '背景説明として同じ周辺事情を述べる。'.repeat(20);
  const source = `${filler}結論として、採用すべきなのは案Bであり、条件は予算上限を守ることだ。${filler}`;
  const slate = buildSlate(source, 'gist');
  assert.match(slate, /採用すべきなのは案B/);
  assert.ok([...slate].length <= 4000);
});

class FakeWorker {
  constructor(delay = 8) {
    this.listeners = { message: [], error: [] };
    this.delay = delay;
    this.posts = [];
    this.terminated = 0;
    this.active = 0;
    this.maxActive = 0;
  }

  addEventListener(type, handler) { this.listeners[type].push(handler); }
  emit(type, event) { for (const handler of this.listeners[type]) handler(event); }

  postMessage(message) {
    this.posts.push(message);
    this.active += 1;
    this.maxActive = Math.max(this.maxActive, this.active);
    setTimeout(() => this.emit('message', { data: { type: 'preparing', requestId: message.requestId, warm: this.posts.length > 1 } }), 0);
    setTimeout(() => this.emit('message', { data: { type: 'ready', requestId: message.requestId } }), 1);
    setTimeout(() => {
      this.active -= 1;
      this.emit('message', { data: { type: 'result', requestId: message.requestId, raw: '1. 第一\n2. 第二\n3. 第三', modelId: 'fake' } });
    }, this.delay);
  }

  terminate() { this.terminated += 1; }
}

test('one local worker is reused and concurrent gist/easy requests are serialized', async () => {
  let created = 0;
  let worker;
  const client = new LocalWorkerClient({
    workerFactory: () => { created += 1; worker = new FakeWorker(); return worker; },
    preparationBudgetMs: 100,
    generationBudgetMs: 100,
  });

  const first = client.run('slate-a', 'gist');
  const second = client.run('slate-b', 'easy');
  await Promise.all([first, second]);

  assert.equal(created, 1);
  assert.equal(worker.posts.length, 2);
  assert.deepEqual(worker.posts.map((post) => post.style), ['gist', 'easy']);
  assert.equal(worker.maxActive, 1);
  assert.equal(worker.terminated, 0);

  client.dispose();
  assert.equal(worker.terminated, 1);
});
