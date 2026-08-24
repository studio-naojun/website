import { normalizeForAnalysis, segmentSentences, tokenize } from './normalizer.js';

const CUES = ['要するに', 'つまり', '結論', 'したがって', 'このため', 'そのため', '一方', 'ただし', 'しかし', '重要なのは'];
const QUALIFIERS = ['ただし', 'しかし', '一方', '場合', '限り', '可能性', 'とは限ら', '必ずしも', '原則', '条件', '〜なら', 'ならば'];
const NEGATIONS = ['ない', 'ません', 'ぬ', 'ず', '否定', '難しい'];
const BOILERPLATE = ['ご覧いただき', 'よろしくお願いいたします', '詳しくは', 'お問い合わせ', '参考になれば'];

function ngrams(tokens) {
  const list = [...tokens];
  const result = new Set(list);
  for (let i = 0; i < list.length - 1; i += 1) result.add(`${list[i]}${list[i + 1]}`);
  return result;
}

function sharedRatio(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const token of a) if (b.has(token)) shared += 1;
  return shared / Math.max(1, Math.min(a.size, b.size));
}

function simplify(text) {
  return text.replace(/（[^）]{1,32}）/gu, '').replace(/\([^)]{1,32}\)/gu, '').replace(/^(?:結論から言うと|要するに|つまり)[、,:：]?\s*/u, '').replace(/\s+/g, ' ').trim();
}

function shorten(text, max = 120) {
  const value = text.replace(/\s+/g, ' ').trim();
  if ([...value].length <= max) return value;
  const slice = [...value].slice(0, max - 1).join('');
  const boundary = Math.max(slice.lastIndexOf('、'), slice.lastIndexOf('。'), slice.lastIndexOf(' '));
  return `${(boundary > max * 0.55 ? slice.slice(0, boundary) : slice).trim()}…`;
}

function clauseParts(text) {
  return text
    .split(/(?<=[、，,；;：:])\s*|(?=ただし|しかし|一方|そのため|このため|したがって|また|そして)/u)
    .map((part) => part.trim())
    .filter((part) => [...part].length >= 4);
}

function scoreSentence(sentence, index, total, allTokens, style) {
  const text = sentence.text;
  const tokens = new Set(tokenize(text));
  const centrality = sharedRatio(ngrams(tokens), allTokens);
  const cueScore = CUES.reduce((sum, cue) => sum + (text.includes(cue) ? 1 : 0), 0);
  const qualifierScore = QUALIFIERS.reduce((sum, cue) => sum + (text.includes(cue) ? 1 : 0), 0);
  const negationScore = NEGATIONS.reduce((sum, cue) => sum + (text.includes(cue) ? 1 : 0), 0);
  const numberScore = /\d|[一二三四五六七八九十百千万億%％]/u.test(text) ? 0.5 : 0;
  const positionScore = index === 0 ? 0.35 : index === total - 1 ? 0.65 : 0;
  const boilerplatePenalty = BOILERPLATE.some((cue) => text.includes(cue)) ? 1.3 : 0;
  const quotePenalty = /^>[ ]?/u.test(text) || (text.startsWith('「') && text.endsWith('」')) ? 0.25 : 0;
  let styleScore = 0;
  if (style === 'gist') styleScore = cueScore * 1.6 + positionScore;
  if (style === 'points') styleScore = centrality * 1.6 + positionScore;
  if (style === 'easy') styleScore = centrality * 1.2 + positionScore;
  if (style === 'faithful') styleScore = qualifierScore * 1.3 + negationScore * 0.9 + numberScore + positionScore;
  return styleScore + centrality * 2 + qualifierScore * 0.7 + negationScore * 0.35 + numberScore - boilerplatePenalty - quotePenalty;
}

