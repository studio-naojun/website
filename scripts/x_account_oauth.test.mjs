import test from 'node:test';
import assert from 'node:assert/strict';
import {oauthHeader, openState, sealState} from './x_account_oauth.mjs';

test('OAuth request-token header includes callback and deterministic signature inputs', () => {
  const header = oauthHeader('POST', 'https://api.x.com/oauth/request_token', {
    consumerKey: 'key',
    consumerSecret: 'secret',
    callback: 'oob',
    nonce: 'nonce',
    timestamp: 1700000000,
  });
  assert.match(header, /oauth_callback="oob"/);
  assert.match(header, /oauth_consumer_key="key"/);
  assert.match(header, /oauth_signature="/);
  assert.doesNotMatch(header, /oauth_token=/);
});

test('encrypted request state round-trips but cannot be changed', () => {
  const payload = {
    target: 'naojun_juken',
    requestToken: 'request-token',
    requestTokenSecret: 'request-secret',
    createdAt: '2026-11-01T03:00:00.000Z',
  };
  const state = sealState(payload, 'consumer-secret', {iv: Buffer.alloc(12, 7)});
  assert.deepEqual(openState(state, 'consumer-secret', Date.parse('2026-11-01T03:05:00.000Z')), payload);
  const changed = state.slice(0, -1) + (state.endsWith('A') ? 'B' : 'A');
  assert.throws(() => openState(changed, 'consumer-secret', Date.parse('2026-11-01T03:05:00.000Z')));
});

test('request state expires after the bounded authorization window', () => {
  const state = sealState(
    {
      target: 'naojun_security',
      requestToken: 't',
      requestTokenSecret: 's',
      createdAt: '2026-11-01T03:00:00.000Z',
    },
    'consumer-secret',
  );
  assert.throws(
    () => openState(state, 'consumer-secret', Date.parse('2026-11-01T03:31:00.000Z')),
    /expired/,
  );
});

test('authorization URL relies on the active X account and never forces a password login', async () => {
  const {requestAuthorization} = await import('./x_account_oauth.mjs');
  const fetchImpl = async () =>
    new Response(
      'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
      {status:200},
    );
  const result = await requestAuthorization({
    env:{
      NAOJUN_X_API_KEY:'key',
      NAOJUN_X_API_SECRET:'secret',
      TARGET_HANDLE:'naojun_juken',
    },
    fetchImpl,
    now:new Date('2026-11-01T03:00:00.000Z'),
  });
  assert.equal(result.authorizationUrl, 'https://api.x.com/oauth/authorize?oauth_token=request-token');
  assert.doesNotMatch(result.authorizationUrl, /force_login|screen_name/);
});
