import { APP_VERSION } from './summarizer.js';

export const FEEDBACK_FIELDS = [
  'schema_version', 'server_timestamp', 'event_id', 'rating', 'style', 'bad_reason',
  'app_version', 'engine', 'model_id', 'latency_bucket',
];

const ENDPOINT = globalThis.THREELINES_CONFIG?.feedbackEndpoint || '';
const styles = new Set(['gist', 'points', 'easy', 'faithful']);
const ratings = new Set(['good', 'bad']);
const reasons = new Set(['wrong', 'missing', 'unclear', 'too_short', 'other', 'empty']);
const engines = new Set(['local-qwen', 'extractive-fallback']);

export function makeEventId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function latencyBucket(elapsedMs) {
  if (elapsedMs < 1000) return '<1s';
  if (elapsedMs < 5000) return '1-5s';
  if (elapsedMs < 15000) return '5-15s';
  if (elapsedMs < 30000) return '15-30s';
  return '>=30s';
}

export function serializeFeedback(input) {
  const payload = {
    schema_version: '1',
    server_timestamp: '',
    event_id: String(input?.event_id || makeEventId()).slice(0, 80),
    rating: ratings.has(input?.rating) ? input.rating : '',
    style: styles.has(input?.style) ? input.style : '',
    bad_reason: reasons.has(input?.bad_reason) ? input.bad_reason : 'empty',
    app_version: APP_VERSION,
    engine: engines.has(input?.engine) ? input.engine : 'extractive-fallback',
    model_id: input?.engine === 'local-qwen' ? String(input?.model_id || '').slice(0, 120) : '',
    latency_bucket: latencyBucket(Number(input?.elapsedMs) || 0),
  };
  if (!payload.rating || !payload.style) throw new Error('Feedback rating and style are required.');
  return payload;
}

export async function submitFeedback(input) {
  const payload = serializeFeedback(input);
  if (!ENDPOINT) return { ok: false, status: 'unavailable', payload };
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return { ok: true, status: 'sent', payload };
  } catch (error) {
    return { ok: false, status: 'failed', error, payload };
  }
}
