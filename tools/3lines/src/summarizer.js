import { validateInput } from './normalizer.js';
import { validateSummary } from './validator.js';
import { validateStructuredCoverage } from './structure.js?v=1.3.1';
import { composeThreeLines } from './composer.js?v=1.3.1';

export const APP_VERSION = '1.3.1';
export const MODEL_ID = 'none';

function typedError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

export async function summarize({ text, style = 'gist', onStatus = () => {} }) {
  const validation = validateInput(text);
  if (!validation.ok) throw Object.assign(new Error(validation.message), { code: validation.code });

  const started = performance.now();
  onStatus('validating', '入力を確認しています…');
  await Promise.resolve();
  onStatus('extracting', '文章全体から重要な意味を整理しています…');

  const composed = composeThreeLines(text, style);
  const valid = validateSummary(composed, text);
  if (!valid.ok) {
    throw typedError('quality-unavailable', '十分に分かりやすい3行を作れませんでした。入力は残っています。');
  }

  const coverage = validateStructuredCoverage(valid, text, style);
  if (!coverage.ok) {
    throw typedError('quality-unavailable', '文章全体の要点を3行にまとめきれませんでした。入力は残っています。');
  }

  return {
    items: valid.items,
    notes: valid.notes,
    engine: 'deterministic-semantic-composer',
    modelId: 'none',
    elapsedMs: Math.max(0, Math.round(performance.now() - started)),
    preparationState: 'not-required',
  };
}

export { composeThreeLines } from './composer.js?v=1.3.1';
