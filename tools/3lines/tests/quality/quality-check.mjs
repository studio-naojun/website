import { readFile } from 'node:fs/promises';
import { composeThreeLines } from '../../src/composer.js';
import { validateSummary } from '../../src/validator.js';
import { extractLiterals } from '../../src/normalizer.js';

const fixtures = JSON.parse(await readFile(new URL('../fixtures/quality.json', import.meta.url), 'utf8'));
if (fixtures.length !== 20) throw new Error(`quality set must contain 20 cases, got ${fixtures.length}`);

const report = [];
let invariantPass = 0;
let claimCoveragePass = 0;

function terms(text) {
  const normalized = String(text).normalize('NFKC').toLocaleLowerCase('ja-JP');
  const found = normalized.match(/[\p{Script=Han}]{2,}|[\p{Script=Katakana}]{2,}|[a-z]{2,}|\d+/gu) || [];
  const stop = new Set(['する','した','して','いる','ある','こと','もの','ため','場合','必要','できる','なる','べき','という','として','これ','それ','この','その']);
  return new Set(found.filter((value) => !stop.has(value)));
}

function overlap(claim, output) {
  const expected = terms(claim);
  const actual = terms(output);
  if (!expected.size) return 0;
  let shared = 0;
  for (const term of expected) if (actual.has(term)) shared += 1;
  return shared / expected.size;
}

for (const fixture of fixtures) {
  const result = composeThreeLines(fixture.source, 'gist');
  const validated = validateSummary(result, fixture.source);
  if (!validated.ok) throw new Error(`${fixture.id}: validator=${validated.reason}`);
  if (validated.items.length !== 3) throw new Error(`${fixture.id}: not exactly 3 items`);
  if (validated.items.some((item) => [...item].length > 120)) throw new Error(`${fixture.id}: item over 120 chars`);

  const sourceLiterals = extractLiterals(fixture.source);
  const outputLiterals = extractLiterals(validated.items.join('\n'));
  const sourceNumbers = new Set(sourceLiterals.numbers);
  const sourceUrls = new Set(sourceLiterals.urls);
  const inventedNumbers = outputLiterals.numbers.filter((value) => !sourceNumbers.has(value));
  const inventedUrls = outputLiterals.urls.filter((value) => !sourceUrls.has(value));
  if (inventedNumbers.length || inventedUrls.length) {
    throw new Error(`${fixture.id}: invented literals numbers=${inventedNumbers} urls=${inventedUrls}`);
  }
  invariantPass += 1;

  const output = validated.items.join(' ');
  const claimScores = fixture.major_claims.map((claim) => Number(overlap(claim, output).toFixed(2)));
  const coveredClaims = claimScores.filter((score) => score >= 0.34).length;
  if (coveredClaims >= Math.min(2, fixture.major_claims.length)) claimCoveragePass += 1;

  report.push({
    id: fixture.id,
    type: fixture.type,
    engine: result.engine,
    coveredClaims,
    claimScores,
    items: validated.items,
    notes: validated.notes,
  });
}

if (invariantPass < 20) throw new Error(`Automated invariant gate failed: ${invariantPass}/20`);
if (claimCoveragePass < 16) throw new Error(`Automated major-claim proxy gate failed: ${claimCoveragePass}/20`);

console.log(JSON.stringify({
  fixtureCount: fixtures.length,
  automatedInvariantPass: invariantPass,
  automatedMajorClaimProxyPass: claimCoveragePass,
  report,
}, null, 2));
