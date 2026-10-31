import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { APPROVED_HISTORY_LICENSES, filterRange, normalizedEquityCompare, verifyHistory } from './history.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '../..');
const allowed = [
  { id: 'fixture-index', provider: 'Index Vendor', origin: 'https://index.example.test' },
  { id: 'fixture-btc', provider: 'BTC Vendor', origin: 'https://btc.example.test' },
];

const sample = (id, values, dates, overrides = {}) => ({
  id,
  kind: id === 'BTC' ? 'btc_usd_spot' : 'cash_index',
  unit: id === 'BTC' ? 'USD' : 'index_points',
  session: id === 'BTC' ? 'JST_0630' : 'XNYS',
  sampling: id === 'BTC' ? 'jst_0630_spot' : 'official_close',
  market_status: 'closed',
  observed_at: '2026-10-30T23:00:00Z',
  source: {
    name: id === 'BTC' ? 'BTC Vendor' : 'Index Vendor',
    url: id === 'BTC' ? 'https://btc.example.test/prices' : 'https://index.example.test/prices',
    license_id: id === 'BTC' ? 'fixture-btc' : 'fixture-index',
  },
  points: dates.map((date, index) => ({ date, value: values[index] })),
  ...overrides,
});

const payload = () => ({
  schema_version: 1,
  status: 'published',
  published_at: '2026-10-30T23:30:00Z',
  series: [
    sample('SPX', [90, 100, 110], ['2026-09-30', '2026-10-01', '2026-10-30']),
    sample('NDX', [100, 120, 130], ['2026-09-30', '2026-10-01', '2026-10-30']),
    sample('DJI', [80, 100, 90], ['2026-09-30', '2026-10-01', '2026-10-30']),
    sample('BTC', [40, 50, 60], ['2026-09-30', '2026-10-01', '2026-10-30']),
  ],
});

test('production registry is empty; static history cannot present invented quotes', () => {
  assert.deepEqual(APPROVED_HISTORY_LICENSES, []);
  const absent = JSON.parse(fs.readFileSync(path.join(here, 'history.json'), 'utf8'));
  assert.equal(absent.status, 'unavailable');
  assert.deepEqual(absent.series, []);
  assert.equal(verifyHistory(absent).ok, false);
  assert.equal(verifyHistory(payload()).ok, false);
});

test('only separately approved original-source display rights unlock a series', () => {
  const verified = verifyHistory(payload(), allowed);
  assert.equal(verified.ok, true);
  assert.equal(verified.series.length, 4);
  assert.equal(verifyHistory(payload(), allowed.slice(0, 1)).ok, false);

  const altered = payload();
  altered.series[0].source.url = 'https://hostile.example/borrowed';
  assert.equal(verifyHistory(altered, allowed).ok, false);

  const forged = payload();
  forged.series[0].source.license_id = 'self-declared';
  assert.equal(verifyHistory(forged, allowed).ok, false);
});

test('reject unsupported proxies, mixed sessions, invalid time, and untrustworthy series', () => {
  const mutations = [
    (p) => { p.series[0].kind = 'cfd'; },
    (p) => { p.series[1].sampling = 'intraday'; },
    (p) => { p.series[0].session = 'JST_0630'; },
    (p) => { p.series[3].kind = 'btc_perpetual'; },
    (p) => { p.series[3].sampling = 'official_close'; },
    (p) => { p.series[0].points[1].value = Number.NaN; },
    (p) => { p.series[0].points[0].value = -1; },
    (p) => { p.series[0].points[1].date = '2026-02-30'; },
    (p) => { p.series[0].points[1].date = '2026-09-30'; },
    (p) => { p.series[0].points.reverse(); },
    (p) => { p.series[0].observed_at = 'tomorrow'; },
    (p) => { p.series[0].market_status = 'live-now'; },
    (p) => { p.series[0].id = 'UNKNOWN'; },
    (p) => { p.series.push(p.series[0]); },
    (p) => { p.published_at = 'yesterday'; },
    (p) => { p.series[0].source.name = '<script>alert(1)</script>'; },
  ];
  for (const mutate of mutations) {
    const p = payload();
    mutate(p);
    assert.equal(verifyHistory(p, allowed).ok, false, mutate.toString());
  }
});

