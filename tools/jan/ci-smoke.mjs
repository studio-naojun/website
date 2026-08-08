import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

try {
  await page.route('https://unpkg.com/**', (route) => route.abort());
  await page.route(/https:\/\/(www\.yodobashi\.com|www\.amazon\.co\.jp|search\.rakuten\.co\.jp|shopping\.yahoo\.co\.jp)\/.*/, (route) => route.abort());
  await page.goto('http://127.0.0.1:4173/tools/jan/', { waitUntil: 'domcontentloaded' });

  await page.locator('#jan-code').fill('123');
  await page.locator('#jan-search-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => !document.querySelector('#jan-error')?.hidden);
  const lengthError = await page.locator('#jan-error').textContent();
  if (!lengthError?.includes('8桁または13桁')) throw new Error('Length validation did not run');

  const jan = '4902370550733';
  await page.locator('#jan-code').fill(jan);
  await page.locator('#jan-search-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => !document.querySelector('#store-search')?.hidden);

  const currentJan = await page.locator('#current-jan').textContent();
  if (currentJan !== jan) throw new Error(`JAN was not preserved: ${currentJan}`);

  const tabCount = await page.locator('.jan-store-tab').count();
  if (tabCount !== 4) throw new Error(`Expected 4 retailer tabs, got ${tabCount}`);

  const yodobashiHref = await page.locator('#store-link').getAttribute('href');
  const yodobashiFrame = await page.locator('#store-frame').getAttribute('src');
  if (!yodobashiHref?.includes('yodobashi.com/?word=4902370550733')) {
    throw new Error(`Unexpected Yodobashi URL: ${yodobashiHref}`);
  }
  if (yodobashiFrame !== yodobashiHref) throw new Error(`Yodobashi iframe did not match link: ${yodobashiFrame}`);

  await page.getByRole('tab', { name: 'Amazon' }).click();
  const amazonHref = await page.locator('#store-link').getAttribute('href');
  const amazonFrame = await page.locator('#store-frame').getAttribute('src');
  if (!amazonHref?.includes('amazon.co.jp/s?k=4902370550733')) {
    throw new Error(`Unexpected Amazon URL: ${amazonHref}`);
  }
  if (amazonFrame !== amazonHref) throw new Error(`Amazon iframe did not switch: ${amazonFrame}`);

  await page.getByRole('tab', { name: '楽天市場' }).click();
  const rakutenHref = await page.locator('#store-link').getAttribute('href');
  const rakutenFrame = await page.locator('#store-frame').getAttribute('src');
  if (!rakutenHref?.includes('search.rakuten.co.jp/search/mall/4902370550733/')) {
    throw new Error(`Unexpected Rakuten URL: ${rakutenHref}`);
  }
  if (rakutenFrame !== rakutenHref) throw new Error(`Rakuten iframe did not switch: ${rakutenFrame}`);

  await page.getByRole('tab', { name: 'Yahoo!' }).click();
  const yahooHref = await page.locator('#store-link').getAttribute('href');
  const yahooFrame = await page.locator('#store-frame').getAttribute('src');
  if (!yahooHref?.includes('shopping.yahoo.co.jp/search/4902370550733/0/')) {
    throw new Error(`Unexpected Yahoo URL: ${yahooHref}`);
  }
  if (yahooFrame !== yahooHref) throw new Error(`Yahoo iframe did not switch: ${yahooFrame}`);

  const target = await page.locator('#store-link').getAttribute('target');
  if (target !== '_blank') throw new Error(`Retailer link must open in a new window: ${target}`);

  if (!page.url().includes(`jan=${jan}`)) throw new Error(`JAN query parameter missing: ${page.url()}`);

  await page.locator('#next-store').click();
  const selectedAfterNext = await page.locator('.jan-store-tab[aria-selected="true"]').textContent();
  if (selectedAfterNext !== 'ヨドバシ') throw new Error(`Next-store rotation failed: ${selectedAfterNext}`);

  await page.evaluate(() => {
    window.__janOpenedUrls = [];
    window.open = (url) => {
      window.__janOpenedUrls.push(String(url));
      return {};
    };
  });
  await page.locator('#open-all-stores').click();
  const openedUrls = await page.evaluate(() => window.__janOpenedUrls);
  if (openedUrls.length !== 4) throw new Error(`Expected 4 bulk-open URLs, got ${openedUrls.length}`);
  for (const expected of ['yodobashi.com', 'amazon.co.jp', 'search.rakuten.co.jp', 'shopping.yahoo.co.jp']) {
    if (!openedUrls.some((url) => url.includes(expected) && url.includes(jan))) {
      throw new Error(`Bulk-open missing ${expected}: ${openedUrls.join(', ')}`);
    }
  }

  await page.locator('#scan-button').click();
  const dialogHidden = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (dialogHidden !== null) throw new Error('Scanner dialog did not open');
  await page.locator('#scanner-close').click();
  const hiddenAfterClose = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (hiddenAfterClose === null) throw new Error('Scanner dialog did not close');

  console.log('JAN inline retailer browser smoke passed');
} finally {
  await browser.close();
}
