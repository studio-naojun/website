import { summarize } from './summarizer.js?v=1.3.0';
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
const resultMeta = document.querySelector('#result-meta');
const copyButton = document.querySelector('#copy-button');
const errorSection = document.querySelector('#error-section');
const errorDetail = document.querySelector('#error-detail');
const retryButton = document.querySelector('#retry-button');
const feedbackStatus = document.querySelector('#feedback-status');
const badReasons = document.querySelector('#bad-reasons');
const styles = [...document.querySelectorAll('.style-option')];
const state = { style: 'gist', result: null, generationId: null, feedbackRating: null, running: false };

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
}

function selectStyle(style) {
  state.style = style;
  for (const button of styles) {
    const selected = button.dataset.style === style;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-checked', String(selected));
  }
}

function renderResult(result) {
  resultItems.replaceChildren();
  for (const item of result.items) { const li = document.createElement('li'); li.textContent = item; resultItems.append(li); }
  notesItems.replaceChildren();
  for (const note of result.notes) { const li = document.createElement('li'); li.textContent = note; notesItems.append(li); }
  notesSection.hidden = result.notes.length === 0;
  resultMeta.textContent = `端末内要約 / ${result.elapsedMs.toLocaleString('ja-JP')}ms`;
  resultSection.hidden = false;
  errorSection.hidden = true;
  state.result = result;
  state.generationId = makeEventId();
  state.feedbackRating = null;
  feedbackStatus.textContent = '';
  badReasons.hidden = true;
  document.querySelectorAll('.feedback-button').forEach((button) => button.classList.remove('is-selected'));
  document.querySelectorAll('[data-reason]').forEach((button) => button.classList.remove('is-selected'));
}

function showError(error) {
  const knownMessage = error?.message && ['quality-unavailable'].includes(error?.code) ? error.message : null;
  const message = error?.code === 'too-long' ? error.message : knownMessage || '入力した文章は残っています。もう一度試してください。';
  setStatus('再実行できます', message, 'error');
  errorDetail.textContent = message;
  errorSection.hidden = false;
  resultSection.hidden = true;
  state.result = null;
  state.generationId = null;
  if (error?.code === 'too-long') setInputError(message);
}

async function runSummary() {
  if (state.running) return;
  const requestedStyle = state.style;
  const requestedText = source.value;
  setBusy(true);
  setInputError('');
  errorSection.hidden = true;
  resultSection.hidden = true;
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
    renderResult(result);
    setStatus('できました', '入力した文章は外部AIへ送らず、このページ内だけで整理しました。別のまとめ方も選べます。');
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
  if (state.result.notes.length) lines.push('', '備考', ...state.result.notes.map((note) => `・${note}`));
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
form.addEventListener('submit', (event) => { event.preventDefault(); runSummary(); });
retryButton.addEventListener('click', runSummary);
copyButton.addEventListener('click', copyResult);
document.querySelector('#good-button').addEventListener('click', () => sendRating('good'));
document.querySelector('#bad-button').addEventListener('click', () => sendRating('bad'));
document.querySelectorAll('[data-reason]').forEach((button) => button.addEventListener('click', () => sendBadReason(button.dataset.reason)));
styles.forEach((button) => button.addEventListener('click', () => {
  if (state.running) return;
  const nextStyle = button.dataset.style;
  if (nextStyle === state.style && state.result) return;
  selectStyle(nextStyle);
  if (source.value.trim() && state.result) runSummary();
}));
updateCount();
