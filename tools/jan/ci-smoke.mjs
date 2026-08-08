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
  if (tabCount !== 9) throw new Error(`Expected 9 retailer tabs, got ${tabCount}`);

  const expectedTabs = [
    ['ヨドバシ', 'yodobashi.com/?word=4902370550733'],
    ['ビックカメラ', 'biccamera.com/bc/category/?q=4902370550733'],
    ['ヤマダ', 'yamada-denkiweb.com/search/4902370550733/'],
    ['エディオン', 'edion.com/item_list.html?keyword=4902370550733'],
    ['駿河屋', 'suruga-ya.jp/search?category=&search_word=4902370550733'],
    ['ゲオ', 'geo-online.co.jp/shop/goods/search.aspx?keyword=4902370550733'],
    ['Amazon', 'amazon.co.jp/s?k=4902370550733'],
    ['楽天市場', 'search.rakuten.co.jp/search/mall/4902370550733/'],
    ['Yahoo!', 'shopping.yahoo.co.jp/search/4902370550733/0/'],
  ];

  for (const [name, expectedUrl] of expectedTabs) {
    const tab = page.getByRole('tab', { name, exact: true });
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

  const surugayaTab = page.getByRole('tab', { name: '駿河屋', exact: true });
  await surugayaTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await surugayaTab.click();
  const surugayaHref = await page.locator('#store-link').getAttribute('href');
  if (!surugayaHref?.includes('suruga-ya.jp/search?category=&search_word=4902370550733')) {
    throw new Error(`Unexpected Surugaya URL: ${surugayaHref}`);
  }
  if ((await surugayaTab.getAttribute('aria-selected')) !== 'true') {
    throw new Error('Surugaya tab did not become selected after click');
  }

  const geoTab = page.getByRole('tab', { name: 'ゲオ', exact: true });
  await geoTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await geoTab.click();
  const geoHref = await page.locator('#store-link').getAttribute('href');
  if (!geoHref?.includes('geo-online.co.jp/shop/goods/search.aspx?keyword=4902370550733')) {
    throw new Error(`Unexpected GEO URL: ${geoHref}`);
  }

  if (!page.url().includes(`jan=${jan}`)) throw new Error(`JAN query parameter missing: ${page.url()}`);

  await page.locator('#next-store').click();
  const selectedAfterNext = await page.locator('.jan-store-tab[aria-selected="true"]').textContent();
  if (selectedAfterNext !== 'Amazon') throw new Error(`Next-store rotation failed: ${selectedAfterNext}`);

  await page.locator('#scan-button').click();
  const dialogHidden = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (dialogHidden !== null) throw new Error('Scanner dialog did not open');
  await page.locator('#scanner-close').click();
  const hiddenAfterClose = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (hiddenAfterClose === null) throw new Error('Scanner dialog did not close');

  console.log('JAN expanded retailer tab browser smoke passed');
} finally {
  await browser.close();
}
