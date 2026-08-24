import { readFile } from 'node:fs/promises';
import { composeThreeLines } from '../src/composer.js';

const legal = await readFile(new URL('./fixtures/jun-legaltech-72-20260824.txt', import.meta.url), 'utf8');
const quality = JSON.parse(await readFile(new URL('./fixtures/quality.json', import.meta.url), 'utf8'));

const legalResult = composeThreeLines(legal, 'gist');
console.log('--- DETERMINISTIC JUN OUTPUT ---');
console.log(legalResult.items.map((item, index) => `${index + 1}. ${item}`).join('\n'));
console.log('--- END OUTPUT ---');

if (legalResult.items.length !== 3) throw new Error('Jun fixture did not produce exactly three items');
const joined = legalResult.items.join(' ');
if (!/法務省/u.test(joined) || !/弁護士法72条/u.test(joined)) throw new Error('Jun topic missing');
if (!/価値中立/u.test(joined) || !/(?:用法|運用)/u.test(joined)) throw new Error('Jun boundary missing');
if (!/(?:弁護士|裁判所|和解|紛争)/u.test(joined)) throw new Error('Jun practical escalation missing');

function terms(text) {
  const normalized = String(text).normalize('NFKC').toLocaleLowerCase('ja-JP');
  const found = normalized.match(/[\p{Script=Han}]{2,}|[\p{Script=Katakana}]{2,}|[a-z]{2,}|\d+/gu) || [];
  const stop = new Set(['する','した','して','いる','ある','こと','もの','ため','場合','必要','できる','なる','べき','という']);
  return new Set(found.filter((value) => !stop.has(value)));
}

function overlap(claim, output) {
  const a = terms(claim);
  const b = terms(output);
  if (!a.size) return 0;
  let shared = 0;
  for (const term of a) if (b.has(term)) shared += 1;
  return shared / a.size;
}

let fixturesWithTwoClaims = 0;
const report = [];
for (const fixture of quality) {
  const result = composeThreeLines(fixture.source, 'gist');
  const output = result.items.join(' ');
  const scores = fixture.major_claims.map((claim) => Number(overlap(claim, output).toFixed(2)));
  const covered = scores.filter((score) => score >= 0.34).length;
  if (covered >= 2) fixturesWithTwoClaims += 1;
  report.push({ id: fixture.id, covered, scores, items: result.items });
}
console.log(JSON.stringify({ fixturesWithTwoClaims, total: quality.length, report }, null, 2));
