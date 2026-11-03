import { INSTRUMENTS, filterRange, normalizedEquityCompare, verifyHistory } from './history.mjs';

// Verified 2026-11-03 in Chromium (local origin, 390px and 1440px): TradingView's third-party embed
// draws daily candles for AMEX:SPY, NASDAQ:QQQ, AMEX:DIA and BITSTAMP:BTCUSD, but answers the cash
// indices SP:SPX, NASDAQ:NDX and DJ:DJI with "This symbol is only available on TradingView".
// The chart therefore loads immediately with each index's tracking ETF (labelled as an ETF, never as
// the index); the index itself stays one click away on TradingView's own symbol page.
const CHARTS = Object.freeze({
  SPX: { name: 'S&P 500', index: 'SP:SPX', page: 'https://www.tradingview.com/symbols/SPX/', embed: 'AMEX:SPY', code: 'SPY', fund: 'SPDR S&P 500 ETF Trust', etfPage: 'https://www.tradingview.com/symbols/AMEX-SPY/', etf: true },
  NDX: { name: 'NASDAQ 100', index: 'NASDAQ:NDX', page: 'https://www.tradingview.com/symbols/NASDAQ-NDX/', embed: 'NASDAQ:QQQ', code: 'QQQ', fund: 'Invesco QQQ Trust', etfPage: 'https://www.tradingview.com/symbols/NASDAQ-QQQ/', etf: true },
  DJI: { name: 'ダウ平均', index: 'DJ:DJI', page: 'https://www.tradingview.com/symbols/DJ-DJI/', embed: 'AMEX:DIA', code: 'DIA', fund: 'SPDR Dow Jones Industrial Average ETF Trust', etfPage: 'https://www.tradingview.com/symbols/AMEX-DIA/', etf: true },
  BTC: { name: 'Bitcoin / USD', index: 'BITSTAMP:BTCUSD', page: 'https://www.tradingview.com/symbols/BTCUSD/?exchange=BITSTAMP', embed: 'BITSTAMP:BTCUSD', code: 'BTC/USD', fund: 'Bitstamp現物', etf: false },
});
const TV_FRAME_BASE = 'https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=ja#';
const WIDGET_TIMEOUT_MS = 15000;