function rankSentences(sentences, style, limit = sentences.length) {
  const allTokens = new Set(sentences.flatMap((sentence) => [...ngrams(new Set(tokenize(sentence.text)))]));
  const scored = sentences.map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, index, sentences.length, allTokens, style), tokens: new Set(tokenize(sentence.text)) }));
  const ranked = [];
  while (ranked.length < Math.min(limit, scored.length)) {
    const available = scored.filter((candidate) => !ranked.includes(candidate));
    if (!available.length) break;
    available.sort((a, b) => {
      const diversityWeight = style === 'points' ? 1.4 : 0.7;
      const aMmr = a.score - Math.max(0, ...ranked.map((picked) => sharedRatio(a.tokens, picked.tokens))) * diversityWeight;
      const bMmr = b.score - Math.max(0, ...ranked.map((picked) => sharedRatio(b.tokens, picked.tokens))) * diversityWeight;
      return bMmr - aMmr || a.index - b.index;
    });
    ranked.push(available[0]);
  }
  return ranked;
}

function selectSentences(sentences, style) { return { selected: rankSentences(sentences, style, 3) }; }

function deriveNotes(sentences, selected) {
  const selectedIndexes = new Set(selected.map(({ index }) => index));
  return sentences.filter(({ text }, index) => !selectedIndexes.has(index) && QUALIFIERS.some((cue) => text.includes(cue))).map(({ text }) => shorten(text, 100)).filter((note, index, list) => list.indexOf(note) === index).slice(0, 3);
}

function splitVerbatim(text, parts = 3) {
  const chars = [...String(text).trim()];
  if (!chars.length) return [];
  if (chars.length <= parts) return chars;
  const result = [];
  let start = 0;
  for (let i = 1; i < parts; i += 1) {
    const target = Math.round((chars.length * i) / parts);
    let cut = target;
    for (let radius = 0; radius <= 12; radius += 1) {
      const left = target - radius;
      const right = target + radius;
      if (left > start + 2 && /[、，,；;：:\s]/u.test(chars[left - 1] || '')) { cut = left; break; }
      if (right < chars.length - 2 && /[、，,；;：:\s]/u.test(chars[right - 1] || '')) { cut = right; break; }
    }
    result.push(chars.slice(start, cut).join('').trim());
    start = cut;
  }
  result.push(chars.slice(start).join('').trim());
  return result.filter(Boolean);
}

function ensureThree(sentences, selected, style) {
  const transform = (value) => style === 'easy' ? simplify(value) : value.trim();
  if (selected.length >= 3) return selected.slice(0, 3).map(({ sentence }) => transform(sentence.text));

  const candidates = [];
  const add = (value) => {
    const transformed = transform(value);
    if (!transformed || [...transformed].length < 2) return;
    if (!candidates.some((item) => item === transformed)) candidates.push(transformed);
  };

  for (const { sentence } of selected) for (const part of clauseParts(sentence.text)) add(part);
  for (const sentence of sentences) for (const part of clauseParts(sentence.text)) add(part);
  for (const sentence of sentences) for (const part of splitVerbatim(sentence.text, 3)) add(part);
  for (const { sentence } of selected) add(sentence.text);
  for (const sentence of sentences) add(sentence.text);

  return candidates.slice(0, 3);
}

export function buildRankedSlate(text, style = 'gist', maxChars = 4000) {
  const normalized = normalizeForAnalysis(text);
  const sentences = segmentSentences(normalized);
  const ranked = rankSentences(sentences, style, Math.min(sentences.length, 24));
  const lines = [];
  let used = 0;
  for (const candidate of ranked) {
    const line = `[S${candidate.index + 1}] ${candidate.sentence.text}`;
    const extra = line.length + (lines.length ? 1 : 0);
    if (used + extra > maxChars) continue;
    lines.push(line);
    used += extra;
  }
  if (!lines.length && normalized) return [...normalized].slice(0, maxChars).join('');
  return lines.join('\n');
}

export function summarizeExtractively(text, style = 'gist') {
  const started = globalThis.performance?.now?.() ?? Date.now();
  const normalized = normalizeForAnalysis(text);
  const sentences = segmentSentences(normalized);
  const { selected } = selectSentences(sentences, style);
  const items = ensureThree(sentences, selected, style).map((item) => shorten(item, 100));
  const notes = deriveNotes(sentences, selected);
  const ended = globalThis.performance?.now?.() ?? Date.now();
  return { items, notes, engine: 'extractive-fallback', modelId: null, elapsedMs: Math.max(0, Math.round(ended - started)), preparationState: 'fallback' };
}
