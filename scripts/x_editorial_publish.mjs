import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {loadAccountCredentials} from './x_account_runtime.mjs';
import {xRequest} from './x_markets_post.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_POST_POINTS = 260;
const LIVE_ATTEMPTS = 12;
const LIVE_DELAY_MS = 10000;
const LIVE_TIMEOUT_MS = 10000;
const RECONCILE_DELAY_MS = 3000;
const CHANNELS = Object.freeze({
  juken: Object.freeze({
    feed: 'admissions/feed.json',
    handle: 'naojun_juken',
    label: '中学受験レポート',
    baseUrl: 'https://naojun.jp/admissions/',
  }),
  security: Object.freeze({
    feed: 'ai-dev/feed.json',
    handle: 'naojun_security',
    label: 'AI・セキュリティ日報',
    baseUrl: 'https://naojun.jp/ai-dev/',
  }),
});

const points = value => [...String(value ?? '')];
const sleepDefault = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));

function truncate(value, maximum) {
  const chars = points(String(value ?? '').trim());
  if (chars.length <= maximum) return chars.join('');
  return chars.slice(0, Math.max(0, maximum - 1)).join('').trimEnd() + '…';
}

export function articleUrl(channel, entry) {
  const config = CHANNELS[channel];
  if (!config) throw new Error('Unknown editorial X channel: ' + channel);
  const relative = String(entry?.path || '').trim().replace(/^\/+|\/+$/g, '');
  if (!relative || relative.split('/').includes('..') || relative.includes('://')) {
    throw new Error('Invalid article path for ' + channel + '.');
  }
  const url = new URL(relative + '/', config.baseUrl);
  if (url.protocol !== 'https:' || url.hostname !== 'naojun.jp' || !url.pathname.startsWith(new URL(config.baseUrl).pathname)) {
    throw new Error('Unexpected article URL.');
  }
  return url.href;
}

export function makePost(channel, entry) {
  const config = CHANNELS[channel];
  const url = articleUrl(channel, entry);
  const prefix = '【' + config.label + '】';
  let title = String(entry?.title || '').trim();
  let summary = String(entry?.summary || '').trim();
  if (!title) throw new Error('Missing article title.');

  title = truncate(title, 110);
  summary = truncate(summary, 110);
  let text = prefix + '\n' + title + (summary ? '\n' + summary : '') + '\n\n' + url;
  if (points(text).length > MAX_POST_POINTS && summary) {
    const fixed = points(prefix + '\n' + title + '\n\n' + url).length + 1;
    summary = truncate(summary, Math.max(0, MAX_POST_POINTS - fixed));
    text = prefix + '\n' + title + (summary ? '\n' + summary : '') + '\n\n' + url;
  }
  if (points(text).length > MAX_POST_POINTS) {
    const fixed = points(prefix + '\n\n\n' + url).length;
    title = truncate(title, Math.max(1, MAX_POST_POINTS - fixed));
    text = prefix + '\n' + title + '\n\n' + url;
  }
  if (points(text).length > MAX_POST_POINTS) throw new Error('Unable to fit article post within X limit.');
  return {text, url};
}

function jstDate(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone:'Asia/Tokyo',
      year:'numeric',
      month:'2-digit',
      day:'2-digit',
    }).formatToParts(now).filter(part=>part.type!=='literal').map(part=>[part.type,part.value]),
  );
  return parts.year+'-'+parts.month+'-'+parts.day;
}

export function validFeedEntry(channel, entry, now = new Date()) {
  if (!CHANNELS[channel] || !entry || typeof entry !== 'object') return false;
  if (!String(entry.id || '').trim() || !String(entry.title || '').trim() || !String(entry.summary || '').trim()) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(entry.published_at || ''))) return false;
  if (String(entry.published_at) > jstDate(now)) return false;
  try {
    articleUrl(channel, entry);
  } catch {
    return false;
  }
  return true;
}

export function selectCandidate(channel, feed, state, now = new Date()) {
  if (!CHANNELS[channel]) throw new Error('Unknown editorial X channel: ' + channel);
  const channelState = state?.channels?.[channel] || {};
  const seen = new Set([
    ...(channelState.baseline_ids || []),
    ...(channelState.published || []).map(row => row?.id).filter(Boolean),
    ...(channelState.uncertain || []).map(row => row?.id).filter(Boolean),
  ]);
  const pending = (feed?.entries || [])
    .filter(entry => validFeedEntry(channel, entry, now) && !seen.has(entry.id))
    .sort((a,b)=>String(a.published_at).localeCompare(String(b.published_at)) || String(a.id).localeCompare(String(b.id)));
  return pending[0] || null;
}

function canonical(value) {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.href.replace(/\/$/, '');
}

