import { INSTRUMENTS, filterRange, normalizedEquityCompare, verifyHistory } from './history.mjs';

// Verified 2026-11-03 in Chromium from both a local and the naojun.jp origin: TradingView's embed
// answers SP:SPX, NASDAQ:NDX and DJ:DJI (and TVC:*) with "This symbol is only available on TradingView".
// Those indices therefore open on TradingView itself; a tracking ETF chart is offered only as an
// explicitly labelled, separately clicked alternative and is never presented as the index.
const CHARTS = Object.freeze({
  SPX: { name: 'S&P 500', symbol: 'SP:SPX', page: 'https://www.tradingview.com/symbols/SPX/', etf: { symbol: 'AMEX:SPY', code: 'SPY', name: 'SPDR S&P 500 ETF Trust' } },
  NDX: { name: 'NASDAQ 100', symbol: 'NASDAQ:NDX', page: 'https://www.tradingview.com/symbols/NASDAQ-NDX/', etf: { symbol: 'NASDAQ:QQQ', code: 'QQQ', name: 'Invesco QQQ Trust' } },
  DJI: { name: 'ダウ平均', symbol: 'DJ:DJI', page: 'https://www.tradingview.com/symbols/DJ-DJI/', etf: { symbol: 'AMEX:DIA', code: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF Trust' } },
  BTC: { name: 'Bitcoin / USD', symbol: 'BITSTAMP:BTCUSD', page: 'https://www.tradingview.com/symbols/BTCUSD/?exchange=BITSTAMP', embeddable: true },
});
const WIDGET_SCRIPT = 'https://widgets.tradingview-widget.com/w/ja/tv-advanced-chart.js';
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

const officialLink = (chart, className) => {
  const a = el('a', className);
  a.href = chart.page;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.append(`TradingViewで ${chart.name} を開く `);
  const arrow = el('span', '', '↗');
  arrow.setAttribute('aria-hidden', 'true');
  a.append(arrow, el('span', 'sr-only', '（新しいタブ）'));
  return a;
};

function setupExternalChart() {
  const stage = $('tradingview-chart');
  const status = $('widget-status');
  const close = $('close-widget');
  const keys = [...document.querySelectorAll('[data-widget-symbol]')];
  // consent: the visitor pressed a load button (the sole path to a third-party request).
  // etfAccepted: the visitor explicitly asked for tracking-ETF charts in place of unembeddable indices.
  const state = { selected: 'SPX', consent: false, etfAccepted: false, script: 'idle' };
  let widget = null;
  let timer = 0;

  const announce = (text) => { status.textContent = text; };

  function requestScript() {
    if (state.script === 'loading' || state.script === 'ready') return;
    state.script = 'loading';
    const script = document.createElement('script');
    script.type = 'module';
    script.src = WIDGET_SCRIPT;
    script.dataset.tradingview = '';
    script.onerror = () => fail();
    document.querySelector('script[data-tradingview]')?.remove();
    document.head.append(script);
    clearTimeout(timer);
    timer = setTimeout(() => { if (!customElements.get('tv-advanced-chart')) fail(); }, WIDGET_TIMEOUT_MS);
    customElements.whenDefined('tv-advanced-chart').then(() => {
      clearTimeout(timer);
      if (state.script === 'failed') return;
      state.script = 'ready';
      render();
    });
  }

  function fail() {
    clearTimeout(timer);
    if (state.script === 'ready') return;
    state.script = 'failed';
    // The Close control becomes hidden in the error view; restore focus to
    // the visible Retry button after an async load failure.
    render(true);
  }

  function idleView(chart) {
    const view = el('div', 'mk-idle');
    const mark = el('span', 'mk-idle-mark', state.selected);
    mark.setAttribute('aria-hidden', 'true');
    view.append(mark);
    const actions = el('div', 'mk-idle-actions');
    const load = el('button', 'mk-action mk-action-primary');
    load.type = 'button';
    load.id = 'load-widget';
    load.setAttribute('aria-controls', 'tradingview-chart');
    if (chart.embeddable) {
      view.append(el('h2', 'mk-idle-title', `${chart.name}（Bitstamp現物）の公式チャートを、この枠に表示します。`));
      const copy = el('p', 'mk-idle-copy', 'ボタンを押すとTradingViewへ接続し、日足チャートを読み込みます。押すまで外部への通信は行いません。');
      copy.id = 'widget-message';
      view.append(copy);
      load.textContent = 'チャートを読み込む（TradingViewに接続）';
      load.addEventListener('click', () => { state.consent = true; requestScript(); render(true); });
      actions.append(load, officialLink(chart, 'mk-action'));
    } else {
      view.append(el('h2', 'mk-idle-title', `${chart.name} 指数は、他サイトへの埋め込み対象外です。`));
      const copy = el('p', 'mk-idle-copy', `TradingViewは ${chart.name}（${chart.symbol}）指数を外部サイト用チャートで提供していません（2026年11月3日確認）。指数そのものはTradingViewで開けます。値動きの形は、連動ETF「${chart.etf.code}」のチャートでも確認できます。ETFの価格は指数の値と一致しません。`);
      copy.id = 'widget-message';
      view.append(copy);
      load.textContent = `連動ETF「${chart.etf.code}」のチャートを表示（TradingViewに接続）`;
      load.addEventListener('click', () => { state.consent = true; state.etfAccepted = true; requestScript(); render(true); });
      actions.append(officialLink(chart, 'mk-action mk-action-primary'), load);
      load.className = 'mk-action';
    }
    view.append(actions);
    return view;
  }

  function errorView(chart) {
    const view = el('div', 'mk-idle mk-error');
    view.append(el('h2', 'mk-idle-title', 'TradingViewのチャートを読み込めませんでした。'));
    const copy = el('p', 'mk-idle-copy', '通信が遮断されたか、提供元に接続できません。TradingViewの公式ページなら、同じ銘柄をそのまま閲覧できます。');
    copy.id = 'widget-message';
    view.append(copy);
    const actions = el('div', 'mk-idle-actions');
    const retry = el('button', 'mk-action', 'もう一度読み込む');
    retry.type = 'button';
    retry.id = 'load-widget';
    retry.addEventListener('click', () => { state.script = 'idle'; requestScript(); render(true); });
    actions.append(officialLink(chart, 'mk-action mk-action-primary'), retry);
    view.append(actions);
    return view;
  }

  function liveLabel(chart) {
    const label = el('p', 'mk-live-label');
    if (chart.embeddable) {
      label.append(el('strong', '', 'BTC/USD'), ` Bitstamp現物（${chart.symbol}）。価格・更新間隔はTradingViewの表示に従います。`, officialLink(chart, ''));
    } else {
      label.classList.add('is-proxy');
      label.append(el('strong', '', chart.etf.code), ` ${chart.name}連動ETF（${chart.etf.name}）のチャートをTradingViewに依頼しています。指数そのものではありません。`, officialLink(chart, ''));
    }
    return label;
  }

  function configure(chart, symbol) {
    widget.setAttribute('symbol', symbol);
    widget.setAttribute('aria-label', `${chart.embeddable ? chart.name : chart.etf.code + '（' + chart.name + '連動ETF）'} のTradingViewチャート`);
  }

  function liveView(chart, symbol) {
    widget = document.createElement('tv-advanced-chart');
    widget.setAttribute('interval', '1D');
    widget.setAttribute('timezone', 'Asia/Tokyo');
    widget.setAttribute('theme', 'light');
    widget.setAttribute('locale', 'ja');
    configure(chart, symbol);
    const view = el('div', 'mk-live');
    view.append(liveLabel(chart), widget);
    return view;
  }

  function render(moveFocus = false) {
    const chart = CHARTS[state.selected];
    for (const key of keys) key.setAttribute('aria-pressed', String(key.dataset.widgetSymbol === state.selected));
    const symbol = chart.embeddable ? chart.symbol : state.etfAccepted ? chart.etf.symbol : null;
    $('chart-selected').textContent = symbol && !chart.embeddable ? `${chart.etf.code}（${chart.name}連動ETF）` : chart.name;
    $('chart-symbol').textContent = symbol || chart.symbol;

    let view;
    if (!state.consent || !symbol) {
      widget = null;
      stage.dataset.state = state.consent ? 'blocked' : 'idle';
      stage.setAttribute('aria-busy', 'false');
      view = idleView(chart);
      announce(state.consent ? `${chart.name} 指数は埋め込み対象外です。公式ページか連動ETFを選べます。` : '外部チャートはまだ読み込んでいません。');
    } else if (state.script === 'failed') {
      widget = null;
      stage.dataset.state = 'error';
      stage.setAttribute('aria-busy', 'false');
      view = errorView(chart);
      announce('チャートを読み込めませんでした。TradingViewの公式ページから閲覧できます。');
    } else {
      // "whenDefined" only confirms the web component module loaded; it is NOT
      // proof that TradingView's cross-origin chart data has rendered.
      stage.dataset.state = state.script === 'ready' ? 'connected' : 'loading';
      stage.setAttribute('aria-busy', String(state.script !== 'ready'));
      announce(state.script === 'ready'
        ? `TradingViewのチャート枠を開きました（${symbol}）。価格やチャートが表示されない場合は、下の公式銘柄リンクで確認してください。`
        : 'TradingViewに接続しています…');
      if (widget?.isConnected) {
        if (widget.getAttribute('symbol') === symbol) {
          stage.querySelector('.mk-live-label')?.replaceWith(liveLabel(chart));
          close.hidden = false;
          return;
        }
        // TradingView's component does not consistently reload when only its
        // symbol attribute changes. Reattach a fresh instance on selection.
        widget = null;
      }
      view = liveView(chart, symbol);
    }
    stage.replaceChildren(view);
    close.hidden = !state.consent || state.script === 'failed';
    // The triggering load button belongs to a replaced subtree. Move keyboard
    // focus to a persistent action instead of leaving it on a detached button.
    if (moveFocus) (close.hidden ? $('load-widget') : close)?.focus();
  }

  for (const key of keys) {
    key.addEventListener('click', () => {
      state.selected = key.dataset.widgetSymbol;
      render();
    });
  }

  close.addEventListener('click', () => {
    state.consent = false;
    state.etfAccepted = false;
    widget = null;
    render();
    announce('チャートを閉じました。');
    $('load-widget')?.focus();
  });

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
