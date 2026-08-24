import { normalizeForAnalysis, segmentSentences, tokenize } from './normalizer.js';

const CUES = ['要するに', 'つまり', '結論', 'したがって', 'このため', '一方', 'ただし', 'しかし', '重要なのは'];
const QUALIFIERS = ['ただし', 'しかし', '一方', '場合', '限り', '可能性', 'とは限ら', '必ずしも', '原則', '条件', '〜なら', 'ならば'];
const NEGATIONS = ['ない', 'ません', 'ぬ', 'ず', '否定', '難しい'];
const BOILERPLATE = ['ご覧いただき', 'よろしくお願いいたします', '詳しくは', 'お問い合わせ', '参考になれば'];

function ngrams(tokens) {
  const result = new Set(tokens);
  for (let i = 0; i < tokens.length - 1; i += 1) result.add(`${tokens[i]}${tokens[i + 1]}`);
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
  return text.split(/(?<=[、，,：:])\s*|(?=ただし|しかし|一方)/u).map((part) => part.trim()).filter((part) => part.length >= 4);
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

function selectSentences(sentences, style) {
  const allTokens = new Set(sentences.flatMap((sentence) => [...ngrams(new Set(tokenize(sentence.text)))]));
  const scored = sentences.map((sentence, index) => ({ sentence, index, score: scoreSentence(sentence, index, sentences.length, allTokens, style), tokens: new Set(tokenize(sentence.text)) }));
  const selected = [];
  while (selected.length < Math.min(3, scored.length)) {
    const available = scored.filter((candidate) => !selected.includes(candidate));
    if (!available.length) break;
    available.sort((a, b) => {
      const aMmr = a.score - Math.max(0, ...selected.map((picked) => sharedRatio(a.tokens, picked.tokens))) * (style === 'points' ? 1.4 : 0.7);
      const bMmr = b.score - Math.max(0, ...selected.map((picked) => sharedRatio(b.tokens, picked.tokens))) * (style === 'points' ? 1.4 : 0.7);
      return bMmr - aMmr || a.index - b.index;
    });
    selected.push(available[0]);
  }
  return { selected };
}

function deriveNotes(sentences, selected) {
  const selectedIndexes = new Set(selected.map(({ index }) => index));
  return sentences.filter(({ text }, index) => !selectedIndexes.has(index) && QUALIFIERS.some((cue) => text.includes(cue))).map(({ text }) => shorten(text, 100)).filter((note, index, list) => list.indexOf(note) === index).slice(0, 3);
}

function ensureThree(sentences, selected, style) {
  const units = selected.map(({ sentence }) => style === 'easy' ? simplify(sentence.text) : sentence.text);
  if (units.length === 3) return units;
  const source = sentences[0]?.text || '';
  for (const clause of clauseParts(source)) if (units.length < 3 && !units.includes(clause)) units.push(clause);
  while (units.length < 3) units.push(units.length === 0 ? source : `原文に含まれる主張は${units.length}点目です。`);
  return units.slice(0, 3);
}

export function summarizeExtractively(text, style = 'gist') {
  const started = globalThis.performance?.now?.() ?? Date.now();
  const normalized = normalizeForAnalysis(text);
  const sentences = segmentSentences(normalized);
  const { selected } = selectSentences(sentences, style);
  const items = ensureThree(sentences, selected, style).map((item) => shorten(item));
  const notes = deriveNotes(sentences, selected);
  const ended = globalThis.performance?.now?.() ?? Date.now();
  return { items, notes, engine: 'extractive-fallback', modelId: null, elapsedMs: Math.max(0, Math.round(ended - started)), preparationState: 'fallback' };
}
