import { validateInput } from './normalizer.js';
import { parseModelOutput, validateSummary } from './validator.js';
import { buildStructuredSlate, validateStructuredCoverage } from './structure.js?v=1.1.0';

export const MODEL_ID = 'Qwen3-1.7B-q4f16_1-MLC';
export const LOCAL_GENERATION_BUDGET_MS = 25000;
export const MODEL_PREPARATION_BUDGET_MS = 300000;
export const MODEL_INPUT_MAX_CHARS = 1500;
export const APP_VERSION = '1.1.0';

function canUseWebGPU() { return typeof navigator !== 'undefined' && 'gpu' in navigator; }

async function hasWebGPUAdapter() {
  if (!canUseWebGPU() || !navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
  try { return Boolean(await navigator.gpu.requestAdapter()); } catch { return false; }
}

function buildSlate(text, style) { return buildStructuredSlate(text, style, MODEL_INPUT_MAX_CHARS); }

function comparable(value) {
  return String(value)
    .normalize('NFKC')
    .toLocaleLowerCase('ja-JP')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '');
}

function containsLongSourceRun(item, source, runLength = 36) {
  const itemText = comparable(item);
  const sourceText = comparable(source);
  if (itemText.length < runLength || sourceText.length < runLength) return false;
  for (let i = 0; i <= itemText.length - runLength; i += Math.max(1, Math.floor(runLength / 3))) {
    if (sourceText.includes(itemText.slice(i, i + runLength))) return true;
  }
  const tailStart = Math.max(0, itemText.length - runLength);
  return sourceText.includes(itemText.slice(tailStart));
}

function validateStandaloneComprehension(items, text, style) {
  if (!Array.isArray(items) || items.length !== 3) return { ok: false, reason: 'standalone-shape' };
  if (style !== 'gist' && style !== 'easy') return { ok: true };

  const firstSentence = String(items[0]).split(/[。！？!?]/u)[0] || '';
  const topicPredicate = /明確|具体化|示|整理|公表|発表|決め|変わ|判明|分か|説明|解説|主張|報告|提案|定め|明らか|更新|発見|導入|認め|禁止|可能|求め|示した|なった|した|する/u;
  if (!topicPredicate.test(firstSentence)) return { ok: false, reason: 'missing-topic-statement' };

  const copiedLines = items.filter((item) => containsLongSourceRun(item, text, 36)).length;
  if (copiedLines >= 2) return { ok: false, reason: 'too-extractive' };

  return { ok: true };
}

function assessModelOutput(modelOutput, text, style) {
  const parsed = parseModelOutput(modelOutput?.raw);
  const valid = validateSummary(parsed, text);
  if (!valid.ok) return { ok: false, reason: `format:${valid.reason}` };

  const coverage = validateStructuredCoverage(valid, text, style);
  if (!coverage.ok) return { ok: false, reason: `semantic:${coverage.reason}` };

  const standalone = validateStandaloneComprehension(valid.items, text, style);
  if (!standalone.ok) return { ok: false, reason: `standalone:${standalone.reason}` };

  return { ok: true, items: valid.items, notes: valid.notes };
}

function typedError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function defaultWorkerFactory() {
  if (typeof Worker === 'undefined') throw typedError('local-model-unavailable', 'Worker is not supported.');
  return new Worker(new URL('./local-worker.js?v=1.1.0', import.meta.url), { type: 'module' });
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
        : (data.progress || '初回のみ約1GBのブラウザ内モデルを準備しています…');
      pending.onStatus('preparing-model', detail);
      return;
    }
    if (data.type === 'ready') {
      this.ready = true;
      clearTimeout(pending.preparationTimer);
      pending.onStatus('summarizing', '文章全体の意味を3行にまとめています…');
      pending.generationTimer = setTimeout(() => this.failPending(new Error('Local inference timed out.'), true), this.generationBudgetMs);
      return;
    }
    if (data.type === 'result') {
      this.finishPending(() => pending.resolve({ raw: data.raw, modelId: data.modelId || MODEL_ID }));
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

function runWorker(text, style, onStatus) {
  return sharedWorkerClient.run(buildSlate(text, style), style, onStatus);
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => sharedWorkerClient.dispose(), { once: true });

export async function summarize({ text, style = 'gist', onStatus = () => {}, localRunner = runWorker }) {
  const validation = validateInput(text);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { code: validation.code });

  const started = performance.now();
  onStatus('validating', '入力を確認しています…');

  if (!(await hasWebGPUAdapter())) {
    throw typedError(
      'local-model-unavailable',
      'この端末では高品質なブラウザ内要約モデルを利用できません。入力は残っています。',
    );
  }

  onStatus('preparing-model', '対応端末では初回のみ約1GBのブラウザ内モデルを準備します…');

  let modelOutput;
  try {
    modelOutput = await localRunner(text, style, onStatus);
  } catch (error) {
    const timeout = /timed out/i.test(error?.message || '');
    throw typedError(
      timeout ? 'local-model-timeout' : 'local-model-unavailable',
      timeout
        ? 'ブラウザ内モデルの処理が時間内に完了しませんでした。入力は残っています。'
        : 'ブラウザ内モデルを利用できませんでした。入力は残っています。',
      error,
    );
  }

  const assessment = assessModelOutput(modelOutput, text, style);
  if (!assessment.ok) {
    throw typedError(
      'quality-unavailable',
      '十分に分かりやすい3行を作れませんでした。入力は残っています。もう一度試せます。',
    );
  }

  return {
    items: assessment.items,
    notes: assessment.notes,
    engine: 'local-qwen',
    modelId: modelOutput.modelId || MODEL_ID,
    elapsedMs: Math.max(0, Math.round(performance.now() - started)),
    preparationState: 'ready',
  };
}

export {
  canUseWebGPU,
  hasWebGPUAdapter,
  buildSlate,
  assessModelOutput,
  containsLongSourceRun,
  validateStandaloneComprehension,
};