export function matchingPosts(rows, url) {
  const target = canonical(url);
  if (!Array.isArray(rows)) return [];
  return rows.filter(row => {
    const urls = [];
    for (const item of row?.entities?.urls || []) {
      if (item?.expanded_url) urls.push(item.expanded_url);
      if (item?.unwound_url) urls.push(item.unwound_url);
    }
    if (typeof row?.text === 'string' && row.text.includes(url)) urls.push(url);
    return urls.some(value => {
      try {
        return canonical(value) === target;
      } catch {
        return false;
      }
    });
  });
}

export async function waitUntilLive(url, {
  expectedTitle = '',
  fetchImpl = fetch,
  attempts = LIVE_ATTEMPTS,
  delayMs = LIVE_DELAY_MS,
  requestTimeoutMs = LIVE_TIMEOUT_MS,
  sleep = sleepDefault,
} = {}) {
  const target = canonical(url);
  const decodeHtml = value => String(value)
    .replace(/&#(x?[0-9a-f]+);/gi,(_,code)=>String.fromCodePoint(code[0].toLowerCase()==='x'?parseInt(code.slice(1),16):parseInt(code,10)))
    .replaceAll('&amp;','&')
    .replaceAll('&lt;','<')
    .replaceAll('&gt;','>')
    .replaceAll('&quot;','"')
    .replaceAll('&#39;',"'");
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {'User-Agent': 'NAOJUN-X-Editorial-Publisher/1.0'},
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (response.ok && canonical(response.url || url) === target) {
        const body = await response.text();
        const canonicalMatch = body.match(/<link\b[^>]*\brel=["']canonical["'][^>]*\bhref=["']([^"']+)["'][^>]*>/i)
          || body.match(/<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']canonical["'][^>]*>/i);
        const pageCanonical = canonicalMatch?.[1];
        const title = String(expectedTitle || '').trim();
        const escapedTitle = title
          .replaceAll('&','&amp;')
          .replaceAll('<','&lt;')
          .replaceAll('>','&gt;')
          .replaceAll('"','&quot;')
          .replaceAll("'",'&#39;');
        const titleMatches = !title || body.includes(title) || body.includes(escapedTitle) || decodeHtml(body).includes(title);
        if (pageCanonical && canonical(pageCanonical) === target && titleMatches) return true;
      }
    } catch {
      // Publication can briefly lag the merge; retry within the bounded release window.
    }
    if (attempt < attempts) await sleep(delayMs);
  }
  return false;
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function ensureState(state, channel) {
  state.schema_version ||= 1;
  state.channels ||= {};
  state.channels[channel] ||= {baseline_ids: [], published: [], uncertain: []};
  state.channels[channel].baseline_ids ||= [];
  state.channels[channel].published ||= [];
  state.channels[channel].uncertain ||= [];
  return state.channels[channel];
}

function finalizeReceipt(state, channel, candidate, post, id, status, now) {
  const config = CHANNELS[channel];
  const channelState = ensureState(state, channel);
  channelState.uncertain = channelState.uncertain.filter(row => row?.id !== candidate.id);
  const receipt = {
    id: candidate.id,
    article_url: post.url,
    x_id: id,
    x_url: 'https://x.com/' + config.handle + '/status/' + id,
    posted_at: now.toISOString(),
    status,
  };
  channelState.published = channelState.published.filter(row => row?.id !== candidate.id);
  channelState.published.push(receipt);
  state.updated_at = now.toISOString();
  return receipt;
}

function uncertainEntry(state, channel) {
  return ensureState(state, channel).uncertain[0] || null;
}

async function markUncertain(statePath,state,channel,candidate,post,now,log){
  const channelState=ensureState(state,channel);
  channelState.uncertain=channelState.uncertain.filter(row=>row?.id!==candidate.id);
  channelState.uncertain.push({
    id:candidate.id,
    article_url:post.url,
    attempted_at:now.toISOString(),
  });
  state.updated_at=now.toISOString();
  await writeFile(statePath,JSON.stringify(state,null,2)+'\n','utf8');
  log('::warning::UNCERTAIN ['+channel+']: POST outcome unknown; later runs reconcile only and never re-POST.');
  return {channel,status:'uncertain',candidate:candidate.id,article_url:post.url};
}

export async function runChannel({
  channel,
  mode = 'publish-one',
  env = process.env,
  root = ROOT,
  now = new Date(),
  fetchImpl = fetch,
  sleep = sleepDefault,
  liveAttempts = LIVE_ATTEMPTS,
  liveDelayMs = LIVE_DELAY_MS,
  liveRequestTimeoutMs = LIVE_TIMEOUT_MS,
  reconcileDelayMs = RECONCILE_DELAY_MS,
  log = console.log,
} = {}) {
  if (!CHANNELS[channel]) throw new Error('Unknown editorial X channel: ' + channel);
  if (!['dry-run', 'publish-one'].includes(mode)) throw new Error('Unsupported editorial publisher mode.');
  const config = CHANNELS[channel];
  const feed = await loadJson(resolve(root, config.feed));
  const statePath = resolve(root, 'content/x-editorial-state.json');
  const state = await loadJson(statePath);
  const unresolved = uncertainEntry(state, channel);
  const candidate = unresolved
    ? (feed?.entries || []).find(entry => entry?.id === unresolved.id) || null
    : selectCandidate(channel, feed, state, now);
  if (!candidate) {
    if (unresolved) {
      log('UNCERTAIN [' + channel + ']: original feed entry is no longer present; no POST attempted.');
      return {channel,status:'uncertain-pending',candidate:unresolved.id};
    }
    log('UP TO DATE: ' + channel + ' has no unpublished article; no X API call made.');
    return {channel, status: 'up-to-date'};
  }
  const post = makePost(channel, candidate);
  if (mode === 'dry-run') {
    log('DRY RUN [' + channel + ']: ' + candidate.id + '\n' + post.text);
    return {channel, status: 'dry-run', candidate: candidate.id, text: post.text};
  }

  const live = await waitUntilLive(post.url, {
    expectedTitle:candidate.title,
    fetchImpl,
    attempts: liveAttempts,
    delayMs: liveDelayMs,
    requestTimeoutMs: liveRequestTimeoutMs,
    sleep,
  });
  if (!live) {
    log('WAITING LIVE [' + channel + ']: ' + post.url);
    return {channel,status:'waiting-live',candidate:candidate.id,article_url:post.url};
  }

  const creds = await loadAccountCredentials({
    target: config.handle,
    env,
    storePath: resolve(root, 'content/x-account-credentials.enc.json'),
  });
  const me = await xRequest('GET', '/2/users/me', creds, {fetchImpl});
  if (!me.data?.id || me.data.username?.toLowerCase() !== config.handle) {
    throw new Error('Wrong X account; expected @' + config.handle + '. Aborting.');
  }

  const recentPath =
    '/2/users/' +
    encodeURIComponent(me.data.id) +
    '/tweets?max_results=20&tweet.fields=entities';
  const recent = await xRequest('GET', recentPath, creds, {fetchImpl});
  if (recent.data != null && !Array.isArray(recent.data)) {
    throw new Error('Unverifiable recent X posts; aborting.');
  }
  const existing = matchingPosts(recent.data || [], post.url);

  if (unresolved) {
    const recovered = existing[0];
    if (!recovered?.id) {
      log('::warning::UNCERTAIN [' + channel + ']: no matching X post observed; automatic re-POST remains disabled.');
      return {channel,status:'uncertain-pending',candidate:candidate.id,article_url:post.url};
    }
    const receipt = finalizeReceipt(state,channel,candidate,post,recovered.id,'reconciled',now);
    await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
    log('RECONCILED [' + channel + ']: ' + receipt.x_url);
    return {channel,status:'reconciled',candidate:candidate.id,...receipt};
  }

  let id;
  let status;
  if (existing[0]?.id) {
    id = existing[0].id;
    status = 'reconciled';
  } else {
    try {
      const result = await xRequest('POST', '/2/tweets', creds, {
        body: {text: post.text},
        fetchImpl,
      });
      if (!result.data?.id) throw new Error('X POST succeeded without a tweet id.');
      id = result.data.id;
      status = 'posted';
    } catch (error) {
      if (reconcileDelayMs > 0) await sleep(reconcileDelayMs);
      let recovered;
      try{
        const after=await xRequest('GET',recentPath,creds,{fetchImpl});
        if(after.data!=null&&!Array.isArray(after.data)) throw new Error('Unverifiable reconciliation response.');
        recovered=matchingPosts(after.data||[],post.url)[0];
      }catch{
        recovered=null;
      }
      if (!recovered?.id) {
        return markUncertain(statePath,state,channel,candidate,post,now,log);
      }
      id = recovered.id;
      status = 'reconciled';
    }
  }

  const receipt = finalizeReceipt(state,channel,candidate,post,id,status,now);
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  log(status.toUpperCase() + ' [' + channel + ']: ' + receipt.x_url);
  return {channel, status, candidate: candidate.id, ...receipt};
}

export async function runAll(options = {}) {
  const results = [];
  const failures = [];
  for (const channel of ['juken', 'security']) {
    try {
      const result=await runChannel({...options,channel});
      results.push(result);
      if(result.status==='uncertain'){
        failures.push({channel,message:'POST outcome uncertain; receipt stored and automatic re-POST disabled.'});
      }
    } catch (error) {
      failures.push({channel, message: error.message});
    }
  }
  if (failures.length) {
    const error = new Error(
      failures.map(item => item.channel + ': ' + item.message).join(' | '),
    );
    error.results = results;
    throw error;
  }
  return results;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const mode = process.env.X_EDITORIAL_MODE || 'publish-one';
  runAll({mode}).catch(error => {
    console.error('Editorial X publisher failed: ' + error.message);
    process.exitCode = 1;
  });
}
