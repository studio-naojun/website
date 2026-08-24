export const MAX_INPUT_CHARS = 20000;

export function validateInput(text) {
  const value = typeof text === 'string' ? text : '';
  const length = [...value].length;
  if (!value.trim()) return { ok: false, code: 'blank', message: '文章を貼り付けてください。' };
  if (length > MAX_INPUT_CHARS) {
    return { ok: false, code: 'too-long', message: `入力できるのは${MAX_INPUT_CHARS.toLocaleString('ja-JP')}文字までです。文章を少し短くしてください。` };
  }
  return { ok: true, value, length };
}

export function normalizeForAnalysis(text) {
  return String(text)
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

function fallbackSentenceParts(text) {
  const parts = [];
  const matcher = /[^。！？!?\n]+[。！？!?]?(?:[」』”’』】》）)]+)?|[^。！？!?\n]+$/gu;
  let match;
  while ((match = matcher.exec(text))) {
    const raw = match[0].trim();
    if (!raw) continue;
    const offset = match.index + match[0].indexOf(raw);
    parts.push({ text: raw, offset });
  }
  return parts;
}

export function segmentSentences(text) {
  const normalized = normalizeForAnalysis(text);
  if (!normalized) return [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'sentence' });
      const result = [];
      for (const part of segmenter.segment(normalized)) {
        const value = part.segment.trim();
        if (value) result.push({ text: value, offset: part.index + part.segment.indexOf(value) });
      }
      if (result.length) return result;
    } catch {
      // Fall through to punctuation/newline segmentation.
    }
  }
  return fallbackSentenceParts(normalized);
}

export function tokenize(text) {
  const value = String(text).toLocaleLowerCase('ja-JP');
  const tokens = [];
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      const segmenter = new Intl.Segmenter('ja', { granularity: 'word' });
      for (const part of segmenter.segment(value)) {
        if (part.isWordLike && part.segment.trim()) tokens.push(part.segment);
      }
    } catch {
      // Use the portable tokenization below.
    }
  }
  if (!tokens.length) {
    tokens.push(...(value.match(/[\p{Script=Han}]+|[\p{Script=Hiragana}]+|[\p{Script=Katakana}]+|[a-z]+|\d+(?:[.,]\d+)*/giu) || []));
  }
  return tokens.filter((token) => token.length > 0);
}

export function extractLiterals(text) {
  const normalized = String(text).normalize('NFKC');
  return {
    urls: normalized.match(/https?:\/\/[^\s)」』】]+/giu) || [],
    handles: normalized.match(/@[\w\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}_-]+/gu) || [],
    numbers: normalized.match(/\d+(?:[.,]\d+)*/g) || [],
  };
}

export function normalizedSource(text) {
  return normalizeForAnalysis(text).normalize('NFKC');
}
