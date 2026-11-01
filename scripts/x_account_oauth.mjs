import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  publicEncrypt,
  randomBytes,
} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const API_HOST = 'https://api.x.com';
const REQUEST_TOKEN_URL = API_HOST + '/oauth/request_token';
const ACCESS_TOKEN_URL = API_HOST + '/oauth/access_token';
const AUTHORIZE_URL = API_HOST + '/oauth/authorize';
const STATE_MAX_AGE_MS = 30 * 60 * 1000;

export const enc = value =>
  encodeURIComponent(String(value)).replace(
    /[!'()*]/g,
    char => '%' + char.charCodeAt(0).toString(16).toUpperCase(),
  );

function normalizedPairs(url, oauth) {
  return [...url.searchParams, ...Object.entries(oauth)]
    .filter(([key]) => key !== 'oauth_signature')
    .map(([key, value]) => [enc(key), enc(value)])
    .sort((a, b) =>
      a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0,
    );
}

export function oauthHeader(
  method,
  endpoint,
  {
    consumerKey,
    consumerSecret,
    token = '',
    tokenSecret = '',
    callback,
    verifier,
    nonce = randomBytes(16).toString('hex'),
    timestamp = Math.floor(Date.now() / 1000),
  },
) {
  if (!consumerKey || !consumerSecret) throw new Error('Missing X consumer credentials.');
  const url = new URL(endpoint);
  if (url.origin !== API_HOST || url.protocol !== 'https:') throw new Error('Unexpected X OAuth origin.');
  const oauth = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp),
    oauth_version: '1.0',
    ...(token ? {oauth_token: token} : {}),
    ...(callback ? {oauth_callback: callback} : {}),
    ...(verifier ? {oauth_verifier: verifier} : {}),
  };
  const normalized = normalizedPairs(url, oauth)
    .map(([key, value]) => key + '=' + value)
    .join('&');
  const base = [method.toUpperCase(), enc(url.origin + url.pathname), enc(normalized)].join('&');
  const signingKey = enc(consumerSecret) + '&' + enc(tokenSecret);
  oauth.oauth_signature = createHmac('sha1', signingKey).update(base).digest('base64');
  return (
    'OAuth ' +
    Object.entries(oauth)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, value]) => enc(key) + '="' + enc(value) + '"')
      .join(', ')
  );
}

function stateKey(consumerSecret) {
  return createHash('sha256').update('naojun-x-oauth-state-v1\0' + consumerSecret).digest();
}

