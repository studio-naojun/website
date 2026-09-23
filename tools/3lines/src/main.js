import { summarize } from './summarizer.js?v=1.7.0';
import { submitFeedback, makeEventId } from './feedback.js';
import { MAX_INPUT_CHARS } from './normalizer.js';

const form = document.querySelector('#summary-form');
const source = document.querySelector('#source-text');
const charCount = document.querySelector('#char-count');
const inputError = document.querySelector('#input-error');
const submitButton = document.querySelector('#summarize-button');
const statusCard = document.querySelector('.status-card');
const statusLabel = document.querySelector('#status-label');
const statusDetail = document.querySelector('#status-detail');
const resultSection = document.querySelector('#result-section');
const resultItems = document.querySelector('#result-items');
const notesSection = document.querySelector('#notes-section');
const notesItems = document.querySelector('#notes-items');
const detailControl = document.querySelector('#detail-control');
const detailToggle = document.querySelector('#detail-toggle');
const detailSection = document.querySelector('#detail-section');
const detailText = document.querySelector('#detail-text');
const resultMeta = document.querySelector('#result-meta');
const copyButton = document.querySelector('#copy-button');
const errorSection = document.querySelector('#error-section');
const errorDetail = document.querySelector('#error-detail');
const retryButton = document.querySelector('#retry-button');
const feedbackStatus = document.querySelector('#feedback-status');
const badReasons = document.querySelector('#bad-reasons');
const styles = [...document.querySelectorAll('.style-option')];
const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
const state = { style: 'gist', result: null, generationId: null, feedbackRating: null, running: false, detailOpen: false };

function setStatus(label, detail, mode = 'ready') {
  statusLabel.textContent = label;
  statusDetail.textContent = detail;
  statusCard.classList.toggle('is-busy', mode === 'busy');
  statusCard.classList.toggle('is-error', mode === 'error');
}

function setInputError(message = '') { inputError.textContent = message; inputError.hidden = !message; }

function updateCount() {
  const length = [...source.value].length;
  charCount.textContent = `${length.toLocaleString('ja-JP')} / ${MAX_INPUT_CHARS.toLocaleString('ja-JP')}`;
  charCount.classList.toggle('is-over', length > MAX_INPUT_CHARS);
}

function setBusy(busy) {
  state.running = busy;
  submitButton.disabled = busy;
  retryButton.disabled = busy;
  source.readOnly = busy;
  form.setAttribute('aria-busy', String(busy));
  for (const button of styles) button.disabled = busy;
  detailToggle.disabled = busy;
}

function selectStyle(style) {
  state.style = style;
  for (const button of styles) {
    const selected = button.dataset.style === style;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
  }
}

function focusResult() {
  if (resultSection.hidden) return;
  resultSection.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  requestAnimationFrame(() => resultSection.focus({ preventScroll: true }));
}

function setDetailOpen(open) {
  const available = Boolean(state.result?.detail?.trim());
  state.detailOpen = available && Boolean(open);
  detailSection.hidden = !state.detailOpen;
  detailToggle.setAttribute('aria-expanded', String(state.detailOpen));
  detailToggle.textContent = state.detailOpen ? '要約文を閉じる' : '要約文を見る';
}

function renderResult(result, { focus = true, preserveDetail = false } = {}) {
  const keepDetailOpen = preserveDetail && state.detailOpen;
  resultItems.replaceChildren();
  for (const item of result.items) { const li = document.createElement('li'); li.textContent = item; resultItems.append(li); }
  notesItems.replaceChildren();
  for (const note of result.notes) { const li = document.createElement('li'); li.textContent = note; notesItems.append(li); }
  notesSection.hidden = result.notes.length === 0;
  detailText.textContent = result.detail || '';
  detailControl.hidden = !result.detail?.trim();
  resultMeta.textContent = `端末内要約 / ${result.elapsedMs.toLocaleString('ja-JP')}ms`;
  resultSection.hidden = false;
  resultSection.classList.remove('is-updating');
  errorSection.hidden = true;
  state.result = result;
  setDetailOpen(keepDetailOpen);
  state.generationId = makeEventId();
  state.feedbackRating = null;
  feedbackStatus.textContent = '';
  badReasons.hidden = true;
  document.querySelectorAll('.feedback-button').forEach((button) => button.classList.remove('is-selected'));
  document.querySelectorAll('[data-reason]').forEach((button) => button.classList.remove('is-selected'));
  if (focus) focusResult();
}

function showError(error) {
  const knownMessage = error?.message && ['quality-unavailable'].includes(error?.code) ? error.message : null;
  const message = error?.code === 'too-long' ? error.message : knownMessage || '入力した文章は残っています。もう一度試してください。';
  setStatus('再実行できます', message, 'error');
  errorDetail.textContent = message;
  errorSection.hidden = false;
  resultSection.hidden = true;
  resultSection.classList.remove('is-updating');
  state.result = null;
  state.generationId = null;
  state.detailOpen = false;
  detailSection.hidden = true;
  if (error?.code === 'too-long') setInputError(message);
}

