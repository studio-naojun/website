/**
 * History display is legally fail-closed. A source appears here only after a
 * human has verified that the agreement permits public redistribution of its
 * *exact* instrument, dates, values, chart, table and last-price display.
 * Do not populate this list from user-supplied JSON or TradingView widgets.
 */
export const APPROVED_HISTORY_LICENSES = Object.freeze([]);

export const INSTRUMENTS = Object.freeze({
  SPX: { name: 'S&P 500', kind: 'cash_index', unit: 'index_points', session: 'XNYS', sampling: 'official_close' },
  NDX: { name: 'NASDAQ 100', kind: 'cash_index', unit: 'index_points', session: 'XNYS', sampling: 'official_close' },
  DJI: { name: 'Dow Jones 30', kind: 'cash_index', unit: 'index_points', session: 'XNYS', sampling: 'official_close' },
  BTC: { name: 'Bitcoin / USD', kind: 'btc_usd_spot', unit: 'USD', session: 'JST_0630', sampling: 'jst_0630_spot' },
});

export const RANGES = Object.freeze(['1M', '3M', 'YTD', '1Y', '5Y']);

const safeDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};

const safeTimestamp = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(value) &&
  safeDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Returns either a validated all-or-nothing collection or an opaque failure. */
export function verifyHistory(payload, registry = APPROVED_HISTORY_LICENSES) {
  const unavailable = { ok: false, reason: '公開可能な価格履歴データは現在ありません。', series: [] };
  if (!isPlainObject(payload) || payload.schema_version !== 1 || payload.status !== 'published') return unavailable;
  if (!safeTimestamp(payload.published_at) || !Array.isArray(payload.series) || !payload.series.length || payload.series.length > 4) return unavailable;
  if (!Array.isArray(registry)) return unavailable;

  const used = new Set();
  for (const item of payload.series) {
    if (!isPlainObject(item) || !Object.hasOwn(INSTRUMENTS, item.id) || used.has(item.id)) return unavailable;
    used.add(item.id);
    const expected = INSTRUMENTS[item.id];
    if (['kind', 'unit', 'session', 'sampling'].some((field) => item[field] !== expected[field])) return unavailable;
    if (!['open', 'closed', 'unknown'].includes(item.market_status)) return unavailable;
    if (!safeTimestamp(item.observed_at) || Date.parse(item.observed_at) > Date.parse(payload.published_at)) return unavailable;

    const source = item.source;
    if (!isPlainObject(source) || typeof source.license_id !== 'string') return unavailable;
    const license = registry.find((candidate) =>
      isPlainObject(candidate) && candidate.id === source.license_id &&
      typeof candidate.provider === 'string' && typeof candidate.origin === 'string'
    );
    if (!license || source.name !== license.provider || !/^https:\/\//.test(source.url || '')) return unavailable;
    try {
      const url = new URL(source.url);
      if (`${url.protocol}//${url.host}` !== license.origin || url.username || url.password) return unavailable;
    } catch {
      return unavailable;
    }

    if (!Array.isArray(item.points) || item.points.length < 2 || item.points.length > 2500) return unavailable;
    let last = '';
    for (const point of item.points) {
      if (!isPlainObject(point) || !safeDate(point.date) || point.date <= last ||
        typeof point.value !== 'number' || !Number.isFinite(point.value) || point.value <= 0) return unavailable;
      last = point.date;
    }
    // BTC 06:30 JST falls on the previous UTC calendar day.
    const observedDate = item.id === 'BTC' ? (() => {
      const fields = new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(item.observed_at));
      const p = Object.fromEntries(fields.filter(f=>f.type!=='literal').map(f=>[f.type,f.value]));
      return p.year+'-'+p.month+'-'+p.day;
    })() : item.observed_at.slice(0,10);
    if (last > observedDate) return unavailable;
  }
  return { ok: true, published_at: payload.published_at, series: payload.series };
}

function yearsMonthsBefore(anchor, months) {
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));
  const day = Number(anchor.slice(8, 10));
  const first = new Date(Date.UTC(year, month - 1 - months, 1));
  const endOfMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, endOfMonth));
  return first.toISOString().slice(0, 10);
}

/** Ranges are relative to the last observed session, never the visitor's clock. */
export function filterRange(points, range, anchor) {
  if (!RANGES.includes(range) || !safeDate(anchor)) throw new RangeError('Unsupported range or anchor');
  const cutoff = range === 'YTD' ? `${anchor.slice(0, 4)}-01-01` :
    yearsMonthsBefore(anchor, { '1M': 1, '3M': 3, '1Y': 12, '5Y': 60 }[range]);
  return points.filter((point) => point.date >= cutoff && point.date <= anchor);
}

/** Index-only overlay; dates are intersected BEFORE first-common-date=100 normalization. */
export function normalizedEquityCompare(series, requested, range) {
  if (!Array.isArray(series) || !Array.isArray(requested) || !requested.length || !RANGES.includes(range)) throw new RangeError('Invalid comparison');
  const ids = [...new Set(requested)];
  if (ids.some((id) => !['SPX', 'NDX', 'DJI'].includes(id))) throw new RangeError('US indices only');
  const selected = ids.map((id) => series.find((item) => item.id === id));
  if (selected.some((item) => !item || item.kind !== 'cash_index' || item.sampling !== 'official_close' || item.session !== 'XNYS')) throw new RangeError('Invalid comparison data basis');
  const commonDates = selected[0].points.map((point) => point.date).filter((date) =>
    selected.every((item) => item.points.some((point) => point.date === date))
  );
  if (!commonDates.length) return { dates: [], lines: [] };
  const dates = filterRange(commonDates.map((date) => ({ date })), range, commonDates.at(-1)).map((item) => item.date);
  if (dates.length < 2) return { dates: [], lines: [] };
  const lines = selected.map((item) => {
    const valuesByDate = new Map(item.points.map((point) => [point.date, point.value]));
    const base = valuesByDate.get(dates[0]);
    return { id: item.id, name: INSTRUMENTS[item.id].name, values: dates.map((date) => valuesByDate.get(date) / base * 100) };
  });
  return { dates, lines };
}
