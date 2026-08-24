import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
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
page.on('request', (request) => requests.push({ url: request.url(), body: request.postData() || '' }));
page.on('pageerror', (error) => console.error(`PAGEERROR: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') console.error(`CONSOLE: ${message.text()}`); });
await page.addInitScript(() => {
  try { Object.defineProperty(navigator, 'gpu', { configurable: true, value: undefined }); } catch { /* unsupported property */ }
});

try {
  await page.goto('http://127.0.0.1:4173/tools/3lines/', { waitUntil: 'domcontentloaded' });
  console.log('smoke: loaded');
  if (!(await page.locator('#source-text').isVisible()) || !(await page.locator('#summarize-button').isVisible())) throw new Error('First viewport controls are not visible');
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  if (overflow.scrollWidth > overflow.clientWidth + 1) throw new Error(`Horizontal overflow: ${JSON.stringify(overflow)}`);

  const canary = 'canary-3lines-local-only';
  const longText = Array.from({ length: 300 }, (_, index) => `第${index + 1}段では、${canary}を含む文章の要点を確認する。条件がある場合は無理に断定しない。`).join('\n');
  await page.locator('#source-text').fill(longText);
  await page.locator('#summarize-button').click();
  console.log('smoke: clicked');
  const earlyStatus = await page.locator('#status-label').textContent();
  if (!/処理|準備|作成|できました/.test(earlyStatus || '')) throw new Error(`Processing state missing: ${earlyStatus}`);
  await page.waitForFunction(() => document.querySelectorAll('#result-items > li').length === 3);
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Input was not preserved');
  if ((await page.locator('#result-items > li').count()) !== 3) throw new Error('Result is not exactly three items');
  if ((await page.locator('#result-meta').textContent())?.includes('外部')) throw new Error('Unexpected external engine');

  await page.getByRole('radio', { name: '論点3つ' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#result-items > li').length === 3 && document.querySelector('#source-text').value.length > 0);
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Style switch lost input');
  await page.locator('#copy-button').click();
  await page.waitForFunction(() => document.querySelector('#copy-button').textContent.includes('コピーしました'));
  await page.locator('#good-button').click();
  await page.waitForFunction(() => document.querySelector('#feedback-status').textContent.includes('受け付け'));

  await page.getByRole('radio', { name: 'やさしく' }).click();
  await page.waitForFunction(() => document.querySelectorAll('#result-items > li').length === 3);
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

  const leaked = requests.find(({ url, body }) => url.includes(canary) || body.includes(canary));
  if (leaked) throw new Error(`Raw input leaked into request: ${JSON.stringify(leaked)}`);
  if (requests.some(({ url }) => /openai|anthropic|gemini|generativelanguage|cohere/iu.test(url))) throw new Error('External generative endpoint was called');

  await page.goto('http://127.0.0.1:4173/tools/3lines/tests/quality/review.html', { waitUntil: 'networkidle' });
  if (await page.locator('.case').count() !== 20) throw new Error('Quality review surface does not contain 20 cases');
  console.log('3lines mobile fallback smoke passed');
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
