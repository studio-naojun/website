import { chromium } from 'playwright';

const baseUrl = process.env.STAY_ATLAS_BASE_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const browserErrors = [];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openPage(path, check) {
  const page = await context.newPage();
  page.on('pageerror', error => browserErrors.push(`${path}: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(`${path}: console error: ${message.text()}`);
  });
  const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle' });
  assert(response && response.ok(), `${path} returned HTTP ${response?.status() ?? 'unknown'}`);
  await check(page);
  await page.close();
}

try {
  await openPage('/stay/tests.html', async page => {
    await page.click('#runTests');
    await page.waitForFunction(() => {
      const text = document.querySelector('#testOutput')?.textContent || '';
      return text.includes('All smoke tests passed.') || text.includes('FAIL  ');
    }, { timeout: 30000 });
    const output = await page.locator('#testOutput').innerText();
    console.log(output);
    assert(output.includes('All smoke tests passed.'), `Browser smoke tests did not pass:\n${output}`);
    assert(!output.includes('FAIL  '), `Browser smoke tests reported a failure:\n${output}`);
  });

  await openPage('/stay/', async page => {
    await page.waitForFunction(() => Number(document.querySelector('#hotelCount')?.textContent || 0) > 100);
    const hotelCount = Number(await page.locator('#hotelCount').innerText());
    const initialResults = Number(await page.locator('#resultCount').innerText());
    assert(hotelCount > 100, `Expected >100 hotels, got ${hotelCount}`);
    assert(initialResults > 100, `Expected >100 visible hotels, got ${initialResults}`);

    await page.selectOption('#qualityFilter', 'official');
    await page.waitForFunction(() => Number(document.querySelector('#resultCount')?.textContent || 0) >= 21);
    const officialResults = Number(await page.locator('#resultCount').innerText());
    assert(officialResults >= 21, `Expected at least 21 officially curated hotels, got ${officialResults}`);
    assert(officialResults < initialResults, 'Official verification filter did not narrow the public result set');

    await page.selectOption('#qualityFilter', 'field_conflict');
    await page.waitForFunction(() => Number(document.querySelector('#resultCount')?.textContent || 0) > 0);
    const conflictResults = Number(await page.locator('#resultCount').innerText());
    assert(conflictResults > 0, 'Expected at least one public record with a field-level source conflict');
  });

  await openPage('/stay/admin.html', async page => {
    await page.waitForFunction(() => Number((document.querySelector('#adminCount')?.textContent || '').replace(/\D/g, '')) > 100);
    const adminCount = Number((await page.locator('#adminCount').innerText()).replace(/\D/g, ''));
    const officialCount = Number(await page.locator('#auditOfficial').innerText());
    assert(adminCount > 100, `Expected >100 admin records, got ${adminCount}`);
    assert(officialCount >= 21, `Expected at least 21 officially curated admin records, got ${officialCount}`);
  });

  assert(browserErrors.length === 0, `Browser errors detected:\n${browserErrors.join('\n')}`);
  console.log('Stay Atlas headless browser validation passed.');
} finally {
  await browser.close();
}
