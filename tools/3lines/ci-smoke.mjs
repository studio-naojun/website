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

async function assertResultFocused(label) {
  await page.waitForFunction(() => document.activeElement?.id === 'result-section');
  try {
    await page.waitForFunction(() => {
      const element = document.querySelector('#result-section');
      if (!element) return false;
      const top = element.getBoundingClientRect().top;
      return top >= -2 && top <= 80;
    }, null, { timeout: 3000 });
  } catch {
    const top = await page.locator('#result-section').evaluate((element) => element.getBoundingClientRect().top);
    throw new Error(`${label}: result section was not scrolled into focus, top=${top}`);
  }
}

async function styleItems(label, style) {
  await page.getByRole('radio', { name: label }).click();
  await waitForCompletedResult(style);
  await assertResultFocused(`style ${style}`);
  return page.locator('#result-items > li').allTextContents();
}

try {
  await page.goto('http://127.0.0.1:4173/tools/3lines/', { waitUntil: 'domcontentloaded' });
  console.log('smoke: loaded');
  if (!(await page.locator('#source-text').isVisible()) || !(await page.locator('#summarize-button').isVisible())) throw new Error('First viewport controls are not visible');
  const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  if (overflow.scrollWidth > overflow.clientWidth + 1) throw new Error(`Horizontal overflow: ${JSON.stringify(overflow)}`);
  if (!(await page.locator('#input-help').textContent())?.includes('追加モデルのダウンロードは不要')) throw new Error('Zero-model-download disclosure missing');
  if (await page.locator('#style-options').isVisible()) throw new Error('Style controls should not interrupt the first two-step flow');

  const longText = await readFile(join(repoRoot, 'tools/3lines/tests/fixtures/jun-legaltech-72-20260824.txt'), 'utf8');
  const marker = 'AIに契約書を読ませていいのか問題';
  if (!longText.includes(marker)) throw new Error('Jun smoke fixture marker missing');
  if ([...longText].length > 20000) throw new Error('Jun smoke fixture exceeds input cap');

  await page.locator('#source-text').fill(longText);
  await page.locator('#summarize-button').click();
  const earlyStatus = await page.locator('#status-label').textContent();
  if (!/処理|整理|できました/.test(earlyStatus || '')) throw new Error(`Processing state missing: ${earlyStatus}`);
  await waitForCompletedResult('gist');
  await assertResultFocused('initial 3-line run');

  if (!(await page.locator('#result-section #style-options').isVisible())) throw new Error('Style controls are not inside the result surface');
  const firstItems = await page.locator('#result-items > li').allTextContents();
  const firstJoined = firstItems.join(' ');
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Input was not preserved');
  if (firstItems.length !== 3) throw new Error('Result is not exactly three items');
  if (!/^全体[:：]/u.test(firstItems[0]) || !/法務省/u.test(firstItems[0]) || !/AI法務支援サービス/u.test(firstItems[0]) || !/弁護士法第?72条/u.test(firstItems[0]) || !/法務業務/u.test(firstItems[0])) {
    throw new Error(`Body-grounded overview failed: ${firstItems[0]}`);
  }
  if (/AIに契約書を読ませていいのか問題/u.test(firstItems[0])) throw new Error(`Marketing headline leaked into overview: ${firstItems[0]}`);
  if (!/^肝[:：]/u.test(firstItems[1]) || !/事件性/u.test(firstItems[1]) || !/紛争性のある法律案件/u.test(firstItems[1]) || !/使われ方/u.test(firstItems[1])) {
    throw new Error(`Explained core-thesis line failed: ${firstItems[1]}`);
  }
  if (!/^結局[:：]/u.test(firstItems[2]) || !/リサーチ/u.test(firstItems[2]) || !/書面/u.test(firstItems[2]) || !/紛争/u.test(firstItems[2]) || !/弁護士/u.test(firstItems[2])) {
    throw new Error(`Standalone bottom-line failed: ${firstItems[2]}`);
  }
  if (/セーフ7類型|グレー/u.test(firstItems[2])) throw new Error(`Unexplained shorthand leaked into bottom line: ${firstItems[2]}`);
  if (!(await page.locator('#result-meta').textContent())?.includes('端末内要約')) throw new Error('Local deterministic engine label missing');

  const pointItems = await styleItems('論点3つ', 'points');
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Style switch lost input');
  if (!/^論点1[|｜]/u.test(pointItems[0]) || !/弁護士法第?72条/u.test(pointItems[0]) || !/紛争性のある法律案件/u.test(pointItems[0])) throw new Error(`points issue 1 failed: ${pointItems[0]}`);
  if (!/^論点2[|｜]/u.test(pointItems[1]) || !/提供側/u.test(pointItems[1]) || !/向けに作らない/u.test(pointItems[1]) || !/使われ方/u.test(pointItems[1])) throw new Error(`points issue 2 failed: ${pointItems[1]}`);
  if (!/^論点3[|｜]/u.test(pointItems[2]) || !/どこまでAI/u.test(pointItems[2]) || !/リサーチ/u.test(pointItems[2]) || !/弁護士/u.test(pointItems[2])) throw new Error(`points issue 3 failed: ${pointItems[2]}`);
  if (/セーフの分水嶺|設計がセーフでも「用法」でアウト/u.test(pointItems.join(' '))) throw new Error(`points leaked old source-heading summary: ${JSON.stringify(pointItems)}`);

  const easyItems = await styleItems('やさしく', 'easy');
  if (!/^何の話[?？]/u.test(easyItems[0]) || !/AIを使う法務支援サービス/u.test(easyItems[0])) throw new Error(`easy overview failed: ${easyItems[0]}`);
  if (!/^大事なのは、/u.test(easyItems[1]) || !/紛争性のある法律案件/u.test(easyItems[1]) || !/使われ方/u.test(easyItems[1])) throw new Error(`easy core failed: ${easyItems[1]}`);
  if (!/^つまり、/u.test(easyItems[2]) || !/リサーチ/u.test(easyItems[2]) || !/弁護士/u.test(easyItems[2])) throw new Error(`easy bottom line failed: ${easyItems[2]}`);
  if (/事件性|価値中立性|セーフ7類型/u.test(easyItems.join(' '))) throw new Error(`easy mode kept unexplained jargon: ${JSON.stringify(easyItems)}`);

  const faithfulItems = await styleItems('忠実に', 'faithful');
  if (!/^全体[:：]/u.test(faithfulItems[0]) || !/ビジネス分野におけるAI等法務業務支援サービス提供/u.test(faithfulItems[0])) throw new Error(`faithful overview failed: ${faithfulItems[0]}`);
  if (!/^基準[:：]/u.test(faithfulItems[1]) || !/事件性/u.test(faithfulItems[1]) || !/評価しにくい/u.test(faithfulItems[1])) throw new Error(`faithful boundary failed: ${faithfulItems[1]}`);
  if (!/^留保[:：]/u.test(faithfulItems[2]) || !/認識・認容/u.test(faithfulItems[2]) || !/評価され得る/u.test(faithfulItems[2])) throw new Error(`faithful caveat failed: ${faithfulItems[2]}`);

  const signatures = [firstItems, pointItems, easyItems, faithfulItems].map((items) => JSON.stringify(items));
  if (new Set(signatures).size !== 4) throw new Error(`Styles were not materially distinct: ${JSON.stringify(signatures)}`);
  if (navigations !== 1) throw new Error(`Unexpected page reload during style switches: ${navigations}`);

  await page.getByRole('radio', { name: '要するに' }).click();
  await waitForCompletedResult('gist');
  await assertResultFocused('repeated gist');
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

  console.log('3lines v1.6 style/focus Jun-fixture mobile smoke passed');
  console.log(firstJoined);
  console.log(`points=${JSON.stringify(pointItems)}`);
  console.log(`easy=${JSON.stringify(easyItems)}`);
  console.log(`faithful=${JSON.stringify(faithfulItems)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
