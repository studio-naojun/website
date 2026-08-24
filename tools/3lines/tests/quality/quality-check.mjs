import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarizeExtractively } from '../../src/fallback.js';
import { validateSummary } from '../../src/validator.js';

const fixtures = JSON.parse(await readFile(new URL('../fixtures/quality.json', import.meta.url), 'utf8'));
assert.equal(fixtures.length, 20, 'quality set must contain at least 20 cases');
const report = fixtures.map((fixture) => {
  const result = summarizeExtractively(fixture.source, 'gist');
  const validation = validateSummary(result, fixture.source);
  assert.equal(validation.ok, true, `${fixture.id}: ${validation.reason || 'invalid output'}`);
  assert.equal(result.items.length, 3, `${fixture.id}: not exactly three items`);
  return { id: fixture.id, type: fixture.type, engine: result.engine, items: result.items, notes: result.notes };
});
console.log(JSON.stringify({ fixtureCount: fixtures.length, automatedInvariantPass: report.length, report }, null, 2));
