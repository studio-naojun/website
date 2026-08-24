import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const relative = normalize(requestPath.replace(/^\/+/, ''));
  let filePath = join(repoRoot, relative);
  const fileInfo = await stat(filePath).catch(() => null);
  if (fileInfo?.isDirectory()) filePath = join(filePath, 'index.html');
  if (!filePath.startsWith(repoRoot) || !(await stat(filePath).catch(() => null))?.isFile()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.writeHead(200, { 'Content-Type': mime[extname(filePath)] || 'application/octet-stream' });
  createReadStream(filePath).pipe(response);
});
await new Promise((resolve) => server.listen(4173, '127.0.0.1', resolve));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const requests = [];
let navigations = 0;
page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() || '' }));
page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations += 1; });
page.on('pageerror', (error) => console.error(`PAGEERROR: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') console.error(`CONSOLE: ${message.text()}`); });

async function waitForCompletedResult(style) {
  await page.waitForFunction((expectedStyle) => {
    const form = document.querySelector('#summary-form');
    const result = document.querySelector('#result-section');
    const error = document.querySelector('#error-section');
    const selected = document.querySelector(`[data-style="${expectedStyle}"]`);
    const idle = form?.getAttribute('aria-busy') === 'false';
    const styleReady = selected?.getAttribute('aria-checked') === 'true';
    const resultReady = !result?.hidden && result?.querySelectorAll('#result-items > li').length === 3;
    const errorReady = !error?.hidden;
    return idle && styleReady && (resultReady || errorReady);
  }, style);
  if (!(await page.locator('#error-section').isHidden())) throw new Error(`Browser summarization failed: ${await page.locator('#error-detail').textContent()}`);
}

async function styleItems(label, style) {
  await page.getByRole('radio', { name: label }).click();
  await waitForCompletedResult(style);
  return page.locator('#result-items > li').allTextContents();
}

try {
  await page.goto('http://127.0.0.1:4173/tools/3lines/', { waitUntil: 'domcontentloaded' });
  console.log('smoke: loaded');
  if (!(await page.locator('#source-text').isVisible()) || !(await page.locator('#summarize-button').isVisible())) throw new Error('First viewport controls are not visible');
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  if (overflow.scrollWidth > overflow.clientWidth + 1) throw new Error(`Horizontal overflow: ${JSON.stringify(overflow)}`);
  if (!(await page.locator('#input-help').textContent())?.includes('追加モデルのダウンロードは不要')) throw new Error('Zero-model-download disclosure missing');

  const longText = await readFile(join(repoRoot, 'tools/3lines/tests/fixtures/jun-legaltech-72-20260824.txt'), 'utf8');
  const marker = 'AIに契約書を読ませていいのか問題';
  if (!longText.includes(marker)) throw new Error('Jun smoke fixture marker missing');
  if ([...longText].length > 20000) throw new Error('Jun smoke fixture exceeds input cap');

  await page.locator('#source-text').fill(longText);
  await page.locator('#summarize-button').click();
  const earlyStatus = await page.locator('#status-label').textContent();
  if (!/処理|整理|できました/.test(earlyStatus || '')) throw new Error(`Processing state missing: ${earlyStatus}`);
  await waitForCompletedResult('gist');

  const firstItems = await page.locator('#result-items > li').allTextContents();
  const firstJoined = firstItems.join(' ');
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Input was not preserved');
  if (firstItems.length !== 3) throw new Error('Result is not exactly three items');
  if (!/法務省/u.test(firstItems[0]) || !/弁護士法72条/u.test(firstItems[0])) throw new Error(`Topic line failed: ${firstItems[0]}`);
  if (!/価値中立/u.test(firstItems[1]) || !/アウト/u.test(firstItems[1])) throw new Error(`Boundary line failed: ${firstItems[1]}`);
  if (!/弁護士/u.test(firstItems[2]) || !/(?:紛争|裁判所|和解)/u.test(firstItems[2])) throw new Error(`Action line failed: ${firstItems[2]}`);
  if (!(await page.locator('#result-meta').textContent())?.includes('端末内要約')) throw new Error('Local deterministic engine label missing');

  const pointItems = await styleItems('論点3つ', 'points');
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Style switch lost input');
  if (JSON.stringify(pointItems) === JSON.stringify(firstItems)) throw new Error('points style duplicated gist output');

  const easyItems = await styleItems('やさしく', 'easy');
  if (JSON.stringify(easyItems) === JSON.stringify(firstItems)) throw new Error('easy style duplicated gist output');
  if (JSON.stringify(easyItems) === JSON.stringify(pointItems)) throw new Error('easy style duplicated points output');
  if (!/どこまでならよいか/u.test(easyItems[0]) || !/かんたんに/u.test(easyItems[1]) || !/使う側/u.test(easyItems[2])) {
    throw new Error(`easy style did not use reader-friendly route: ${JSON.stringify(easyItems)}`);
  }

  const faithfulItems = await styleItems('忠実に', 'faithful');
  for (const [name, items] of [['gist', firstItems], ['points', pointItems], ['easy', easyItems]]) {
    if (JSON.stringify(faithfulItems) === JSON.stringify(items)) throw new Error(`faithful style duplicated ${name} output`);
  }
  if (/かんたんに：|使う側：/u.test(faithfulItems.join(' '))) throw new Error(`faithful style contained easy rewrite labels: ${JSON.stringify(faithfulItems)}`);
  if (navigations !== 1) throw new Error(`Unexpected page reload during style switches: ${navigations}`);

  await page.getByRole('radio', { name: '要するに' }).click();
  await waitForCompletedResult('gist');
  const repeatedItems = await page.locator('#result-items > li').allTextContents();
  if (JSON.stringify(firstItems) !== JSON.stringify(repeatedItems)) throw new Error(`Repeated gist result was not deterministic: first=${JSON.stringify(firstItems)} repeated=${JSON.stringify(repeatedItems)}`);
  if (navigations !== 1) throw new Error(`Unexpected page reload during repeated run: ${navigations}`);

  await page.locator('#copy-button').click();
  await page.waitForFunction(() => document.querySelector('#copy-button').textContent.includes('コピーしました'));
  await page.locator('#good-button').click();
  await page.waitForFunction(() => document.querySelector('#feedback-status').textContent.includes('受け付け'));

  await page.getByRole('radio', { name: 'やさしく' }).click();
  await waitForCompletedResult('easy');
  await page.locator('#bad-button').click();
  if (await page.locator('#bad-reasons').isHidden()) throw new Error('Bad reasons did not appear');
  await page.locator('[data-reason="missing"]').click();
  if (!(await page.locator('#feedback-status').textContent())?.includes('受け付け')) throw new Error('Bad reason was not acknowledged');

  const tooLong = 'あ'.repeat(20001);
  await page.locator('#source-text').fill(tooLong);
  await page.locator('#summarize-button').click();
  await page.waitForFunction(() => !document.querySelector('#input-error')?.hidden);
  if (!(await page.locator('#input-error').textContent())?.includes('20,000')) throw new Error('Over-limit message missing');
  if ((await page.locator('#source-text').inputValue()) !== tooLong) throw new Error('Over-limit input was lost');

  const leaked = requests.find(({ url, body }) => url.includes(marker) || body.includes(marker));
  if (leaked) throw new Error(`Raw input leaked into request: ${JSON.stringify(leaked)}`);
  const external = requests.filter(({ url }) => !url.startsWith('http://127.0.0.1:4173/'));
  if (external.length) throw new Error(`Unexpected external requests during summarization: ${JSON.stringify(external)}`);

  await page.goto('http://127.0.0.1:4173/tools/3lines/tests/quality/review.html', { waitUntil: 'networkidle' });
  if (await page.locator('.case').count() !== 20) throw new Error('Quality review surface does not contain 20 cases');

  console.log('3lines deterministic Jun-fixture mobile smoke passed');
  console.log(firstJoined);
  console.log(`points=${JSON.stringify(pointItems)}`);
  console.log(`easy=${JSON.stringify(easyItems)}`);
  console.log(`faithful=${JSON.stringify(faithfulItems)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
