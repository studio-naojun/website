import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {xRequest} from './x_markets_post.mjs';
import {loadAccountCredentials} from './x_account_runtime.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HANDLE = 'naojun_markets';
const MAX_POST_POINTS = 280;

const points = value => [...String(value ?? '')];

function jstParts(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value])
  );
  return {
    date: parts.year + '-' + parts.month + '-' + parts.day,
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
  };
}

export function dailyMarker(entry) {
  if (!entry?.date) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(entry.date);
  if (!match) return '';
  return '【' + Number(match[2]) + '/' + Number(match[3]) + ' 朝の市場】';
}

export function validateDailyEntry(entry, now = new Date()) {
  if (!entry || typeof entry !== 'object') return {ok:false, reason:'missing-entry'};
  if (!/^daily-\d{4}-\d{2}-\d{2}$/.test(entry.id || '')) return {ok:false, reason:'bad-id'};
  if (entry.id !== 'daily-' + entry.date) return {ok:false, reason:'id-date-mismatch'};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date || '')) return {ok:false, reason:'bad-date'};
  if (typeof entry.text !== 'string' || entry.text.trim() !== entry.text) return {ok:false, reason:'bad-text'};
  if (points(entry.text).length < 40 || points(entry.text).length > MAX_POST_POINTS) return {ok:false, reason:'bad-length'};
  const marker = dailyMarker(entry);
  if (!marker || !entry.text.startsWith(marker)) return {ok:false, reason:'missing-marker'};
  if (!entry.generated_at || !entry.data_as_of) return {ok:false, reason:'missing-timestamps'};
  if (!Array.isArray(entry.sources) || entry.sources.length < 2) return {ok:false, reason:'missing-sources'};
  if (entry.sources.some(source => !source?.url || !/^https?:\/\//.test(source.url))) return {ok:false, reason:'bad-source'};
  const jst = jstParts(now);
  if (entry.date !== jst.date) return {ok:false, reason:'not-today'};
  if (jst.hour < 5 || jst.hour >= 11) return {ok:false, reason:'outside-morning-window'};
  return {ok:true};
}

export function selectDailyCandidate(queue, state, now = new Date()) {
  const entry = queue?.entry;
  const valid = validateDailyEntry(entry, now);
  if (!valid.ok) return null;
  const published = new Set((state?.published ?? []).map(row => row?.id).filter(Boolean));
  return published.has(entry.id) ? null : entry;
}

export function matchingDailyPosts(rows, entry) {
  const marker = dailyMarker(entry);
  if (!marker || !Array.isArray(rows)) return [];
  return rows.filter(row => typeof row?.text === 'string' && row.text.includes(marker));
}

async function loadJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function run({
  mode = process.env.X_MARKETS_DAILY_MODE || 'dry-run',
  env = process.env,
  now = new Date(),
  fetchImpl = fetch,
  root = ROOT,
  log = console.log,
} = {}) {
  if (!['dry-run', 'publish-one'].includes(mode)) throw new Error('Unsupported daily publisher mode.');
  const queuePath = resolve(root, 'content/x-markets-daily.json');
  const statePath = resolve(root, 'content/x-markets-state.json');
  const queue = await loadJson(queuePath, {schema_version:1, entry:null});
  const state = await loadJson(statePath, {schema_version:1, published:[]});
  const candidate = selectDailyCandidate(queue, state, now);
  if (!candidate) {
    log('UP TO DATE: no publishable morning Markets entry; no X API call made.');
    return {status:'up-to-date'};
  }

  if (mode === 'dry-run') {
    log('DRY RUN: ' + candidate.id + '\n' + candidate.text);
    return {status:'dry-run', candidate:candidate.id, text:candidate.text};
  }

  const creds = await loadAccountCredentials({
    target: HANDLE,
    env,
    storePath: resolve(root, 'content/x-account-credentials.enc.json'),
  });
  const me = await xRequest('GET', '/2/users/me', creds, {fetchImpl});
  if (!me.data?.id || me.data.username?.toLowerCase() !== HANDLE) {
    throw new Error('Wrong X account; expected @' + HANDLE + '. Aborting.');
  }

  const recentPath = '/2/users/' + encodeURIComponent(me.data.id) + '/tweets?max_results=20';
  const recent = await xRequest('GET', recentPath, creds, {fetchImpl});
  if (recent.data != null && !Array.isArray(recent.data)) throw new Error('Unverifiable recent posts; aborting.');
  const existing = matchingDailyPosts(recent.data || [], candidate);

  let id;
  let status;
  if (existing[0]?.id) {
    id = existing[0].id;
    status = 'reconciled';
  } else {
    try {
      const result = await xRequest('POST', '/2/tweets', creds, {body:{text:candidate.text}, fetchImpl});
      if (!result.data?.id) throw new Error('X POST succeeded without a tweet id.');
      id = result.data.id;
      status = 'posted';
    } catch (error) {
      const after = await xRequest('GET', recentPath, creds, {fetchImpl});
      if (after.data != null && !Array.isArray(after.data)) throw error;
      const recovered = matchingDailyPosts(after.data || [], candidate)[0];
      if (!recovered?.id) throw error;
      id = recovered.id;
      status = 'reconciled';
    }
  }

  const url = 'https://x.com/' + HANDLE + '/status/' + id;
  state.schema_version = 1;
  state.published ||= [];
  state.published.push({
    id:candidate.id,
    type:'daily',
    x_id:id,
    x_url:url,
    data_as_of:candidate.data_as_of,
    posted_at:now.toISOString(),
  });
  state.updated_at = now.toISOString();
  await writeFile(statePath, JSON.stringify(state, null, 2) + '\n', 'utf8');
  log(status.toUpperCase() + ': ' + url);
  return {status, candidate:candidate.id, id, url, existing_count:existing.length};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  run().catch(error => {
    console.error('Markets morning publisher failed: ' + error.message);
    process.exitCode = 1;
  });
}
