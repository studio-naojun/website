import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('admissions');
const required = [
  'index.html',
  'feed.json',
  'assets/admissions.css',
  'assets/admissions.js',
  'PUBLISHER.md',
  '_templates/report-template.html'
];

let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`FAIL: ${message}`);
};

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) fail(`missing ${relative}`);
}

let feed;
try {
  feed = JSON.parse(fs.readFileSync(path.join(root, 'feed.json'), 'utf8'));
} catch (error) {
  fail(`feed.json invalid: ${error.message}`);
}

if (feed) {
  if (feed.schema_version !== 1) fail('feed schema_version must be 1');
  if (!Array.isArray(feed.entries)) fail('feed.entries must be an array');

  const ids = new Set();
  for (const entry of feed.entries || []) {
    for (const field of ['id', 'type', 'published_at', 'title', 'summary', 'path', 'source_cycle']) {
      if (!entry[field]) fail(`feed entry missing ${field}: ${entry.id || '<unknown>'}`);
    }

    if (!['weekly', 'special'].includes(entry.type)) fail(`unsupported report type: ${entry.type}`);
    if (ids.has(entry.id)) fail(`duplicate feed id: ${entry.id}`);
    ids.add(entry.id);

    if (entry.path.startsWith('/') || entry.path.includes('..')) fail(`unsafe feed path: ${entry.path}`);

    const reportPath = path.join(root, entry.path, 'index.html');
    if (!fs.existsSync(reportPath)) {
      fail(`feed target missing: ${reportPath}`);
      continue;
    }

    const html = fs.readFileSync(reportPath, 'utf8');
    if (!html.includes('<title>')) fail(`report missing title element: ${entry.id}`);
    if (!html.includes('中学受験')) fail(`report missing admissions identity: ${entry.id}`);

    if (html.includes('ffz2bpjyj4-bot/kanade-report-library')) {
      fail(`private source repository exposed in public report: ${entry.id}`);
    }
  }
}

const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const marker of ['中学受験', 'WEEKLY', 'SPECIAL', 'feed.json']) {
  if (!landing.includes(marker) && marker !== 'feed.json') {
    fail(`landing page missing marker: ${marker}`);
  }
}

if (failed) process.exit(1);
console.log('Admissions report smoke checks passed.');
