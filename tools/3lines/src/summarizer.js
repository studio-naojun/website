import { summarizeExtractively } from './fallback.js';
import { validateInput } from './normalizer.js';
import { parseModelOutput, validateSummary } from './validator.js';
import { buildStructuredSlate, validateStructuredCoverage } from './structure.js?v=1.0.3';
import { summarizeStructurally } from './structured-fallback.js?v=1.0.3';

export const MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC';
export const LOCAL_GENERATION_BUDGET_MS = 16000;
export const LOCAL_REPAIR_BUDGET_MS = 8000;
export const MODEL_PREPARATION_BUDGET_MS = 120000;
export const MODEL_INPUT_MAX_CHARS = 1800;
export const APP_VERSION = '1.0.3';

function canUseWebGPU() { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

async function hasWebGPUAdapter() {
  if (!canUseWebGPU() || !navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
  try { return Boolean(await navigator.gpu.requestAdapter()); } catch { return false; }
}

function buildSlate(text, style) { return buildStructuredSlate(text, style, MODEL_INPUT_MAX_CHARS); }

function fallbackResult(text, style, started, preparationState) {
  const result = summarizeStructurally(text, style) || summarizeExtractively(text, style);
  return { ...result, elapsedMs: Math.max(0, Math.round(performance.now() - started)), preparationState: result.preparationState || preparationState };
}

function assessModelOutput(modelOutput, text, style) {
  const parsed = parseModelOutput(modelOutput?.raw);
  const valid = validateSummary(parsed, text);
  if (!valid.ok) return { ok: false, reason: `format:${valid.reason}` };
  const coverage = validateStructuredCoverage(valid, text, style);
  if (!coverage.ok) return { ok: false, reason: `semantic:${coverage.reason}` };
  return { ok: true, items: valid.items, notes: valid.notes };
}

function defaultWorkerFactory() {
  if (typeof Worker === 'undefined') throw new Error('Worker is not supported.');
  return new Worker(new URL('./local-worker.js?v=1.0.3', import.meta.url), { type: 'module' });
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

  run(slate, style, onStatus = () => {}, options = {}) {
    const execute = () => this.execute(slate, style, onStatus, options);
    const result = this.queue.then(execute, execute);
    this.queue = result.catch(() => undefined);
    return result;
  }

  execute(slate, style, onStatus, options) {
    return new Promise((resolve, reject) => {
      const worker = this.ensureWorker();
      const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      const preparationTimer = setTimeout(() => this.failPending(new Error('Model preparation timed out.'), true), this.preparationBudgetMs);
      this.pending = {
        requestId, resolve, reject, onStatus, preparationTimer, generationTimer: null,
        generationBudgetMs: Number(options?.generationBudgetMs) || this.generationBudgetMs,
      };
      worker.postMessage({
        type: 'summarize', requestId, style, slate,
        repairFrom: typeof options?.repairFrom === 'string' ? options.repairFrom : '',
        repairReason: typeof options?.repairReason === 'string' ? options.repairReason : '',
      });
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
      pending.onStatus('summarizing', data.repair ? '全体の意味に寄せて3行を再調整しています…' : '文章全体を3行にまとめています…');
      pending.generationTimer = setTimeout(() => this.failPending(new Error('Local inference timed out.'), true), pending.generationBudgetMs);
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

function runWorker(text, style, onStatus, options = {}) {
  return sharedWorkerClient.run(buildSlate(text, style), style, onStatus, options);
}

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
    const first = await localRunner(text, style, onStatus, { generationBudgetMs: LOCAL_GENERATION_BUDGET_MS });
    const firstAssessment = assessModelOutput(first, text, style);
    if (firstAssessment.ok) {
      return { items: firstAssessment.items, notes: firstAssessment.notes, engine: 'local-qwen', modelId: first.modelId, elapsedMs: Math.max(0, Math.round(performance.now() - started)), preparationState: 'ready' };
    }

    onStatus('summarizing', '細部への偏りを検出しました。全体の意味に寄せて再調整しています…');
    try {
      const repaired = await localRunner(text, style, onStatus, {
        generationBudgetMs: LOCAL_REPAIR_BUDGET_MS,
        repairFrom: first.raw,
        repairReason: firstAssessment.reason,
      });
      const repairedAssessment = assessModelOutput(repaired, text, style);
      if (repairedAssessment.ok) {
        return { items: repairedAssessment.items, notes: repairedAssessment.notes, engine: 'local-qwen', modelId: repaired.modelId, elapsedMs: Math.max(0, Math.round(performance.now() - started)), preparationState: 'ready-repaired' };
      }
      return fallbackResult(text, style, started, `fallback:${repairedAssessment.reason}`);
    } catch (repairError) {
      return fallbackResult(text, style, started, `fallback:repair:${repairError.message}`);
    }
  } catch (error) {
    onStatus('summarizing', 'ブラウザ内モデルを使えないため、意味構造から3行を組み立てています…');
    return fallbackResult(text, style, started, `fallback:${error.message}`);
  }
}

export { canUseWebGPU, hasWebGPUAdapter, buildSlate, assessModelOutput };
