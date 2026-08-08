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

  const jan = '4902370550733';
  await page.locator('#jan-code').fill(jan);
  await page.locator('#jan-search-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => !document.querySelector('#store-search')?.hidden);

  const currentJan = await page.locator('#current-jan').textContent();
  if (currentJan !== jan) throw new Error(`JAN was not preserved: ${currentJan}`);

  const tabs = page.locator('.jan-store-tab');
  const tabCount = await tabs.count();
  if (tabCount !== 4) throw new Error(`Expected 4 retailer tabs, got ${tabCount}`);

  const expectedTabs = [
    ['ヨドバシ', 'yodobashi.com/?word=4902370550733'],
    ['Amazon', 'amazon.co.jp/s?k=4902370550733'],
    ['楽天市場', 'search.rakuten.co.jp/search/mall/4902370550733/'],
    ['Yahoo!', 'shopping.yahoo.co.jp/search/4902370550733/0/'],
  ];

  for (const [name, expectedUrl] of expectedTabs) {
    const tab = page.getByRole('tab', { name });
    const tagName = await tab.evaluate((element) => element.tagName);
    const href = await tab.getAttribute('href');
    const target = await tab.getAttribute('target');
    const rel = await tab.getAttribute('rel');

    if (tagName !== 'A') throw new Error(`${name} tab must be a direct link, got ${tagName}`);
    if (!href?.includes(expectedUrl)) throw new Error(`Unexpected ${name} tab URL: ${href}`);
    if (target !== '_blank') throw new Error(`${name} tab must open in a new window: ${target}`);
    if (!rel?.includes('noopener')) throw new Error(`${name} tab must use noopener: ${rel}`);
  }

  const yodobashiHref = await page.locator('#store-link').getAttribute('href');
  if (!yodobashiHref?.includes('yodobashi.com/?word=4902370550733')) {
    throw new Error(`Unexpected Yodobashi URL: ${yodobashiHref}`);
  }

  const amazonTab = page.getByRole('tab', { name: 'Amazon' });
  await amazonTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await amazonTab.click();
  const amazonHref = await page.locator('#store-link').getAttribute('href');
  if (!amazonHref?.includes('amazon.co.jp/s?k=4902370550733')) {
    throw new Error(`Unexpected Amazon URL: ${amazonHref}`);
  }
  if ((await amazonTab.getAttribute('aria-selected')) !== 'true') {
    throw new Error('Amazon tab did not become selected after click');
  }

  const rakutenTab = page.getByRole('tab', { name: '楽天市場' });
  await rakutenTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await rakutenTab.click();
  const rakutenHref = await page.locator('#store-link').getAttribute('href');
  if (!rakutenHref?.includes('search.rakuten.co.jp/search/mall/4902370550733/')) {
    throw new Error(`Unexpected Rakuten URL: ${rakutenHref}`);
  }

  const yahooTab = page.getByRole('tab', { name: 'Yahoo!' });
  await yahooTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await yahooTab.click();
  const yahooHref = await page.locator('#store-link').getAttribute('href');
  if (!yahooHref?.includes('shopping.yahoo.co.jp/search/4902370550733/0/')) {
    throw new Error(`Unexpected Yahoo URL: ${yahooHref}`);
  }

  if (!page.url().includes(`jan=${jan}`)) throw new Error(`JAN query parameter missing: ${page.url()}`);

  await page.locator('#next-store').click();
  const selectedAfterNext = await page.locator('.jan-store-tab[aria-selected="true"]').textContent();
  if (selectedAfterNext !== 'ヨドバシ') throw new Error(`Next-store rotation failed: ${selectedAfterNext}`);

  await page.locator('#scan-button').click();
  const dialogHidden = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (dialogHidden !== null) throw new Error('Scanner dialog did not open');
  await page.locator('#scanner-close').click();
  const hiddenAfterClose = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (hiddenAfterClose === null) throw new Error('Scanner dialog did not close');

  console.log('JAN direct retailer tab browser smoke passed');
} finally {
  await browser.close();
}
