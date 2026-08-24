// Adapted from hitoshin/tiny_summarizer (Apache License 2.0).
// Original project: https://github.com/hitoshin/tiny_summarizer
// This module keeps only the term-frequency sentence scoring idea needed by
// the product; selection, diversity, structure and output composition are
// implemented separately by Studio NaoJun.

const STOP_WORDS = new Set([
  'は', 'を', 'が', 'の', 'です', '。', '、', 'に', 'と', 'て', 'で', 'た',
  'だっ', 'も', 'こと', 'れ', 'られる', 'に対し', '「', '」', 'い', 'う',
  'から', 'れる', 'ん', '（', '）',
]);

export function tinySummarizerTfScores(tokenLists) {
  const frequencies = new Map();
  for (const tokens of tokenLists) {
    for (const token of tokens) {
      if (!token || STOP_WORDS.has(token)) continue;
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }
  }

  return tokenLists.map((tokens) => {
    let score = 0;
    for (const token of tokens) score += frequencies.get(token) || 0;
    return score;
  });
}
