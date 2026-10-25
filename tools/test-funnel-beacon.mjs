import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const client = readFileSync(new URL('../assets/js/main.js', import.meta.url), 'utf8');
const session = new Map();
const requests = [];

function render(url, referrer = '') {
  const destination = new URL(url);
  const clicks = [];
  const document = {
    referrer,
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener(name, callback) {
      if (name === 'click') clicks.push(callback);
    }
  };
  const navigator = {sendBeacon(endpoint, data) {
    requests.push({ endpoint, data: new URLSearchParams(data) });
    return true;
  }};
  const store = {
    getItem(key) { return session.get(key) ?? null; },
    setItem(key, value) { session.set(key, value); }
  };
  runInNewContext(client, {
    document, navigator, location: destination, sessionStorage: store, URL,
    URLSearchParams, Date, fetch: () => { throw Error('unexpected fetch'); }
  }, { timeout: 1500 });
  return {clicks};
}
const first = render('https://naojun.jp/koechara/?utm_source=bluesky&utm_medium=organic_social&utm_campaign=kc_intro');
const types = () => requests.filter(r => r.endpoint.endsWith('/e')).map(r => r.data.get('action'));
assert.deepEqual(types(), ['landing','koechara_entry']);
first.clicks[0]({target:{closest:()=>({href:'https://naojun-studios.stores.jp/items/example'})}});
assert.deepEqual(types(), ['landing','koechara_entry','store_click']);
assert.equal(requests.at(-1).data.get('campaign'),'kc_intro');
assert.equal(requests.at(-1).data.get('landing'),'/koechara/');
assert.equal(requests.at(-1).data.get('destination'),'STORES');
render('https://naojun.jp/about/','https://naojun.jp/koechara/');
assert.deepEqual(types(), ['landing','koechara_entry','store_click']);
render('https://preview.naojun.test/koechara/?utm_source=bluesky');
assert.deepEqual(types(), ['landing','koechara_entry','store_click']);
for (const r of requests) {
  for (const field of ['email','ip','uid','session_id','fingerprint']) {
    assert.equal(r.data.has(field),false);
  }
}
console.log('PASS: bounded anonymous landing / product entry / store CTA, tab-only attribution, nonproduction silent');
