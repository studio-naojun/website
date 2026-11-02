// A deliberate, user-triggered share. No automatic posting or personal identifiers.
export const SHARE_URL = 'https://naojun.jp/works/ametsuta/?utm_source=share&utm_medium=earned&utm_campaign=ametsuta-result-share-20261102';

const meters = (units) => (Math.max(0, Number(units) || 0) / 10).toFixed(1);

export function shareCopy(height, best) {
  return `アメツタで${meters(height)} m登りました。自己ベストは${meters(best)} m。押して伸ばし、離して倒す無料ブラウザゲーム。`;
}

export async function shareGameResult({height, best, platform}) {
  const text = shareCopy(height, best);
  if (typeof platform?.share === 'function') {
    try {
      await platform.share({title: 'アメツタ', text, url: SHARE_URL});
      return 'shared';
    } catch (error) {
      // Cancel is a deliberate choice, not a reason to write to clipboard.
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  if (typeof platform?.clipboard?.writeText === 'function') {
    try {
      await platform.clipboard.writeText(text + '\n' + SHARE_URL);
      return 'copied';
    } catch (_) {}
  }
  return 'unavailable';
}
