import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  await page.route('https://unpkg.com/**', (route) => route.abort());
  await page.goto('http://127.0.0.1:4173/tools/jan/', { waitUntil: 'domcontentloaded' });

  await page.locator('#jan-code').fill('   ');
  await page.locator('#jan-search-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => !document.querySelector('#jan-error')?.hidden);
  const emptyError = await page.locator('#jan-error').textContent();
  if (!emptyError?.includes('検索キーワード')) throw new Error('Empty keyword validation did not run');

  const query = 'ポケモンカード 151';
  const encodedQuery = encodeURIComponent(query);
  await page.locator('#jan-code').fill(query);
  await page.locator('#jan-search-form').evaluate((form) => form.requestSubmit());
  await page.waitForFunction(() => !document.querySelector('#store-search')?.hidden);

  const currentQuery = await page.locator('#current-jan').textContent();
  if (currentQuery !== query) throw new Error(`Keyword was not preserved: ${currentQuery}`);

  const queryUrl = new URL(page.url());
  if (queryUrl.searchParams.get('q') !== query) throw new Error(`Keyword query parameter missing: ${page.url()}`);
  if (queryUrl.searchParams.has('jan')) throw new Error(`Legacy JAN parameter should be removed: ${page.url()}`);

  const copyText = await page.locator('#copy-jan').textContent();
  if (!copyText?.includes('検索語')) throw new Error(`Copy action was not updated for keywords: ${copyText}`);

  const tabs = page.locator('.jan-store-tab');
  const tabCount = await tabs.count();
  if (tabCount !== 14) throw new Error(`Expected 14 retailer tabs, got ${tabCount}`);

  const expectedTabs = [
    ['ヨドバシ', `yodobashi.com/?word=${encodedQuery}`],
    ['ビックカメラ', `biccamera.com/bc/category/?q=${encodedQuery}`],
    ['ヤマダ', `yamada-denkiweb.com/search/${encodedQuery}/`],
    ['エディオン', `edion.com/item_list.html?keyword=${encodedQuery}`],
    ['Joshin', `joshinweb.jp/srhzs.html?KEY=ZS_ALL&KEY_M=ALL&QK=${encodedQuery}&REQUEST_CODE=1`],
    ['ソフマップ', `sofmap.com/search_result.aspx?keyword=${encodedQuery}`],
    ['駿河屋', `suruga-ya.jp/search?category=&search_word=${encodedQuery}`],
    ['ゲオ', `geo-online.co.jp/shop/goods/search.aspx?keyword=${encodedQuery}`],
    ['トイザらス', `toysrus.co.jp/search/?q=${encodedQuery}`],
    ['ポケモンセンター', `pokemoncenter-online.com/search/?q=${encodedQuery}`],
    ['あみあみ', `slist.amiami.jp/top/search/list?s_keywords=${encodedQuery}&pagemax=60`],
    ['Amazon', `amazon.co.jp/s?k=${encodedQuery}`],
    ['楽天市場', `search.rakuten.co.jp/search/mall/${encodedQuery}/`],
    ['Yahoo!', `shopping.yahoo.co.jp/search/${encodedQuery}/0/`],
  ];

  for (const [name, expectedUrl] of expectedTabs) {
    const tab = page.getByRole('tab', { name, exact: true });
    const tagName = await tab.evaluate((element) => element.tagName);
    const href = await tab.getAttribute('href');
    const target = await tab.getAttribute('target');
    const rel = await tab.getAttribute('rel');

    if (tagName !== 'A') throw new Error(`${name} tab must be a direct link, got ${tagName}`);
    if (!href?.includes(expectedUrl)) throw new Error(`Unexpected ${name} keyword URL: ${href}`);
    if (target !== '_blank') throw new Error(`${name} tab must open in a new window: ${target}`);
    if (!rel?.includes('noopener')) throw new Error(`${name} tab must use noopener: ${rel}`);
  }

  const tabLayout = await page.locator('#store-tabs').evaluate((element) => {
    const positions = [...element.querySelectorAll('.jan-store-tab')].map((tab) => tab.offsetTop);
    return {
      display: getComputedStyle(element).display,
      rowCount: new Set(positions).size,
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    };
  });
  if (tabLayout.display !== 'grid') throw new Error(`Retailer tabs must use grid layout: ${tabLayout.display}`);
  if (tabLayout.rowCount < 2) throw new Error(`Retailer tabs did not wrap to multiple rows: ${tabLayout.rowCount}`);
  if (tabLayout.scrollWidth > tabLayout.clientWidth + 1) {
    throw new Error(`Retailer tabs still require horizontal scrolling: ${tabLayout.scrollWidth}/${tabLayout.clientWidth}`);
  }

  const joshinTab = page.getByRole('tab', { name: 'Joshin', exact: true });
  const joshinHref = await joshinTab.getAttribute('href');
  if (joshinHref?.includes('/dps/')) throw new Error(`Joshin URL still points to Disc Pier: ${joshinHref}`);

  const yodobashiHref = await page.locator('#store-link').getAttribute('href');
  if (!yodobashiHref?.includes(`yodobashi.com/?word=${encodedQuery}`)) {
    throw new Error(`Unexpected Yodobashi keyword URL: ${yodobashiHref}`);
  }

  const pokemonTab = page.getByRole('tab', { name: 'ポケモンセンター', exact: true });
  await pokemonTab.evaluate((element) => {
    element.addEventListener('click', (event) => event.preventDefault(), { once: true });
  });
  await pokemonTab.click();
  const pokemonHref = await page.locator('#store-link').getAttribute('href');
  if (!pokemonHref?.includes(`pokemoncenter-online.com/search/?q=${encodedQuery}`)) {
    throw new Error(`Unexpected Pokemon Center keyword URL: ${pokemonHref}`);
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
  if (!amiamiHref?.includes(`slist.amiami.jp/top/search/list?s_keywords=${encodedQuery}&pagemax=60`)) {
    throw new Error(`Unexpected AmiAmi keyword URL: ${amiamiHref}`);
  }

  await page.locator('#next-store').click();
  const selectedAfterNext = await page.locator('.jan-store-tab[aria-selected="true"]').textContent();
  if (selectedAfterNext !== 'Amazon') throw new Error(`Next-store rotation failed: ${selectedAfterNext}`);

  await page.locator('#scan-button').click();
  const dialogHidden = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (dialogHidden !== null) throw new Error('Scanner dialog did not open');
  await page.locator('#scanner-close').click();
  const hiddenAfterClose = await page.locator('#scanner-dialog').getAttribute('hidden');
  if (hiddenAfterClose === null) throw new Error('Scanner dialog did not close');

  const legacyJan = '4902370550733';
  await page.goto(`http://127.0.0.1:4173/tools/jan/?jan=${legacyJan}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('#store-search')?.hidden);
  const migratedValue = await page.locator('#current-jan').textContent();
  if (migratedValue !== legacyJan) throw new Error(`Legacy JAN URL was not preserved: ${migratedValue}`);
  const migratedUrl = new URL(page.url());
  if (migratedUrl.searchParams.get('q') !== legacyJan || migratedUrl.searchParams.has('jan')) {
    throw new Error(`Legacy JAN URL was not migrated to q: ${page.url()}`);
  }

  console.log('Free keyword retailer search with JAN scanner compatibility smoke passed');
} finally {
  await browser.close();
}
