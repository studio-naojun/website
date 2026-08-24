import { extractLiterals, normalizedSource } from './normalizer.js';

export const MAX_ITEM_LENGTH = 120;
export const MAX_NOTES = 3;
export const MAX_NOTES_LENGTH = 300;

function containsLiteral(source, candidate, pattern) {
  const sourceLiterals = extractLiterals(source)[pattern].map((item) => item.toLocaleLowerCase('ja-JP'));
  return candidate.every((item) => sourceLiterals.includes(item.toLocaleLowerCase('ja-JP')));
}

export function validateSummary(output, source) {
  const items = Array.isArray(output?.items) ? output.items : [];
  const notes = Array.isArray(output?.notes) ? output.notes : [];
  if (items.length !== 3) return { ok: false, reason: '3つの項目が必要です。' };
  if (items.some((item) => typeof item !== 'string' || !item.trim() || [...item.trim()].length > MAX_ITEM_LENGTH)) return { ok: false, reason: '項目の長さまたは空欄が不正です。' };
  const normalizedItems = items.map((item) => item.trim().replace(/\s+/g, ' '));
  if (new Set(normalizedItems.map((item) => item.toLocaleLowerCase('ja-JP'))).size !== 3) return { ok: false, reason: '重複した項目があります。' };
  if (notes.length > MAX_NOTES || notes.some((note) => typeof note !== 'string' || !note.trim())) return { ok: false, reason: '備考の数が不正です。' };
  if ([...notes.join('')].length > MAX_NOTES_LENGTH) return { ok: false, reason: '備考が長すぎます。' };
  const sourceText = normalizedSource(source);
  const allText = [...normalizedItems, ...notes].join('\n');
  const literals = extractLiterals(allText);
  if (!containsLiteral(sourceText, literals.urls, 'urls')) return { ok: false, reason: '原文にないURLがあります。' };
  if (!containsLiteral(sourceText, literals.handles, 'handles')) return { ok: false, reason: '原文にないアカウント名があります。' };
  if (!containsLiteral(sourceText, literals.numbers, 'numbers')) return { ok: false, reason: '原文にない数値があります。' };
  return { ok: true, items: normalizedItems, notes: notes.map((note) => note.trim()) };
}

export function parseModelOutput(raw) {
  if (typeof raw !== 'string') return null;
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const items = [];
  const notes = [];
  for (const line of lines) {
    const itemMatch = line.match(/^(?:[1-3][.)]|[-*])\s*(.+)$/u);
    const noteMatch = line.match(/^(?:備考|注記|note)\s*[:：-]\s*(.+)$/iu);
    if (itemMatch && items.length < 3) items.push(itemMatch[1].trim());
    else if (noteMatch) notes.push(noteMatch[1].trim());
  }
  return items.length === 3 ? { items, notes } : null;
}
