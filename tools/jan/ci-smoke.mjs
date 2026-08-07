import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.route('https://unpkg.com/**', (route) => route.abort());
  await page.goto('http://127.0.0.1:4173/tools/jan/', { waitUntil: 'domcontentloaded' });

  await page.locator('#jan-code').fill('123');
  await page.locator('#jan-search-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => !document.querySelector('#jan-error')?.hidden);
  const lengthError = await page.locator('#jan-error').textContent();
  if (!lengthError?.includes('8桁または13桁')) throw new Error('Length validation did not run');

  await page.locator('#jan-code').fill('4901234567894');
  await page.locator('#jan-search-form').evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(100);
  const status = await page.locator('#search-status').textContent();
  if (!status?.includes('価格比較APIがまだ接続されていません')) {
    throw new Error(`Expected unconfigured API message, got: ${status}`);
  }

  await page.locator('#scan-button').click();
  await page.waitForTimeout(100);
  const dialogHidden = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (dialogHidden !== null) throw new Error('Scanner dialog did not open');
  await page.locator('#scanner-close').click();
  const hiddenAfterClose = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (hiddenAfterClose === null) throw new Error('Scanner dialog did not close');

  console.log('JAN search browser smoke passed');
} finally {
  await browser.close();
}
