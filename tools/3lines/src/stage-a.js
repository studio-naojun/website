import { parseSections } from './structure.js';

export const STAGE_A_MAX_CHARS = 1500;
export const STAGE_A_TARGET_MIN_ITEMS = 8;
export const STAGE_A_TARGET_MAX_ITEMS = 12;

const STOP_WORDS = new Set([
  'これ', 'それ', 'この', 'その', 'ため', 'こと', 'もの', 'よう', 'など', 'そして', 'また', 'から', 'まで',
  'する', 'した', 'して', 'いる', 'ある', 'なる', 'れる', 'られる', 'です', 'ます', 'という', 'として', 'について',
  'は', 'が', 'を', 'に', 'で', 'と', 'も', 'の', 'へ', 'や', 'か', 'な', 'だ', 'た', 'て', 'い', 'う',
]);

const SUMMARY_HEADING_RE = /(?:まとめ|要点|結論|明日から|何をするか|最終|総括)/u;
const CORE_HEADING_RE = /(?:ポイント|前提|中心|本質|基準|分水嶺|論点|原則|重要)/u;
const PRACTICAL_HEADING_RE = /(?:実務|推奨|対応|対策|セーフ|アウト|注意|適用|運用|設計|やること)/u;
const LOW_HEADING_RE = /(?:出典|参考|保存|共有|ロードマップ|プロフィール|広告)/u;
const CUE_RE = /(?:要するに|つまり|結論|重要|ポイント|基準|条件|一方|ただし|逆に|したがって|そのため|必要|べき|注意|対応|実務|共通して|明文化|整える|避ける|停止|相談|確認)/u;
const NEGATION_RE = /(?:ない|ず|禁止|困難|不可|例外|ただし|一方|逆に)/u;
const ACTION_RE = /(?:するべき|すべき|必要|確認|整える|明文化|相談|停止|避け|導入|利用|対応|つなぐ|手を止め)/u;

function normalize(value) {
  return String(value || '').normalize('NFKC').replace(/[ \t\u3000]+/gu, ' ').trim();
}

function clip(value, max = 220) {
  const chars = [...normalize(value)];
  if (chars.length <= max) return chars.join('');
  return `${chars.slice(0, max - 1).join('')}…`;
}

function sentenceParts(lines) {
  const parts = [];
  for (const rawLine of lines || []) {
    const line = normalize(rawLine);
    if (!line) continue;
    if (/^(?:[・●▪︎▶︎]|[①-⑳]|\d+[.)]|→|《)/u.test(line) || !/[。！？!?]/u.test(line)) {
      parts.push(line);
      continue;
    }
    for (const match of line.match(/[^。！？!?]+[。！？!?]?/gu) || []) {
      const value = normalize(match);
      if (value) parts.push(value);
    }
  }
  return parts;
}

export function tokenizeJapanese(text) {
  const source = normalize(text).toLocaleLowerCase('ja-JP');
  if (!source) return [];

  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
    const tokens = [];
    for (const segment of segmenter.segment(source)) {
      const token = normalize(segment.segment);
      if (!segment.isWordLike || !token || STOP_WORDS.has(token)) continue;
      if (!/[\p{Letter}\p{Number}]/u.test(token)) continue;
      tokens.push(token);
    }
    if (tokens.length) return tokens;
  }

  return (source.match(/[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}A-Za-z0-9]{2,}/gu) || [])
    .filter((token) => !STOP_WORDS.has(token));
}

function categoryForHeading(heading) {
  const value = normalize(heading);
  if (SUMMARY_HEADING_RE.test(value)) return 'summary';
  if (CORE_HEADING_RE.test(value)) return 'core';
  if (PRACTICAL_HEADING_RE.test(value)) return 'practical';
  return 'context';
}

function headingWeight(heading, category, style) {
  const value = normalize(heading);
  let score = category === 'summary' ? 10 : category === 'core' ? 8 : category === 'practical' ? 5 : 1;
  if (style === 'points' && category === 'core') score += 3;
  if ((style === 'gist' || style === 'easy') && category === 'summary') score += 3;
  if (/ポイント/u.test(value)) score += 2;
  if (/結論|まとめ|要点/u.test(value)) score += 3;
  if (LOW_HEADING_RE.test(value)) score -= 8;
  return score;
}

function cueWeight(sentence) {
  const value = normalize(sentence);
  let score = 0;
  if (CUE_RE.test(value)) score += 2.5;
  if (NEGATION_RE.test(value)) score += 1.5;
  if (ACTION_RE.test(value)) score += 2;
  if (/\d|[０-９]/u.test(value)) score += 0.7;
  if ([...value].length >= 24 && [...value].length <= 180) score += 1.4;
  if ([...value].length < 12) score -= 2.5;
  if (/^(?:出典|保存して|共有して|https?:\/\/)/iu.test(value)) score -= 7;
  return score;
}

