import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('investment');
const required = [
  'index.html',
  'feed.json',
  'state.json',
  'assets/investment.css',
  'assets/investment.js',
  'PUBLISHER.md',
  '_templates/article-template.html'
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
let state;
try {
  feed = JSON.parse(fs.readFileSync(path.join(root, 'feed.json'), 'utf8'));
} catch (error) {
  fail(`feed.json invalid: ${error.message}`);
}

try {
  state = JSON.parse(fs.readFileSync(path.join(root, 'state.json'), 'utf8'));
} catch (error) {
  fail(`state.json invalid: ${error.message}`);
}

if (feed) {
  if (feed.schema_version !== 1) fail('feed schema_version must be 1');
  if (!Array.isArray(feed.entries)) fail('feed.entries must be an array');

  const ids = new Set();
  for (const entry of feed.entries || []) {
    for (const field of ['id', 'type', 'published_at', 'title', 'summary', 'path', 'source_cycle']) {
      if (!entry[field]) fail(`feed entry missing ${field}: ${entry.id || '<unknown>'}`);
    }
    if (!['weekly', 'monthly'].includes(entry.type)) fail(`unsupported article type: ${entry.type}`);
    if (ids.has(entry.id)) fail(`duplicate feed id: ${entry.id}`);
    ids.add(entry.id);

    if (entry.path.startsWith('/') || entry.path.includes('..')) fail(`unsafe feed path: ${entry.path}`);
    const articlePath = path.join(root, entry.path, 'index.html');
    if (!fs.existsSync(articlePath)) {
      fail(`feed target missing: ${articlePath}`);
      continue;
    }

    const html = fs.readFileSync(articlePath, 'utf8');
    if (!html.includes('<title>')) fail(`article missing title element: ${entry.id}`);
    if (!html.includes('Investment Observatory')) fail(`article missing Observatory identity: ${entry.id}`);
    if (!html.includes('投資助言')) fail(`article missing analysis disclaimer: ${entry.id}`);
  }
}

if (state) {
  if (state.schema_version !== 1) fail('state schema_version must be 1');
  if (!Array.isArray(state.scenarios)) fail('state.scenarios must be an array');
  if (!Array.isArray(state.forecasts)) fail('state.forecasts must be an array');

  if ((state.scenarios || []).length) {
    const total = state.scenarios.reduce((sum, item) => sum + Number(item.probability || 0), 0);
    if (Math.abs(total - 100) > 0.001) fail(`scenario probabilities must total 100, got ${total}`);
  }

  const forecastIds = new Set();
  for (const item of state.forecasts || []) {
    if (!item.id || !item.label) fail('forecast entries require id and label');
    if (forecastIds.has(item.id)) fail(`duplicate forecast id: ${item.id}`);
    forecastIds.add(item.id);
  }
}

const landing = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
for (const marker of ['state.json', 'feed.json', 'Investment Observatory']) {
  if (!landing.includes(marker) && marker !== 'state.json' && marker !== 'feed.json') {
    fail(`landing page missing marker: ${marker}`);
  }
}

if (failed) process.exit(1);
console.log('Investment Observatory smoke checks passed.');