const $ = (id) => document.getElementById(id);
const safeNumber = (value, digits = 2) => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const jpTime = (iso) => `${new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} JST`;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const officialLink = (chart, className, label = `TradingViewで ${chart.name} を開く `) => {
  const a = el('a', className);
  a.href = chart.page;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.append(label);
  const arrow = el('span', '', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  a.append(arrow, el('span', 'sr-only', '（新しいタブ）'));
  return a;
};

// TradingView also supports an isolated iframe form. Directly embedding the same
// provider-hosted chart URL avoids executing their Web Component module in our
// first-party page. Confirmed 2026-11-03 with actual SPY OHLC and 7 canvas layers
// in Chromium, including the sandbox attribute, at the published embed endpoint.
function setupExternalChart() {
  const stage = $('tradingview-chart');
  const status = $('widget-status');
  const reload = $('reload-widget');
  const keys = [...document.querySelectorAll('[data-widget-symbol]')];
  const state = { selected: 'SPX' };
  let activeFrame = null;
  let timer = 0;
  const announce = (message) => { status.textContent = message; };
  const etfPage = (chart, className = '', label = '') =>
    officialLink({ ...chart, page: chart.etfPage }, className, label || `TradingViewで ${chart.code} のETFを見る `);

  const frameSrc = (chart) => {
    // Only fixed allowlisted symbols from CHARTS enter this fragment JSON.
    const options = {
      symbol: chart.embed, interval: 'D', timezone: 'Asia/Tokyo',
      style: '1', theme: 'light', locale: 'ja',
      hide_volume: false, allow_symbol_change: false,
      hide_top_toolbar: false, hide_side_toolbar: true,
      hide_legend: false, save_image: true, withdateranges: false,
      details: false, hotlist: false, show_popup_button: false,
      doNotStoreSettings: true, support_host: 'https://www.tradingview.com',
    };
    return TV_FRAME_BASE + encodeURIComponent(JSON.stringify(options));
  };

  function sourceLinks(chart, actions = null) {
    const a = actions || el('span', 'mk-provider-links');
    if (chart.etf) {
      a.append(
        etfPage(chart, actions ? 'mk-action mk-action-primary' : '', `${chart.code}連動ETFのチャートを開く `),
        officialLink(chart, actions ? 'mk-action' : '', `${chart.name}指数そのものを開く `),
      );
    } else a.append(officialLink(chart, actions ? 'mk-action mk-action-primary' : '', 'BTC/USD現物をTradingViewで開く '));
    return a;
  }

  function liveLabel(chart) {
    const label = el('p', 'mk-live-label');
    if (chart.etf) {
      label.classList.add('is-proxy');
      label.append(el('span', 'mk-etf-tag', 'ETF'), el('strong', '', chart.code),
        ` ${chart.fund}（${chart.embed}）。${chart.name}に連動する上場投資信託で、指数そのもの（${chart.index}）ではありません。 `,
        sourceLinks(chart));
    } else {
      label.append(el('strong', '', 'BTC/USD'),
        ` Bitstamp現物（${chart.embed}）。価格・更新間隔はTradingViewの表示に従います。 `,
        sourceLinks(chart));
    }
    return label;
  }

  function fail(frame) {
    if (activeFrame !== frame) return;
    clearTimeout(timer);
    stage.dataset.state = 'error';
    stage.setAttribute('aria-busy', 'false');
    const chart = CHARTS[state.selected];
    const view = el('div', 'mk-idle mk-error');
    const mark = el('span', 'mk-idle-mark', chart.code);
    mark.setAttribute('aria-hidden', 'true');
    view.append(mark, el('h2', 'mk-idle-title', 'TradingViewのチャートに接続できませんでした。'));
    view.append(el('p', 'mk-idle-copy', '通信障害や広告ブロッカーなどで接続できない場合があります。連動ETFと指数は異なる商品です。公式ページでも確認できます。'));
    const actions = el('div', 'mk-idle-actions');
    sourceLinks(chart, actions);
    view.append(actions);
    stage.replaceChildren(view);
    announce('TradingViewに接続できませんでした。再読み込みするか公式ページをお使いください。');
    reload.focus();
  }

  function render() {
    clearTimeout(timer);
    const chart = CHARTS[state.selected];
    for (const key of keys) key.setAttribute('aria-pressed', String(key.dataset.widgetSymbol === state.selected));
    $('chart-selected').textContent = chart.etf ? `${chart.code}（${chart.name}連動ETF）` : chart.name;
    $('chart-symbol').textContent = chart.embed;
    const live = el('div', 'mk-live');
    live.append(liveLabel(chart));
    const iframe = el('iframe', 'mk-tv-frame');
    iframe.src = frameSrc(chart);
    iframe.title = `${chart.code} — TradingView提供の外部チャート。ロードに失敗した場合は下の公式リンクを使用`;
    iframe.loading = 'eager';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms');
    iframe.addEventListener('load', () => {
      if (activeFrame !== iframe) return;
      clearTimeout(timer);
      stage.dataset.state = 'connected'; // iframe document loaded, NOT proof of a price candle.
      stage.setAttribute('aria-busy', 'false');
      announce(`TradingViewの外部チャート枠を開きました（${chart.embed}）。データが表示されない場合は再読み込みか公式ページをご利用ください。`);
    });
    iframe.addEventListener('error', () => fail(iframe));
    live.append(iframe);
    activeFrame = iframe;
    stage.dataset.state = 'loading';
    stage.setAttribute('aria-busy', 'true');
    announce('TradingViewの外部チャートに接続しています…');
    stage.replaceChildren(live);
    // A cross-origin iframe can fire load even when its own data subsequently
    // fails. The persistent reload action and provider links cover that case.
    timer = setTimeout(() => {
      if (activeFrame === iframe && stage.dataset.state === 'loading') fail(iframe);
    }, WIDGET_TIMEOUT_MS);
  }

  for (const key of keys) key.addEventListener('click', () => {
    state.selected = key.dataset.widgetSymbol;
    render();
  });
  reload.addEventListener('click', render);
  render();
}

const svgNode = (tag, attributes = {}) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  return node;
};