export function sealState(payload, consumerSecret, {iv = randomBytes(12)} = {}) {
  if (!consumerSecret) throw new Error('Missing state encryption secret.');
  const cipher = createCipheriv('aes-256-gcm', stateKey(consumerSecret), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function openState(encoded, consumerSecret, now = Date.now()) {
  if (!encoded || !consumerSecret) throw new Error('Missing OAuth state.');
  const packed = Buffer.from(encoded, 'base64url');
  if (packed.length < 29) throw new Error('Invalid OAuth state.');
  const iv = packed.subarray(0, 12);
  const tag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);
  const decipher = createDecipheriv('aes-256-gcm', stateKey(consumerSecret), iv);
  decipher.setAuthTag(tag);
  const payload = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8'));
  if (!payload.createdAt || now - Date.parse(payload.createdAt) > STATE_MAX_AGE_MS) {
    throw new Error('OAuth request state expired.');
  }
  return payload;
}

async function formRequest(method, endpoint, auth, fetchImpl = fetch) {
  const response = await fetchImpl(endpoint, {
    method,
    headers: {Authorization: auth},
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  if (!response.ok) throw new Error('X OAuth HTTP ' + response.status + ': ' + raw.slice(0, 180));
  return new URLSearchParams(raw);
}

async function verifyUser(creds, fetchImpl = fetch) {
  const endpoint = API_HOST + '/2/users/me';
  const response = await fetchImpl(endpoint, {
    method: 'GET',
    headers: {
      Authorization: oauthHeader('GET', endpoint, {
        consumerKey: creds.consumerKey,
        consumerSecret: creds.consumerSecret,
        token: creds.token,
        tokenSecret: creds.tokenSecret,
      }),
    },
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.data?.username) {
    throw new Error('Unable to verify authorized X user.');
  }
  return payload.data;
}

function targetHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) throw new Error('Invalid target X handle.');
  return handle;
}

export async function requestAuthorization({
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const consumerKey = env.NAOJUN_X_API_KEY;
  const consumerSecret = env.NAOJUN_X_API_SECRET;
  const target = targetHandle(env.TARGET_HANDLE);
  const auth = oauthHeader('POST', REQUEST_TOKEN_URL, {
    consumerKey,
    consumerSecret,
    callback: 'oob',
  });
  const result = await formRequest('POST', REQUEST_TOKEN_URL, auth, fetchImpl);
  const requestToken = result.get('oauth_token');
  const requestTokenSecret = result.get('oauth_token_secret');
  if (!requestToken || !requestTokenSecret || result.get('oauth_callback_confirmed') !== 'true') {
    throw new Error('X did not return a valid OAuth request token.');
  }
  const state = sealState(
    {
      target,
      requestToken,
      requestTokenSecret,
      createdAt: now.toISOString(),
    },
    consumerSecret,
  );
  return {
    target,
    authorizationUrl:
      AUTHORIZE_URL +
      '?oauth_token=' +
      enc(requestToken) +
      '&force_login=true&screen_name=' +
      enc(target),
    state,
  };
}

export async function exchangeAuthorization({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  const consumerKey = env.NAOJUN_X_API_KEY;
  const consumerSecret = env.NAOJUN_X_API_SECRET;
  const target = targetHandle(env.TARGET_HANDLE);
  const verifier = String(env.OAUTH_VERIFIER || '').trim();
  if (!/^\d{4,12}$/.test(verifier) && !/^[A-Za-z0-9_-]{4,64}$/.test(verifier)) {
    throw new Error('Invalid OAuth verifier.');
  }
  const state = openState(env.OAUTH_STATE, consumerSecret, now);
  if (state.target !== target) throw new Error('OAuth state target mismatch.');
  const auth = oauthHeader('POST', ACCESS_TOKEN_URL, {
    consumerKey,
    consumerSecret,
    token: state.requestToken,
    tokenSecret: state.requestTokenSecret,
    verifier,
  });
  const result = await formRequest('POST', ACCESS_TOKEN_URL, auth, fetchImpl);
  const token = result.get('oauth_token');
  const tokenSecret = result.get('oauth_token_secret');
  if (!token || !tokenSecret) throw new Error('X did not return a user access token.');
  const user = await verifyUser({consumerKey, consumerSecret, token, tokenSecret}, fetchImpl);
  if (user.username.toLowerCase() !== target) {
    throw new Error('Wrong X account authorized; expected @' + target + ', got @' + user.username + '.');
  }
  const publicKeyPem = Buffer.from(String(env.PUBLIC_KEY_B64 || ''), 'base64').toString('utf8');
  if (!publicKeyPem.includes('BEGIN PUBLIC KEY')) throw new Error('Missing one-time public key.');
  const plaintext = Buffer.from(
    JSON.stringify({
      username: user.username,
      userId: user.id,
      accessToken: token,
      accessTokenSecret: tokenSecret,
    }),
    'utf8',
  );
  const encrypted = publicEncrypt(
    {
      key: publicKeyPem,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    plaintext,
  );
  return {username: user.username, ciphertext: encrypted.toString('base64')};
}

async function main() {
  const mode = process.argv[2];
  const result =
    mode === 'request'
      ? await requestAuthorization()
      : mode === 'exchange'
        ? await exchangeAuthorization()
        : (() => {
            throw new Error('Mode must be request or exchange.');
          })();
  process.stdout.write(JSON.stringify(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error('X account OAuth failed: ' + error.message);
    process.exitCode = 1;
  });
}
