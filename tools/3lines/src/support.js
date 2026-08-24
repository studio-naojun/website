import { buildRankedSlate } from './fallback.js';
import { normalizeForAnalysis, segmentSentences, tokenize } from './normalizer.js';

const QUALIFIER_RE = /(?:ただし|しかし|一方|例外|場合|限り|可能性|とは限ら|必ずしも|原則|条件|なお|留意|注意|認識|認容|運用|実際の使われ方)/u;
const MAX_NOTES = 3;
const MAX_NOTES_TOTAL = 300;
const MAX_NOTE_LENGTH = 100;
const MAX_DETAIL_LENGTH = 900;
const DETAIL_SENTENCES = 7;

function clean(value) {
  return String(value || '').normalize('NFKC').replace(/[ \t\u3000]+/gu, ' ').trim();
}

function stripLabel(value) {
  return clean(value).replace(/^(?:全体|肝|結局|何の話\?|大事なのは、|つまり、|基準|留保|論点[1-3][|｜][^?？]*[?？])\s*[:：]?\s*/u, '');
}

function shorten(value, max = MAX_NOTE_LENGTH) {
  const text = clean(value);
  if ([...text].length <= max) return text;
  const slice = [...text].slice(0, max - 1).join('');
  const boundary = Math.max(slice.lastIndexOf('、'), slice.lastIndexOf('。'), slice.lastIndexOf(' '));
  return `${(boundary > max * 0.55 ? slice.slice(0, boundary) : slice).trim()}…`;
}

function tokenOverlap(a, b) {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

function isAlreadyCovered(sentence, items) {
  const candidate = stripLabel(sentence);
  return items.some((item) => {
    const core = stripLabel(item);
    if (!core || !candidate) return false;
    if (core.includes(candidate) || candidate.includes(core)) return true;
    return tokenOverlap(candidate, core) >= 0.72;
  });
}

function deriveNotes(text, items) {
  const normalized = normalizeForAnalysis(text);
  const sentences = segmentSentences(normalized);
  const focus = items.join(' ');
  const candidates = sentences
    .map((sentence, index) => ({ text: clean(sentence.text), index }))
    .filter(({ text: value }) => value && QUALIFIER_RE.test(value) && !isAlreadyCovered(value, items))
    .map((candidate) => ({
      ...candidate,
      score: tokenOverlap(candidate.text, focus) * 4
        + (/(?:ただし|例外|とは限ら|必ずしも)/u.test(candidate.text) ? 2 : 0)
        + (/(?:条件|場合|限り|原則)/u.test(candidate.text) ? 1.2 : 0)
        + (/(?:認識|認容|運用|実際の使われ方)/u.test(candidate.text) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index);

  const notes = [];
  let total = 0;
  for (const candidate of candidates) {
    const note = shorten(candidate.text);
    if (!note || notes.includes(note)) continue;
    if (notes.some((existing) => tokenOverlap(existing, note) >= 0.75)) continue;
    if (total + [...note].length > MAX_NOTES_TOTAL) continue;
    notes.push(note);
    total += [...note].length;
    if (notes.length >= MAX_NOTES) break;
  }
  return notes;
}

function rankedDetailCandidates(text) {
  const slate = buildRankedSlate(text, 'gist', 4000);
  return slate
    .split(/\r?\n/u)
    .map((line) => line.match(/^\[S(\d+)\]\s+(.+)$/u))
    .filter(Boolean)
    .map((match) => ({ index: Number(match[1]), text: clean(match[2]) }))
    .filter(({ text: value }) => [...value].length >= 18)
    .slice(0, 16);
}

function buildDetailedSummary(text) {
  const ranked = rankedDetailCandidates(text);
  if (!ranked.length) return shorten(normalizeForAnalysis(text), MAX_DETAIL_LENGTH);

  const picked = [];
  let total = 0;
  for (const candidate of ranked) {
    if (picked.some((existing) => tokenOverlap(existing.text, candidate.text) >= 0.82)) continue;
    const length = [...candidate.text].length;
    if (total + length > MAX_DETAIL_LENGTH && picked.length >= 4) continue;
    picked.push(candidate);
    total += length;
    if (picked.length >= DETAIL_SENTENCES || total >= MAX_DETAIL_LENGTH * 0.8) break;
  }

  picked.sort((a, b) => a.index - b.index);
  const paragraphs = [];
  for (let i = 0; i < picked.length; i += 3) {
    paragraphs.push(picked.slice(i, i + 3).map(({ text: value }) => value).join(''));
  }
  return paragraphs.join('\n\n');
}

export function buildSupportLayer(text, items) {
  return {
    notes: deriveNotes(text, items),
    detail: buildDetailedSummary(text),
  };
}
