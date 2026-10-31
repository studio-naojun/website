import { INSTRUMENTS, filterRange, normalizedEquityCompare, verifyHistory } from './history.mjs';

const widgetSymbols = Object.freeze({
  SPX: 'SP:SPX',
  NDX: 'NASDAQ:NDX',
  DJI: 'DJ:DJI',
  BTC: 'BITSTAMP:BTCUSD',
});

const $ = (id) => document.getElementById(id);
const safeNumber = (value, digits = 2) => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);
const jpTime = (iso) => `${new Date(iso).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })} JST`;

function setupExternalChart() {
  let selected = 'SPX';
  let widget = null;
  let requestedScript = false;
  const root = $('tradingview-chart');
  const message = () => {
    const p = document.createElement('p');
    p.id = 'widget-message';
    p.textContent = 'チャートは閉じています。再表示する場合は読み込みボタンを押してください。';
    root.replaceChildren(p);
  };

  for (const button of document.querySelectorAll('[data-widget-symbol]')) {
    button.addEventListener('click', () => {
      selected = button.dataset.widgetSymbol;
      for (const other of document.querySelectorAll('[data-widget-symbol]')) {
        other.setAttribute('aria-pressed', String(other === button));
      }
      if (widget) widget.setAttribute('symbol', widgetSymbols[selected]);
    });
  }

  $('load-widget').addEventListener('click', () => {
    // This click is the sole path that creates a third-party resource request.
    widget = document.createElement('tv-advanced-chart');
    widget.setAttribute('symbol', widgetSymbols[selected]);
    widget.setAttribute('interval', '1D');
    widget.setAttribute('timezone', 'Etc/UTC');
    widget.setAttribute('theme', 'light');
    widget.setAttribute('locale', 'ja');
    widget.setAttribute('aria-label', `${INSTRUMENTS[selected].name} のTradingViewチャート`);
    root.replaceChildren(widget);
    $('load-widget').hidden = true;
    $('close-widget').hidden = false;

    if (!requestedScript) {
      requestedScript = true;
      const script = document.createElement('script');
      script.type = 'module';
      script.src = 'https://widgets.tradingview-widget.com/w/en/tv-advanced-chart.js';
      script.onerror = () => {
        requestedScript = false;
        widget = null;
        message();
        $('widget-message').textContent = 'チャートを読み込めませんでした。下のTradingView公式ページから閲覧できます。';
        $('close-widget').hidden = true;
        $('load-widget').hidden = false;
      };
      document.head.append(script);
    }
  });

  $('close-widget').addEventListener('click', () => {
    widget = null;
    message();
    $('close-widget').hidden = true;
    $('load-widget').hidden = false;
    $('load-widget').focus();
  });
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
    const safePath=new RegExp('^(weekly/[0-9]{4}-[0-9]{2}-[0-9]{2}/|monthly/[0-9]{4}-[0-9]{2}/)
fetch('/investment/markets/history.json', { cache: 'no-store' })
  .then((response) => response.ok ? response.json() : null)
  .then((payload) => {
    const verified = verifyHistory(payload);
    if (verified.ok) setupLicensedHistory(verified);
  })
  .catch(() => {
    // The static no-data copy and official chart links remain usable offline.
  });
);
    const safeDate=new RegExp('^[0-9]{4}-[0-9]{2}-[0-9]{2}
fetch('/investment/markets/history.json', { cache: 'no-store' })
  .then((response) => response.ok ? response.json() : null)
  .then((payload) => {
    const verified = verifyHistory(payload);
    if (verified.ok) setupLicensedHistory(verified);
  })
  .catch(() => {
    // The static no-data copy and official chart links remain usable offline.
  });
);
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