async function runSummary({ preserveResult = false, focus = true } = {}) {
  if (state.running) return;
  const requestedStyle = state.style;
  const requestedText = source.value;
  const keepVisible = preserveResult && Boolean(state.result) && !resultSection.hidden;
  setBusy(true);
  setInputError('');
  errorSection.hidden = true;
  if (keepVisible) {
    resultSection.classList.add('is-updating');
    resultMeta.textContent = 'まとめ方を切り替えています…';
  } else {
    resultSection.hidden = true;
  }
  setStatus('処理を開始しました', '入力を確認しています…', 'busy');
  await new Promise((resolve) => requestAnimationFrame(resolve));
  try {
    const result = await summarize({
      text: requestedText,
      style: requestedStyle,
      onStatus: (mode, detail) => {
        const labels = { validating: '入力を確認しています', extracting: '重要部分を整理中' };
        setStatus(labels[mode] || '処理中', detail, 'busy');
      },
    });
    renderResult(result, { focus, preserveDetail: preserveResult });
    setStatus('できました', '3行の補足や「要約文を見る」から、必要な分だけ詳しく確認できます。');
  } catch (error) {
    if (error?.code === 'blank' || error?.code === 'too-long') setInputError(error.message);
    showError(error);
  } finally {
    setBusy(false);
  }
}

function resultText() {
  if (!state.result) return '';
  const lines = state.result.items.map((item, index) => `${index + 1}. ${item}`);
  if (state.result.notes.length) lines.push('', '補足', ...state.result.notes.map((note) => `・${note}`));
  if (state.detailOpen && state.result.detail) lines.push('', '要約文', state.result.detail);
  return lines.join('\n');
}

async function copyResult() {
  try { await navigator.clipboard.writeText(resultText()); }
  catch {
    const helper = document.createElement('textarea'); helper.value = resultText(); helper.style.position = 'fixed'; helper.style.opacity = '0'; document.body.append(helper); helper.select(); document.execCommand('copy'); helper.remove();
  }
  const original = copyButton.textContent; copyButton.textContent = 'コピーしました'; setTimeout(() => { copyButton.textContent = original; }, 1600);
}

async function sendRating(rating, badReason = 'empty') {
  if (!state.result || state.feedbackRating) return;
  state.feedbackRating = rating;
  document.querySelector(`[data-rating="${rating}"]`)?.classList.add('is-selected');
  if (rating === 'bad') badReasons.hidden = false;
  const outcome = await submitFeedback({ event_id: state.generationId, rating, style: state.style, bad_reason: badReason, engine: state.result.engine, model_id: state.result.modelId, elapsedMs: state.result.elapsedMs });
  feedbackStatus.textContent = outcome.status === 'unavailable' ? '評価を受け付けました（集計先は未設定です）。' : outcome.status === 'failed' ? '評価は端末内で確認しましたが、集計先へ送信できませんでした。' : '評価を受け付けました。';
}

async function sendBadReason(reason) {
  if (state.feedbackRating !== 'bad' || !state.result) return;
  document.querySelectorAll('[data-reason]').forEach((button) => button.classList.toggle('is-selected', button.dataset.reason === reason));
  const outcome = await submitFeedback({ event_id: state.generationId, rating: 'bad', bad_reason: reason, style: state.style, engine: state.result.engine, model_id: state.result.modelId, elapsedMs: state.result.elapsedMs });
  feedbackStatus.textContent = outcome.status === 'unavailable' ? '理由を受け付けました（集計先は未設定です）。' : outcome.status === 'failed' ? '理由は確認しましたが、集計先へ送信できませんでした。' : '理由も受け付けました。';
}

source.addEventListener('input', updateCount);
form.addEventListener('submit', (event) => { event.preventDefault(); runSummary({ preserveResult: false, focus: true }); });
retryButton.addEventListener('click', () => runSummary({ preserveResult: false, focus: true }));
copyButton.addEventListener('click', copyResult);
detailToggle.addEventListener('click', () => setDetailOpen(!state.detailOpen));
document.querySelector('#good-button').addEventListener('click', () => sendRating('good'));
document.querySelector('#bad-button').addEventListener('click', () => sendRating('bad'));
document.querySelectorAll('[data-reason]').forEach((button) => button.addEventListener('click', () => sendBadReason(button.dataset.reason)));
styles.forEach((button) => button.addEventListener('click', () => {
  if (state.running) return;
  const nextStyle = button.dataset.style;
  if (nextStyle === state.style && state.result) { focusResult(); return; }
  selectStyle(nextStyle);
  if (source.value.trim() && state.result) runSummary({ preserveResult: true, focus: true });
}));
updateCount();
