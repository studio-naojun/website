import { summarizeExtractively } from './fallback.js';
import { segmentSentences, validateInput } from './normalizer.js';
import { parseModelOutput, validateSummary } from './validator.js';

export const MODEL_ID = 'Qwen3-0.6B-q4f16_1-MLC';
export const LOCAL_GENERATION_BUDGET_MS = 25000;
export const MODEL_PREPARATION_BUDGET_MS = 20000;
export const APP_VERSION = '1.0.0';

function canUseWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

async function hasWebGPUAdapter() {
  if (!canUseWebGPU() || !navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') return false;
  try {
    return Boolean(await navigator.gpu.requestAdapter());
  } catch {
    return false;
  }
}

function buildSlate(text, style) {
  const sentences = segmentSentences(text);
  const limit = 4000;
  let slate = sentences.map(({ text: sentence }, index) => `${index + 1}. ${sentence}`).join('\n');
  if (slate.length <= limit) return slate;
  if (style === 'faithful') return slate.slice(0, limit);
  const half = Math.floor(limit / 2);
  return `${slate.slice(0, half)}\n…\n${slate.slice(-half)}`;
}

function fallbackResult(text, style, started, preparationState) {
  const result = summarizeExtractively(text, style);
  return { ...result, elapsedMs: Math.max(0, Math.round(performance.now() - started)), preparationState };
}

function runWorker(text, style, onStatus) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('Worker is not supported.'));
      return;
    }
    const worker = new Worker(new URL('./local-worker.js', import.meta.url), { type: 'module' });
    const requestId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    let phase = 'preparing';
    let preparationTimer = setTimeout(() => {
      worker.terminate();
      reject(new Error('Model preparation timed out.'));
    }, MODEL_PREPARATION_BUDGET_MS);
    let generationTimer;
    const finish = (callback) => {
      clearTimeout(preparationTimer);
      clearTimeout(generationTimer);
      worker.terminate();
      callback();
    };
    worker.addEventListener('message', (event) => {
      const data = event.data || {};
      if (data.requestId && data.requestId !== requestId) return;
      if (data.type === 'progress' || data.type === 'preparing') {
        onStatus('preparing-model', data.progress || 'ブラウザ内のモデルを準備しています…');
      } else if (data.type === 'ready') {
        phase = 'summarizing';
        clearTimeout(preparationTimer);
        onStatus('summarizing', '文章を3つの意味単位にまとめています…');
        generationTimer = setTimeout(() => {
          worker.terminate();
          reject(new Error('Local inference timed out.'));
        }, LOCAL_GENERATION_BUDGET_MS);
      } else if (data.type === 'result') {
        finish(() => resolve({ raw: data.raw, modelId: data.modelId || MODEL_ID, phase }));
      } else if (data.type === 'error') {
        finish(() => reject(new Error(data.message || 'Local inference failed.')));
      }
    });
    worker.addEventListener('error', (event) => finish(() => reject(event.error || new Error('Local worker failed.'))));
    worker.postMessage({ type: 'summarize', requestId, style, slate: buildSlate(text, style) });
  });
}

export async function summarize({ text, style = 'gist', onStatus = () => {}, localRunner = runWorker }) {
  const validation = validateInput(text);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { code: validation.code });
  const started = performance.now();
  onStatus('validating', '入力を確認しています…');
  if (!(await hasWebGPUAdapter())) {
    onStatus('summarizing', 'この環境ではローカル簡易モードでまとめています…');
    return fallbackResult(text, style, started, 'webgpu-unavailable');
  }
  onStatus('preparing-model', 'ブラウザ内のモデルを準備しています…');
  try {
    const modelOutput = await localRunner(text, style, onStatus);
    const parsed = parseModelOutput(modelOutput.raw);
    const valid = validateSummary(parsed, text);
    if (!valid.ok) throw new Error(`Local output rejected: ${valid.reason}`);
    return {
      items: valid.items,
      notes: valid.notes,
      engine: 'local-qwen',
      modelId: modelOutput.modelId,
      elapsedMs: Math.max(0, Math.round(performance.now() - started)),
      preparationState: 'ready',
    };
  } catch (error) {
    onStatus('summarizing', 'ローカルモデルを使えないため、簡易モードに切り替えています…');
    return fallbackResult(text, style, started, `fallback:${error.message}`);
  }
}

export { canUseWebGPU, hasWebGPUAdapter, buildSlate };
