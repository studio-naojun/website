import { buildRankedSlate, summarizeExtractively } from './fallback.js';
import { validateInput } from './normalizer.js';
import { parseModelOutput, validateSummary } from './validator.js';

export const MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC';
export const LOCAL_GENERATION_BUDGET_MS = 25000;
export const MODEL_PREPARATION_BUDGET_MS = 120000;
export const APP_VERSION = '1.0.1';

function canUseWebGPU() { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

async function hasWebGPUAdapter() {
  if (!canUseWebGPU() || !navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
  try { return Boolean(await navigator.gpu.requestAdapter()); } catch { return false; }
}

function buildSlate(text, style) { return buildRankedSlate(text, style, 4000); }

function fallbackResult(text, style, started, preparationState) {
  const result = summarizeExtractively(text, style);
  return { ...result, elapsedMs: Math.max(0, Math.round(performance.now() - started)), preparationState };
}

function defaultWorkerFactory() {
  if (typeof Worker === 'undefined') throw new Error('Worker is not supported.');
  return new Worker(new URL('./local-worker.js', import.meta.url), { type: 'module' });
}

export class LocalWorkerClient {
  constructor({ workerFactory = defaultWorkerFactory, preparationBudgetMs = MODEL_PREPARATION_BUDGET_MS, generationBudgetMs = LOCAL_GENERATION_BUDGET_MS } = {}) {
    this.workerFactory = workerFactory;
    this.preparationBudgetMs = preparationBudgetMs;
    this.generationBudgetMs = generationBudgetMs;
    this.worker = null;
    this.ready = false;
    this.pending = null;
    this.queue = Promise.resolve();
    this.handleMessage = this.handleMessage.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  ensureWorker() {
    if (this.worker) return this.worker;
    const worker = this.workerFactory();
    worker.addEventListener('message', this.handleMessage);
    worker.addEventListener('error', this.handleError);
    this.worker = worker;
    this.ready = false;
    return worker;
  }

  run(slate, style, onStatus = () => {}) {
    const execute = () => this.execute(slate, style, onStatus);
    const result = this.queue.then(execute, execute);
    this.queue = result.catch(() => undefined);
    return result;
  }

  execute(slate, style, onStatus) {
    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker();
      const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const preparationTimer = setTimeout(() => this.failPending(new Error('Model preparation timed out.'), true), this.preparationBudgetMs);
      this.pending = { requestId, resolve, reject, onStatus, preparationTimer, generationTimer: null };
      worker.postMessage({ type: 'summarize', requestId, style, slate });
    });
  }

  handleMessage(event) {
    const data = event.data || {};
    const pending = this.pending;
    if (!pending || (data.requestId && data.requestId !== pending.requestId)) return;
    if (data.type === 'progress' || data.type === 'preparing') {
      const detail = data.warm || this.ready
        ? '準備済みのブラウザ内モデルを使います…'
        : (data.progress || '初回のみ約350MBのブラウザ内モデルを準備しています…');
      pending.onStatus('preparing-model', detail);
      return;
    }
    if (data.type === 'ready') {
      this.ready = true;
      clearTimeout(pending.preparationTimer);
      pending.onStatus('summarizing', '文章を3つの意味単位にまとめています…');
      pending.generationTimer = setTimeout(() => this.failPending(new Error('Local inference timed out.'), true), this.generationBudgetMs);
      return;
    }
    if (data.type === 'result') {
      this.finishPending(() => pending.resolve({ raw: data.raw, modelId: data.modelId || MODEL_ID, phase: this.ready ? 'ready' : 'preparing' }));
      return;
    }
    if (data.type === 'error') this.failPending(new Error(data.message || 'Local inference failed.'), true);
  }

  handleError(event) { this.failPending(event.error || new Error('Local worker failed.'), true); }

  finishPending(callback) {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.preparationTimer);
    clearTimeout(pending.generationTimer);
    this.pending = null;
    callback();
  }

  failPending(error, resetWorker = false) {
    const pending = this.pending;
    if (!pending) {
      if (resetWorker) this.reset();
      return;
    }
    this.finishPending(() => pending.reject(error));
    if (resetWorker) this.reset();
  }

  reset() {
    if (this.worker) {
      try { this.worker.terminate(); } catch {}
    }
    this.worker = null;
    this.ready = false;
  }

  dispose() {
    if (this.pending) this.failPending(new Error('Local worker disposed.'), false);
    this.reset();
  }
}

const sharedWorkerClient = new LocalWorkerClient();

function runWorker(text, style, onStatus) { return sharedWorkerClient.run(buildSlate(text, style), style, onStatus); }

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => sharedWorkerClient.dispose(), { once: true });

export async function summarize({ text, style = 'gist', onStatus = () => {}, localRunner = runWorker }) {
  const validation = validateInput(text);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { code: validation.code });
  const started = performance.now();
  onStatus('validating', '入力を確認しています…');
  if (!(await hasWebGPUAdapter())) {
    onStatus('summarizing', 'この環境ではローカル簡易モードでまとめています…');
    return fallbackResult(text, style, started, 'webgpu-unavailable');
  }
  onStatus('preparing-model', '対応端末では初回のみ約350MBのブラウザ内モデルを準備します…');
  try {
    const modelOutput = await localRunner(text, style, onStatus);
    const parsed = parseModelOutput(modelOutput.raw);
    const valid = validateSummary(parsed, text);
    if (!valid.ok) throw new Error(`Local output rejected: ${valid.reason}`);
    return { items: valid.items, notes: valid.notes, engine: 'local-qwen', modelId: modelOutput.modelId, elapsedMs: Math.max(0, Math.round(performance.now() - started)), preparationState: 'ready' };
  } catch (error) {
    onStatus('summarizing', 'ローカルモデルを使えないため、簡易モードに切り替えています…');
    return fallbackResult(text, style, started, `fallback:${error.message}`);
  }
}

export { canUseWebGPU, hasWebGPUAdapter, buildSlate };
