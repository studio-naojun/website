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
  if (tabCount !== 14) throw new Error(`Expected 14 retailer tabs, got ${tabCount}`);

  const expectedTabs = [
    ['ヨドバシ', 'yodobashi.com/?word=4902370550733'],
    ['ビックカメラ', 'biccamera.com/bc/category/?q=4902370550733'],
    ['ヤマダ', 'yamada-denkiweb.com/search/4902370550733/'],
    ['エディオン', 'edion.com/item_list.html?keyword=4902370550733'],
    ['Joshin', 'joshinweb.jp/dps/srhzs.html?KEY=ZS_ALL&KEYWORD=4902370550733&REQUEST_CODE=1'],
    ['ソフマップ', 'sofmap.com/search_result.aspx?keyword=4902370550733'],
    ['駿河屋', 'suruga-ya.jp/search?category=&search_word=4902370550733'],
    ['ゲオ', 'geo-online.co.jp/shop/goods/search.aspx?keyword=4902370550733'],
    ['トイザらス', 'toysrus.co.jp/search/?q=4902370550733'],
    ['ポケモンセンター', 'pokemoncenter-online.com/search/?q=4902370550733'],
    ['あみあみ', 'slist.amiami.jp/top/search/list?s_keywords=4902370550733&pagemax=60'],
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

  const pokemonTab = page.getByRole('tab', { name: 'ポケモンセンター', exact: true });
  await pokemonTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await pokemonTab.click();
  const pokemonHref = await page.locator('#store-link').getAttribute('href');
  if (!pokemonHref?.includes('pokemoncenter-online.com/search/?q=4902370550733')) {
    throw new Error(`Unexpected Pokemon Center URL: ${pokemonHref}`);
  }
  if ((await pokemonTab.getAttribute('aria-selected')) !== 'true') {
    throw new Error('Pokemon Center tab did not become selected after click');
  }

  const amiamiTab = page.getByRole('tab', { name: 'あみあみ', exact: true });
  await amiamiTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await amiamiTab.click();
  const amiamiHref = await page.locator('#store-link').getAttribute('href');
  if (!amiamiHref?.includes('slist.amiami.jp/top/search/list?s_keywords=4902370550733&pagemax=60')) {
    throw new Error(`Unexpected AmiAmi URL: ${amiamiHref}`);
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

  console.log('JAN 14-retailer tab browser smoke passed');
} finally {
  await browser.close();
}
