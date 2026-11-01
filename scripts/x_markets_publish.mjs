import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {xRequest} from './x_markets_post.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'https://api.x.com';
const HANDLE = 'naojun_markets';
const DEFAULT_LAUNCH_CUTOFF = '2026-10-31';

const points = value => [...String(value ?? '')];
const clip = (value, maximum) => {
  const chars = points(String(value ?? '').trim());
  if (chars.length <= maximum) return chars.join('');
  return chars.slice(0, Math.max(1, maximum - 1)).join('').trimEnd() + '…';
};

export function makePost(entry) {
  if (!entry?.title || !entry?.summary || !entry?.path) throw new Error('Invalid investment feed entry.');
  const url = 'https://naojun.jp/investment/' + String(entry.path).replace(/^\/+|\/+$/g, '') + '/';
  const title = clip(entry.title, 52);
  const summary = clip(entry.summary, 46);
  return {
    url,
    text: '【NAOJUN Markets】\n' + title + '\n\n' + summary + '\n\n' + url,
  };
}

export function selectCandidate(feed, state, now = new Date()) {
  const published = new Set((state?.published ?? []).map(row => row?.id).filter(Boolean));
  const cutoff = state?.launch_cutoff || DEFAULT_LAUNCH_CUTOFF;
  const today = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const entries = Array.isArray(feed?.entries) ? feed.entries : [];
  return entries.find(entry =>
    ['weekly', 'monthly'].includes(entry?.type) &&
    /^\d{4}-\d{2}-\d{2}$/.test(entry?.published_at || '') &&
    entry.published_at >= cutoff &&
    entry.published_at <= today &&
    !published.has(entry.id) &&
    entry.title && entry.summary && entry.path
  ) || null;
}

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

function credentials(env) {
  const creds = {
    key: env.NAOJUN_X_API_KEY,
    secret: env.NAOJUN_X_API_SECRET,
    token: env.NAOJUN_X_ACCESS_TOKEN,
    tokenSecret: env.NAOJUN_X_ACCESS_TOKEN_SECRET,
  };
  if (Object.values(creds).some(value => !value)) throw new Error('Missing X API credentials.');
  return creds;
}

export async function run({
  mode = process.env.X_MARKETS_PUBLISH_MODE || 'dry-run',
  env = process.env,
  now = new Date(),
  fetchImpl = fetch,
  root = ROOT,
  log = console.log,
} = {}) {
  if (!['dry-run', 'publish-one'].includes(mode)) throw new Error('Unsupported publisher mode.');
  const feedPath = resolve(root, 'investment/feed.json');
  const statePath = resolve(root, 'content/x-markets-state.json');
  const feed = await loadJson(feedPath, {entries: []});
  const state = await loadJson(statePath, {schema_version: 1, launch_cutoff: DEFAULT_LAUNCH_CUTOFF, published: []});
  const candidate = selectCandidate(feed, state, now);
  if (!candidate) {
    log('UP TO DATE: no unpublished Markets entry; no X API call made.');
    return {status: 'up-to-date'};
  }

  const post = makePost(candidate);
  if (mode === 'dry-run') {
    log('DRY RUN: ' + candidate.id + '\n' + post.text);
    return {status: 'dry-run', candidate: candidate.id, text: post.text};
  }

  const creds = credentials(env);
  const me = await xRequest('GET', '/2/users/me', creds, {fetchImpl});
  if (!me.data?.id || me.data.username?.toLowerCase() !== HANDLE) {
    throw new Error('Wrong X account; expected @' + HANDLE + '. Aborting.');
  }

  const recent = await xRequest('GET', '/2/users/' + encodeURIComponent(me.data.id) + '/tweets?max_results=20', creds, {fetchImpl});
  if (recent.data != null && !Array.isArray(recent.data)) throw new Error('Unverifiable recent posts; aborting.');
  const duplicate = (recent.data || []).find(row => row?.text === post.text);
  let id;
  let status;
  if (duplicate?.id) {
    id = duplicate.id;
    status = 'reconciled';
  } else {
    const result = await xRequest('POST', '/2/tweets', creds, {body: {text: post.text}, fetchImpl});
    if (!result.data?.id || result.data.text !== post.text) {
      throw new Error('Uncertain POST response; inspect account before retrying.');
    }
    id = result.data.id;
    status = 'posted';
  }

  const url = 'https://x.com/' + HANDLE + '/status/' + id;
  state.schema_version = 1;
  state.launch_cutoff ||= DEFAULT_LAUNCH_CUTOFF;
  state.published ||= [];
  state.published.push({
    id: candidate.id,
    x_id: id,
    x_url: url,
    source_url: post.url,
    posted_at: now.toISOString(),
  });
  state.updated_at = now.toISOString();
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  log(status.toUpperCase() + ': ' + url);
  return {status, candidate: candidate.id, id, url};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch(error => {
    console.error('Markets publisher failed: ' + error.message);
    process.exitCode = 1;
  });
}
