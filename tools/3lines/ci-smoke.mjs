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
  if ((await stat(filePath).catch(() => null))?.isDirectory()) filePath = join(filePath, 'index.html');
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

async function waitForCompletedResult(style) {
  await page.waitForFunction((expectedStyle) => {
    const form = document.querySelector('#summary-form');
    const result = document.querySelector('#result-section');
    const error = document.querySelector('#error-section');
    const selected = document.querySelector(`[data-style="${expectedStyle}"]`);
    const idle = form?.getAttribute('aria-busy') === 'false';
    const resultReady = !result?.hidden && result?.querySelectorAll('#result-items > li').length === 3;
    return idle && selected?.getAttribute('aria-checked') === 'true' && (resultReady || !error?.hidden);
  }, style);
  if (!(await page.locator('#error-section').isHidden())) throw new Error(`Summarization failed: ${await page.locator('#error-detail').textContent()}`);
}

async function assertResultFocused(label) {
  await page.waitForFunction(() => document.activeElement?.id === 'result-section');
  try {
    await page.waitForFunction(() => {
      const result = document.querySelector('#result-section');
      const title = document.querySelector('#result-title');
      if (!result || !title) return false;
      const top = result.getBoundingClientRect().top;
      const titleRect = title.getBoundingClientRect();
      return top >= -2 && top <= window.innerHeight * 0.35 && titleRect.bottom > 0 && titleRect.top < window.innerHeight * 0.5;
    }, null, { timeout: 3000 });
  } catch {
    const top = await page.locator('#result-section').evaluate((element) => element.getBoundingClientRect().top);
    throw new Error(`${label}: result surface did not become the screen focus, top=${top}`);
  }
}

async function switchStyle(label, style) {
  await page.getByRole('radio', { name: label }).click();
  await waitForCompletedResult(style);
  await assertResultFocused(`style ${style}`);
  return page.locator('#result-items > li').allTextContents();
}

