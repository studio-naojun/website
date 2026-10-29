import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const smoke = fileURLToPath(new URL('./smoke.mjs', import.meta.url));

// Exercise the actual publication check against temporary static reports.
// No network, credentials, or real publication tree are touched.
function runSmoke(extraHtml) {
  const temp = mkdtempSync(path.join(tmpdir(), 'admissions-guard-'));
  try {
    const root = path.join(temp, 'admissions');
    const files = {
      'index.html': '\u4e2d\u5b66\u53d7\u9a13 WEEKLY SPECIAL',
      'assets/admissions.css': '',
      'assets/admissions.js': '',
      'PUBLISHER.md': 'fixture',
      '_templates/report-template.html': '<html></html>',
      'weekly/2026-10-26/index.html': '<title>Fixture</title>\u4e2d\u5b66\u53d7\u9a13' + extraHtml,
      'feed.json': JSON.stringify({ schema_version: 1, entries: [{
        id: 'weekly-2026-10-26', type: 'weekly', published_at: '2026-10-26',
        title: 'Fixture', summary: 'Fixture report', path: 'weekly/2026-10-26/',
        source_cycle: 'admissions-weekly-2026-10-26'
      }] })
    };
    for (const [relative, text] of Object.entries(files)) {
      const file = path.join(root, relative);
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, text, 'utf8');
    }
    const result = spawnSync(process.execPath, [smoke], {
      cwd: temp, encoding: 'utf8', timeout: 10000
    });
    assert.ifError(result.error);
    return result;
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
}

for (const [name, html] of [
  ['clean report', '<p>Public evidence.</p>'],
  ['unrelated public repository', '<a href="https://github.com/example/public-report">source</a>']
]) {
  test('allows ' + name, () => {
    const result = runSmoke(html);
    assert.equal(result.status, 0, result.stderr);
  });
}

for (const [name, value] of [
  ['legacy owner', 'https://github.com/ffz2bpjyj4-bot/kanade-report-library/blob/main/reports/internal.md'],
  ['renamed owner', 'https://github.com/new-owner/kanade-report-library/blob/main/reports/internal.md'],
  ['raw content URL', 'https://raw.githubusercontent.com/new-owner/kanade-report-library/main/internal.md'],
  ['owner-free reference', 'kanade-report-library'],
  ['case-variant reference', 'https://github.com/new-owner/KANADE-REPORT-LIBRARY']
]) {
  test('rejects private source with ' + name, () => {
    const result = runSmoke('<a href="' + value + '">source</a>');
    assert.equal(result.status, 1, 'Private reference incorrectly passed: ' + result.stdout);
    assert.match(result.stderr, /private source repository exposed/);
  });
}
