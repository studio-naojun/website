import test from 'node:test';
import assert from 'node:assert/strict';
import {SHARE_URL, shareCopy, shareGameResult} from '../works/ametsuta/play/share-result.mjs';

test('score shares only rounded visible game meters and a tagged official URL', () => {
  assert.match(shareCopy(123, 235), /12\.3 m/);
  assert.match(shareCopy(123, 235), /23\.5 m/);
  assert.equal(new URL(SHARE_URL).hostname, 'naojun.jp');
  assert.equal(new URL(SHARE_URL).searchParams.get('utm_source'), 'share');
});

test('native share requires an explicit caller and does not use clipboard on success', async () => {
  const calls = [];
  const result = await shareGameResult({height: 30, best: 45, platform: {
    share: async (data) => calls.push(data),
    clipboard: {writeText: async () => {throw Error('unexpected copy');}}
  }});
  assert.equal(result, 'shared');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, SHARE_URL);
});

test('user cancellation never copies or posts again', async () => {
  let copies = 0;
  const result = await shareGameResult({height: 30, best: 30, platform: {
    share: async () => {throw Object.assign(Error('cancelled'), {name: 'AbortError'});},
    clipboard: {writeText: async () => {copies++;}}
  }});
  assert.equal(result, 'cancelled');
  assert.equal(copies, 0);
});

test('unavailable native share falls back to local clipboard only', async () => {
  let pasted = '';
  const result = await shareGameResult({height: 30, best: 45, platform: {
    share: async () => {throw Error('share denied');},
    clipboard: {writeText: async (text) => {pasted = text;}}
  }});
  assert.equal(result, 'copied');
  assert.ok(pasted.includes(SHARE_URL));
  assert.ok(pasted.includes('3.0 m'));
});

test('unsupported browsers do not auto-send or throw', async () => {
  assert.equal(await shareGameResult({height: 0, best: 0, platform: {}}), 'unavailable');
});

test('the published iframe and result controls keep the share action user initiated', async () => {
  const {readFileSync} = await import('node:fs');
  const html = readFileSync(new URL('../works/ametsuta/play/index.html', import.meta.url), 'utf8');
  const outer = readFileSync(new URL('../works/ametsuta/index.html', import.meta.url), 'utf8');
  const source = readFileSync(new URL('../works/ametsuta/play/main.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="share-button"/);
  assert.match(html, /share-status/);
  assert.match(outer, /web-share; clipboard-write/);
  assert.match(source, /shareGameResult\(/);
  assert.match(source, /e\.code === 'Tab'/);
});