function lexicalScore(tokens, frequencies) {
  if (!tokens.length) return 0;
  let total = 0;
  for (const token of tokens) total += Math.log1p(frequencies.get(token) || 0);
  return total / Math.sqrt(tokens.length);
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const value of a) if (b.has(value)) shared += 1;
  return shared / (a.size + b.size - shared);
}

function makeCandidates(text, style) {
  const parsed = parseSections(text);
  const raw = [];
  let order = 0;

  parsed.sections.forEach((section, sectionIndex) => {
    const category = categoryForHeading(section.heading);
    const parts = sentenceParts(section.body);
    parts.forEach((sentence, sentenceIndex) => {
      const tokens = tokenizeJapanese(sentence);
      raw.push({
        sentence,
        tokens,
        tokenSet: new Set(tokens),
        heading: normalize(section.heading || '本文'),
        category,
        sectionIndex,
        sentenceIndex,
        order: order++,
      });
    });
  });

  const frequencies = new Map();
  for (const candidate of raw) {
    for (const token of candidate.tokens) frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  for (const candidate of raw) {
    candidate.score = lexicalScore(candidate.tokens, frequencies)
      + headingWeight(candidate.heading, candidate.category, style)
      + cueWeight(candidate.sentence)
      + (candidate.sentenceIndex === 0 ? 0.8 : 0);
  }

  return { title: normalize(parsed.title), candidates: raw };
}

function distinctBySection(candidates, category, limit) {
  const result = [];
  const used = new Set();
  for (const candidate of candidates.filter((item) => item.category === category).sort((a, b) => b.score - a.score || a.order - b.order)) {
    if (used.has(candidate.sectionIndex)) continue;
    result.push(candidate);
    used.add(candidate.sectionIndex);
    if (result.length >= limit) break;
  }
  return result;
}

function selectCandidates(candidates, style) {
  const ranked = [...candidates].sort((a, b) => b.score - a.score || a.order - b.order);
  const selected = [];
  const ids = new Set();
  const add = (candidate) => {
    if (!candidate) return;
    const id = `${candidate.sectionIndex}:${candidate.sentenceIndex}`;
    if (ids.has(id)) return;
    selected.push(candidate);
    ids.add(id);
  };

  if (style === 'gist' || style === 'easy' || style === 'faithful') {
    distinctBySection(ranked, 'core', 3).forEach(add);
    distinctBySection(ranked, 'summary', 2).forEach(add);
    distinctBySection(ranked, 'practical', 1).forEach(add);
  } else {
    distinctBySection(ranked, 'core', 3).forEach(add);
    distinctBySection(ranked, 'practical', 2).forEach(add);
    distinctBySection(ranked, 'summary', 1).forEach(add);
  }

  while (selected.length < STAGE_A_TARGET_MAX_ITEMS) {
    let best = null;
    let bestScore = -Infinity;
    for (const candidate of ranked) {
      const id = `${candidate.sectionIndex}:${candidate.sentenceIndex}`;
      if (ids.has(id)) continue;
      const maxSimilarity = selected.length
        ? Math.max(...selected.map((chosen) => jaccard(candidate.tokenSet, chosen.tokenSet)))
        : 0;
      const sectionRepeat = selected.some((chosen) => chosen.sectionIndex === candidate.sectionIndex) ? 1.2 : 0;
      const mmr = candidate.score - (5.5 * maxSimilarity) - sectionRepeat;
      if (mmr > bestScore) { best = candidate; bestScore = mmr; }
    }
    if (!best) break;
    add(best);
  }

  return selected.sort((a, b) => a.order - b.order);
}

export function buildHierarchicalDigest(text, style = 'gist', maxChars = STAGE_A_MAX_CHARS) {
  const { title, candidates } = makeCandidates(text, style);
  const selected = selectCandidates(candidates, style);
  const lines = [];
  let used = 0;

  if (title) {
    const titleLine = `[TITLE] ${clip(title, 160)}`;
    if ([...titleLine].length <= maxChars) {
      lines.push(titleLine);
      used += [...titleLine].length + 1;
    }
  }

  let included = 0;
  for (const candidate of selected) {
    const line = `[${candidate.heading || '本文'}] ${clip(candidate.sentence, 220)}`;
    const length = [...line].length + 1;
    if (used + length > maxChars) continue;
    lines.push(line);
    used += length;
    included += 1;
  }

  if (included < Math.min(STAGE_A_TARGET_MIN_ITEMS, candidates.length)) {
    for (const candidate of [...candidates].sort((a, b) => b.score - a.score || a.order - b.order)) {
      if (lines.some((line) => line.includes(clip(candidate.sentence, 220)))) continue;
      const line = `[${candidate.heading || '本文'}] ${clip(candidate.sentence, 220)}`;
      const length = [...line].length + 1;
      if (used + length > maxChars) continue;
      lines.push(line);
      used += length;
      included += 1;
      if (included >= STAGE_A_TARGET_MIN_ITEMS) break;
    }
  }

  return lines.join('\n');
}