test('comparison uses only common US-index sessions and shared first-date baseline', () => {
  const verified = verifyHistory(payload(), allowed);
  const compared = normalizedEquityCompare(verified.series, ['SPX', 'NDX', 'DJI'], '3M');
  assert.deepEqual(compared.dates, ['2026-09-30', '2026-10-01', '2026-10-30']);
  assert.deepEqual(compared.lines[0].values, [100, 111.11111111111111, 122.22222222222223]);
  assert.deepEqual(compared.lines[1].values, [100, 120, 130]);
  assert.deepEqual(compared.lines[2].values, [100, 125, 112.5]);
  assert.throws(() => normalizedEquityCompare(verified.series, ['SPX', 'BTC'], '3M'));
  assert.equal(normalizedEquityCompare(verified.series, ['SPX', 'SPX'], '3M').lines.length, 1);
});

test('range boundaries are anchored to observations, with YTD and leap-year handling', () => {
  const points = [
    { date: '2023-12-31', value: 2 },
    { date: '2024-01-01', value: 3 },
    { date: '2024-02-29', value: 4 },
    { date: '2024-03-31', value: 5 },
    { date: '2024-04-30', value: 6 },
  ];
  assert.deepEqual(filterRange(points, '1M', '2024-03-31').map((p) => p.date), ['2024-02-29', '2024-03-31']);
  assert.deepEqual(filterRange(points, 'YTD', '2024-04-30').map((p) => p.date), points.slice(1).map((p) => p.date));
  assert.deepEqual(filterRange(points, '5Y', '2024-04-30').map((p) => p.date), points.map((p) => p.date));
  assert.throws(() => filterRange(points, 'all-time', '2024-04-30'));
});

test('static page has accessible no-JS path, links, and opt-in third-party loading', () => {
  const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(here, 'markets.js'), 'utf8');
  const hub = fs.readFileSync(path.join(site, 'investment/index.html'), 'utf8');
  const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
  assert.match(html, /<main id="main">/);
  assert.match(html, /<h1\b/);
  assert.match(html, /<table[^>]+tabindex="0"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /価格データ未接続/);
  assert.match(html, /1M.*3M.*YTD.*1Y.*5Y/s);
  assert.match(html, /https:\/\/www\.tradingview\.com\/symbols\/SPX\//);
  assert.match(html, /https:\/\/www\.tradingview\.com\/symbols\/NASDAQ-NDX\//);
  assert.match(html, /https:\/\/www\.tradingview\.com\/symbols\/DJ-DJI\//);
  assert.match(html, /https:\/\/www\.tradingview\.com\/symbols\/BTCUSD\//);
  assert.doesNotMatch(html, /<script[^>]+(?:src|href)="https:\/\//);
  assert.match(script, /addEventListener\('click'/);
  assert.match(script, /widgets\.tradingview-widget\.com/);
  assert.match(hub, /href="\/investment\/markets\/"/);
  assert.match(home, /href="\/investment\/markets\/"/);
  assert.match(html, /markets:related:start/);
  assert.match(html, /\/investment\/weekly\/\d{4}-\d{2}-\d{2}\//);
  assert.match(html, /noopener noreferrer/);
});

test('BTC 06:30 JST carries next day vs UTC previous day', () => {
  const p=payload();
  p.published_at='2026-10-30T22:30:00Z';
  for(const item of p.series)item.observed_at='2026-10-30T21:45:00Z';
  p.series[3].points.at(-1).date='2026-10-31';
  p.series[3].observed_at='2026-10-30T21:30:00Z';
  assert.equal(verifyHistory(p,allowed).ok,true);
});