function plotChart(dates, lines, normalized) {
  const root = $('history-chart');
  root.replaceChildren();
  if (dates.length < 2 || !lines.length) {
    const p = document.createElement('p');
    p.className = 'markets-unavailable';
    p.textContent = '選択期間に2件以上の観測値がないため、推移は描画できません。';
    root.append(p);
    return;
  }

  const legend = document.createElement('div');
  legend.className = 'markets-chart-key';
  for (const line of lines) {
    const item = document.createElement('span');
    item.className = `key-${line.id.toLowerCase()}`;
    item.textContent = line.name;
    legend.append(item);
  }
  root.append(legend);

  const numbers = lines.flatMap((line) => line.values);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const pad = Math.max((max - min) * .1, Math.abs(max) * .002, .5);
  const low = min - pad;
  const high = max + pad;
  const w = 760, h = 310, left = 80, right = 15, top = 20, bottom = 40;
  const x = (index) => left + index / (dates.length - 1) * (w - left - right);
  const y = (value) => top + (high - value) / (high - low) * (h - top - bottom);
  const svg = svgNode('svg', {
    viewBox: `0 0 ${w} ${h}`, role: 'img',
    'aria-label': `${dates[0]}から${dates.at(-1)}の${lines.map((line) => line.name).join('・')} ${normalized ? '共通初日100' : '観測値'}の推移。詳細な数値は直後の表を参照。`,
  });

  for (let tick = 0; tick <= 4; tick += 1) {
    const value = low + (high - low) / 4 * tick;
    const yy = y(value);
    svg.append(svgNode('line', { x1: left, y1: yy, x2: w - right, y2: yy, class: 'chart-grid' }));
    const label = svgNode('text', { x: left - 10, y: yy + 4, 'text-anchor': 'end', class: 'chart-label' });
    label.textContent = safeNumber(value, normalized ? 1 : 0);
    svg.append(label);
  }

  for (const [index, date] of [[0, dates[0]], [dates.length - 1, dates.at(-1)]]) {
    const label = svgNode('text', { x: x(index), y: h - 11, 'text-anchor': index === 0 ? 'start' : 'end', class: 'chart-label' });
    label.textContent = date;
    svg.append(label);
  }

  for (const line of lines) {
    const polyline = svgNode('polyline', {
      class: `chart-line chart-line-${line.id.toLowerCase()}`,
      points: line.values.map((value, index) => `${x(index).toFixed(2)},${y(value).toFixed(2)}`).join(' '),
    });
    svg.append(polyline);
  }
  root.append(svg);
}

function renderTable(dates, lines, normalized) {
  const table = $('history-table');
  const caption = table.querySelector('caption');
  caption.textContent = `${dates[0] || '—'}〜${dates.at(-1) || '—'} / ${normalized ? '共通初日 = 100（米国株公式終値）' : '公開許諾済みの観測値'}`;

  const heading = document.createElement('tr');
  for (const label of ['日付', ...lines.map((line) => `${line.name} ${normalized ? '（初日100）' : line.id === 'BTC' ? '（USD）' : '（pt）'}`)]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    heading.append(th);
  }
  table.tHead.replaceChildren(heading);

  const body = document.createDocumentFragment();
  if (!dates.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = lines.length + 1;
    td.textContent = 'この期間には比較可能な観測値がありません。';
    tr.append(td);
    body.append(tr);
  } else {
    for (let index = dates.length - 1; index >= 0; index -= 1) {
      const tr = document.createElement('tr');
      const dateCell = document.createElement('th');
      dateCell.scope = 'row';
      dateCell.textContent = dates[index];
      tr.append(dateCell);
      for (const line of lines) {
        const td = document.createElement('td');
        td.textContent = safeNumber(line.values[index]);
        tr.append(td);
      }
      body.append(tr);
    }
  }
  table.tBodies[0].replaceChildren(body);
}

function renderProvenance(used, publishedAt) {
  const root = $('history-source');
  root.replaceChildren();
  root.append(document.createTextNode(`公開データの最終更新：${jpTime(publishedAt)}。`));
  for (const series of used) {
    const text = document.createTextNode(` ${series.id}：${series.source.name}（${series.sampling === 'official_close' ? '米国市場公式終値' : 'BTC/USD現物 JST 06:30基準'}、最終観測 ${jpTime(series.observed_at)}、観測時ステータス ${series.market_status}）`);
    const link = document.createElement('a');
    link.href = series.source.url; // verifyHistory checks against the approved HTTPS origin.
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = '出典（新しいタブ）';
    root.append(text, link);
  }
}

