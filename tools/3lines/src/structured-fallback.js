import { structuralFallbackCandidates } from './structure.js';

function shorten(text, max = 100) {
  const value = String(text).replace(/\s+/g, ' ').trim();
  if ([...value].length <= max) return value;
  const slice = [...value].slice(0, max - 1).join('');
  const boundary = Math.max(slice.lastIndexOf('、'), slice.lastIndexOf('。'), slice.lastIndexOf(' '));
  return `${(boundary > max * 0.55 ? slice.slice(0, boundary) : slice).trim()}…`;
}

export function summarizeStructurally(text, style = 'gist') {
  const candidates = structuralFallbackCandidates(text, style);
  if (candidates.length !== 3) return null;
  return {
    items: candidates.map((item) => shorten(item, 100)),
    notes: [],
    engine: 'extractive-fallback',
    modelId: null,
    preparationState: 'structured-fallback',
  };
}