try {
  await page.goto('http://127.0.0.1:4173/tools/3lines/', { waitUntil: 'domcontentloaded' });
  console.log('smoke: loaded');
  if (!(await page.locator('#source-text').isVisible()) || !(await page.locator('#summarize-button').isVisible())) throw new Error('Initial input controls missing');
  if (await page.locator('#style-options').isVisible()) throw new Error('Style controls should appear only with results');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Horizontal overflow: ${overflow}`);

  const longText = await readFile(join(repoRoot, 'tools/3lines/tests/fixtures/jun-legaltech-72-20260824.txt'), 'utf8');
  const marker = 'AIに契約書を読ませていいのか問題';
  await page.locator('#source-text').fill(longText);
  await page.locator('#summarize-button').click();
  await waitForCompletedResult('gist');
  await assertResultFocused('initial 3-line run');
  if (!(await page.locator('#result-section #style-options').isVisible())) throw new Error('Style switcher is not inside result surface');
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Input was not preserved');

  const gist = await page.locator('#result-items > li').allTextContents();
  if (gist.length !== 3 || !/^全体[:：]/u.test(gist[0]) || !/^肝[:：]/u.test(gist[1]) || !/^結局[:：]/u.test(gist[2])) throw new Error(`Gist contract failed: ${JSON.stringify(gist)}`);
  if (!/AI法務支援サービス/u.test(gist[0]) || /AIに契約書を読ませていいのか問題/u.test(gist[0])) throw new Error(`Gist topic failed: ${gist[0]}`);

  if (await page.locator('#notes-section').isHidden()) throw new Error('Material supplement was not shown for the legaltech fixture');
  const notes = await page.locator('#notes-items > li').allTextContents();
  if (notes.length < 1 || notes.length > 3) throw new Error(`Supplement count invalid: ${JSON.stringify(notes)}`);
  if (notes.join('').length > 300) throw new Error(`Supplements are too long: ${JSON.stringify(notes)}`);

  if (!(await page.locator('#detail-control').isVisible())) throw new Error('Detailed summary control is missing');
  if (!(await page.locator('#detail-section').isHidden())) throw new Error('Detailed summary should be collapsed initially');
  await page.locator('#detail-toggle').click();
  if (!(await page.locator('#detail-section').isVisible())) throw new Error('Detailed summary did not expand');
  if ((await page.locator('#detail-toggle').getAttribute('aria-expanded')) !== 'true') throw new Error('Detailed summary aria state is wrong');
  const detail = (await page.locator('#detail-text').textContent())?.trim() || '';
  if ([...detail].length < 180) throw new Error(`Detailed summary is too short: ${detail}`);
  if (!/弁護士|AI|法律/u.test(detail)) throw new Error(`Detailed summary lost the article subject: ${detail}`);
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Opening detailed summary lost source');

  const points = await switchStyle('論点3つ', 'points');
  if (!/^論点1[|｜]/u.test(points[0]) || !/弁護士法第?72条/u.test(points[0]) || !/紛争性のある法律案件/u.test(points[0])) throw new Error(`Points 1 failed: ${points[0]}`);
  if (!/^論点2[|｜]/u.test(points[1]) || !/提供側/u.test(points[1]) || !/使われ方/u.test(points[1])) throw new Error(`Points 2 failed: ${points[1]}`);
  if (!/^論点3[|｜]/u.test(points[2]) || !/どこまでAI/u.test(points[2]) || !/弁護士/u.test(points[2])) throw new Error(`Points 3 failed: ${points[2]}`);
  if (/セーフの分水嶺|設計がセーフでも「用法」でアウト/u.test(points.join(' '))) throw new Error(`Old points leaked: ${JSON.stringify(points)}`);
  if (!(await page.locator('#detail-section').isVisible())) throw new Error('Detailed summary should stay open during style switching');
  const detailAfterStyle = (await page.locator('#detail-text').textContent())?.trim() || '';
  if (detailAfterStyle !== detail) throw new Error('Source-level detailed summary changed with 3-line style');

  const easy = await switchStyle('やさしく', 'easy');
  if (!/^何の話[?？]/u.test(easy[0]) || !/^大事なのは、/u.test(easy[1]) || !/^つまり、/u.test(easy[2])) throw new Error(`Easy contract failed: ${JSON.stringify(easy)}`);
  if (/事件性|価値中立性|セーフ7類型/u.test(easy.join(' '))) throw new Error(`Easy mode kept jargon: ${JSON.stringify(easy)}`);

  const faithful = await switchStyle('忠実に', 'faithful');
  if (!/^全体[:：]/u.test(faithful[0]) || !/^基準[:：]/u.test(faithful[1]) || !/^留保[:：]/u.test(faithful[2])) throw new Error(`Faithful contract failed: ${JSON.stringify(faithful)}`);
  if (!/認識・認容/u.test(faithful[2]) || !/評価され得る/u.test(faithful[2])) throw new Error(`Faithful qualification failed: ${faithful[2]}`);

  if (new Set([gist, points, easy, faithful].map((items) => JSON.stringify(items))).size !== 4) throw new Error('Four styles are not materially distinct');
  if (navigations !== 1) throw new Error(`Style switching reloaded page: ${navigations}`);

  const repeated = await switchStyle('要するに', 'gist');
  if (JSON.stringify(repeated) !== JSON.stringify(gist)) throw new Error('Repeated gist is not deterministic');
  if ((await page.locator('#source-text').inputValue()) !== longText) throw new Error('Style switching lost source');

  await page.locator('#detail-toggle').click();
  if (!(await page.locator('#detail-section').isHidden())) throw new Error('Detailed summary did not collapse');
  await page.locator('#copy-button').click();
  await page.waitForFunction(() => document.querySelector('#copy-button')?.textContent.includes('コピーしました'));
  await page.locator('#good-button').click();
  await page.waitForFunction(() => document.querySelector('#feedback-status')?.textContent.includes('受け付け'));

  await page.locator('#source-text').fill('あ'.repeat(20001));
  await page.locator('#summarize-button').click();
  await page.waitForFunction(() => !document.querySelector('#input-error')?.hidden);
  if (!(await page.locator('#input-error').textContent())?.includes('20,000')) throw new Error('Over-limit error missing');

  if (requests.some(({ url, body }) => url.includes(marker) || body.includes(marker))) throw new Error('Raw fixture leaked into request');
  const external = requests.filter(({ url }) => !url.startsWith('http://127.0.0.1:4173/'));
  if (external.length) throw new Error(`Unexpected external requests: ${JSON.stringify(external)}`);

  await page.goto('http://127.0.0.1:4173/tools/3lines/tests/quality/review.html', { waitUntil: 'networkidle' });
  if (await page.locator('.case').count() !== 20) throw new Error('Quality review surface is not 20 cases');

  console.log('3lines v1.7 supplements/detail mobile smoke passed');
  console.log(`notes=${JSON.stringify(notes)}`);
  console.log(`detail=${JSON.stringify(detail)}`);
  console.log(`gist=${JSON.stringify(gist)}`);
  console.log(`points=${JSON.stringify(points)}`);
  console.log(`easy=${JSON.stringify(easy)}`);
  console.log(`faithful=${JSON.stringify(faithful)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