function setupLicensedHistory(verified) {
  const available = new Map(verified.series.map((item) => [item.id, item]));
  const first = ['SPX', 'NDX', 'DJI', 'BTC'].find((id) => available.has(id));
  let chosen = first;
  let range = '3M';
  const numberFormatter = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 });

  for (const [id, series] of available) {
    const card = document.querySelector(`[data-quote="${id}"]`);
    const last = series.points.at(-1);
    card.querySelector('[data-price]').textContent = `${id === 'BTC' ? '$' : ''}${numberFormatter.format(last.value)}${id === 'BTC' ? ' USD' : ' pt'}`;
    card.querySelector('[data-observed]').textContent = `${last.date} / 観測 ${jpTime(series.observed_at)} / ${series.market_status}`;
  }

  const chosenButtons = [...document.querySelectorAll('[data-history-symbol]')];
  for (const button of chosenButtons) {
    const id = button.dataset.historySymbol;
    button.disabled = id === 'COMPARE' ? !['SPX', 'NDX', 'DJI'].every((key) => available.has(key)) : !available.has(id);
    button.setAttribute('aria-pressed', String(id === chosen));
  }

  function render() {
    const isCompare = chosen === 'COMPARE';
    const used = isCompare ? ['SPX', 'NDX', 'DJI'].map((id) => available.get(id)) : [available.get(chosen)];
    let dates, lines;
    if (isCompare) {
      ({ dates, lines } = normalizedEquityCompare(verified.series, ['SPX', 'NDX', 'DJI'], range));
    } else {
      const item = used[0];
      const filtered = filterRange(item.points, range, item.points.at(-1).date);
      dates = filtered.map((point) => point.date);
      lines = [{ id: item.id, name: INSTRUMENTS[item.id].name, values: filtered.map((point) => point.value) }];
    }
    $('history-meta').textContent = `対象：${isCompare ? '米国3指数・同一取引日の公式終値（共通初日=100）' : `${INSTRUMENTS[chosen].name} ${INSTRUMENTS[chosen].sampling === 'jst_0630_spot' ? '現物・JST 06:30基準' : '公式終値'}`} / 期間：${range} / ${dates.length ? `${dates[0]}〜${dates.at(-1)}・${dates.length}観測日` : '表示可能な観測日なし'}`;
    plotChart(dates, lines, isCompare);
    renderTable(dates, lines, isCompare);
    renderProvenance(used, verified.published_at);
  }

  for (const button of chosenButtons) {
    button.addEventListener('click', () => {
      if (button.disabled) return;
      chosen = button.dataset.historySymbol;
      for (const other of chosenButtons) other.setAttribute('aria-pressed', String(other === button));
      render();
    });
  }
  const rangeButtons = [...document.querySelectorAll('[data-range]')];
  for (const button of rangeButtons) {
    button.addEventListener('click', () => {
      range = button.dataset.range;
      for (const other of rangeButtons) other.setAttribute('aria-pressed', String(other === button));
      render();
    });
  }

  $('history-status').textContent = '公開利用の確認を終えたデータを掲載しています。下の履歴・出典で更新時点を確認してください。';
  $('history-licensed').hidden = false;
  render();
}


async function refreshPublishedArticles() {
  try {
    const response = await fetch('/investment/feed.json', { cache: 'no-store' });
    if (!response.ok) return;
    const feed = await response.json();
    if (!Array.isArray(feed.entries)) return;
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
    const today=p.year+'-'+p.month+'-'+p.day;
    const safePath=/^(weekly\/[0-9]{4}-[0-9]{2}-[0-9]{2}\/|monthly\/[0-9]{4}-[0-9]{2}\/)$/;
    const safeDate=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
    const recent=feed.entries.filter(x=>x && ['weekly','monthly'].includes(x.type)
      && typeof x.published_at==='string' && safeDate.test(x.published_at) && x.published_at<=today
      && typeof x.title==='string' && x.title.length>0 && x.title.length<240
      && typeof x.path==='string' && safePath.test(x.path)).slice(0,2);
    if (!recent.length) return;
    const fragment=document.createDocumentFragment();
    for (const item of recent) {
      const a=document.createElement('a');a.className='markets-related-entry';a.href='/investment/'+item.path;
      const stamp=document.createElement('span');stamp.className='markets-related-date';stamp.textContent=item.type.toUpperCase()+' · '+item.published_at;
      const title=document.createElement('strong');title.className='markets-related-title';title.textContent=item.title;
      a.append(stamp,title);fragment.append(a);
    }
    document.getElementById('markets-related-list').replaceChildren(fragment);
  } catch {
    // The static article links remain available offline and without JavaScript.
  }
}
refreshPublishedArticles();

setupExternalChart();
fetch('/investment/markets/history.json', { cache: 'no-store' })
  .then((response) => response.ok ? response.json() : null)
  .then((payload) => {
    const verified = verifyHistory(payload);
    if (verified.ok) setupLicensedHistory(verified);
  })
  .catch(() => {
    // The static no-data copy and official chart links remain usable offline.
  });
