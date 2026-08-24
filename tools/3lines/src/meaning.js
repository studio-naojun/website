import { parseSections } from './structure.js?v=1.0.3';

function normalize(value) {
  return String(value).normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function cleanHeading(value) {
  return normalize(value)
    .replace(/^[■◆●▲▼◇□▪︎▶︎#\s]+/u, '')
    .replace(/^ポイント\d+\s*[:：]?\s*/u, '')
    .replace(/^(?:まとめ|要点|結論)\s*[:：]?\s*/u, '')
    .trim();
}

function topicFromTitle(title) {
  let value = normalize(title).replace(/^【[^】]+】/u, '').trim();
  const parts = value.split('──');
  if (parts.length > 1) {
    const tail = parts.at(-1)
      .replace(/（.*$/u, '')
      .replace(/を(?:全部)?まとめた.*$/u, '')
      .trim();
    if ([...tail].length >= 8 && [...tail].length <= 48) return tail;
  }
  value = value.replace(/（.*$/u, '').trim();
  return [...value].slice(0, 42).join('').replace(/[、,:：\-—–]+$/u, '');
}

function splitSentences(lines) {
  return lines.flatMap((line) => {
    if (/^[・→]/u.test(line) || !/[。！？!?]/u.test(line)) return [line.trim()];
    return (line.match(/[^。！？!?]+[。！？!?]?/gu) || [line]).map((part) => part.trim()).filter(Boolean);
  });
}

function sentenceScore(sentence, heading) {
  const text = normalize(sentence);
  const head = normalize(heading);
  let score = 0;
  const length = [...text].length;
  if (length >= 18 && length <= 190) score += 2;
  if (/事件性|価値中立|認識・認容|法律事務|提供者|利用者|用法|運用|条件|分水嶺/u.test(text)) score += 4;
  if (/評価するのは困難|評価せざる|評価され得る|直ちに|とは限ら|必要/u.test(text)) score += 5;
  if (/価値中立|分水嶺/u.test(head) && /基準.*価値中立|価値中立.*考え方/u.test(text)) score -= 5;
  if (/用法|運用/u.test(head) && /運用の実態まで/u.test(text)) score -= 2;
  if (/今回いちばん|見落とされそう|強調して|個人的には/u.test(text)) score -= 6;
  return score;
}

function bestRepresentative(section) {
  const candidates = splitSentences(section.body || []);
  return candidates
    .map((sentence, index) => ({ sentence, index, score: sentenceScore(sentence, section.heading) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)[0]?.sentence || '';
}

function corePriority(section) {
  const heading = normalize(section.heading);
  if (/価値中立|分水嶺/u.test(heading)) return 0;
  if (/用法|運用/u.test(heading)) return 1;
  if (/利用者|提供者|入力/u.test(heading)) return 2;
  return 3;
}

function compactRepresentative(value, max = 86) {
  let text = normalize(value)
    .replace(/^そもそも/u, '')
    .replace(/、?としています。?$/u, '。')
    .replace(/、?とされています。?$/u, '。')
    .trim();
  if ([...text].length <= max) return text;
  const clauses = text.split('、').map((part) => part.trim()).filter(Boolean);
  if (clauses.length >= 3) {
    const first = clauses[0];
    const material = clauses.slice(1).filter((clause) => /提供者|法律事務|評価|認識・認容|事件性|困難|条件|必要/u.test(clause));
    const last = material.at(-1);
    if (last) {
      const joined = `${first}、${last}`.replace(/[、,]$/u, '');
      if ([...joined].length <= max + 18) return /[。！？!?]$/u.test(joined) ? joined : `${joined}。`;
    }
  }
  const chars = [...text];
  const slice = chars.slice(0, max - 1).join('');
  const boundary = Math.max(slice.lastIndexOf('、'), slice.lastIndexOf('。'));
  return `${(boundary > max * 0.55 ? slice.slice(0, boundary) : slice).trim()}…`;
}

function summaryAction(section) {
  if (!section) return '';
  const lines = section.body || [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = normalize(lines[index]);
    if (/^共通して$/u.test(line) && /^→/u.test(normalize(lines[index + 1] || ''))) {
      return normalize(lines[index + 1]).replace(/^→\s*/u, '');
    }
    if (/^共通して\s*[:：]/u.test(line)) return line.replace(/^共通して\s*[:：]\s*/u, '');
  }
  const direct = lines.find((line) => /^→/u.test(normalize(line)) && /弁護士|専門家|確認|相談|実行|対応/u.test(normalize(line)));
  return direct ? normalize(direct).replace(/^→\s*/u, '') : '';
}

export function buildMeaningfulFallback(text, style = 'gist') {
  if (style === 'points') return null;
  const { title, sections } = parseSections(text);
  const pointCore = sections
    .filter((section) => /^ポイント/u.test(normalize(section.heading)))
    .sort((a, b) => corePriority(a) - corePriority(b));
  const core = pointCore.length >= 2 ? pointCore : sections
    .filter((section) => /ポイント|前提|分水嶺|価値中立|用法|設計上/u.test(normalize(section.heading)))
    .sort((a, b) => corePriority(a) - corePriority(b));
  const summary = sections.find((section) => /^(?:まとめ|要点|結論)/u.test(normalize(section.heading)));
  if (core.length < 2) return null;

  const firstHeading = cleanHeading(core[0].heading);
  const secondHeading = cleanHeading(core[1].heading);
  const firstRep = compactRepresentative(bestRepresentative(core[0]), 82);
  const secondRep = compactRepresentative(bestRepresentative(core[1]), 82);
  const action = summaryAction(summary);
  if (!firstHeading || !secondHeading || !firstRep || !secondRep || !action) return null;

  const topic = topicFromTitle(title);
  return [
    `${topic ? `${topic}では、` : ''}${firstHeading}。${firstRep}`,
    `${secondHeading}。${secondRep}`,
    `実務では、${action}`,
  ];
}
