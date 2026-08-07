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

  await openPage('/stay/live-admin.html', async page => {
    await page.waitForFunction(() => (document.querySelector('#liveStatus')?.textContent || '') !== 'checking');
    const status = await page.locator('#liveStatus').innerText();
    const note = await page.locator('#connectionNote').innerText();
    assert(status === 'NOT CONFIGURED', `Expected unconfigured Live Admin in CI, got ${status}`);
    assert(note.includes('Publishable Key'), 'Live Admin must explain publishable-key configuration');
    assert(await page.locator('#liveWorkspace').isHidden(), 'Live workspace must stay hidden without Supabase configuration');
    const mapping = await page.evaluate(() => {
      const record = StayAtlasSupabase.hotelToRecord({
        name_ja:'CI Hotel',name_en:'CI Hotel EN',chain:'Hilton Honors',brand:'Hilton',status:'open',
        region:'関東',prefecture:'東京都',city:'新宿区',child:{raw:'5歳まで'},award:{raw:''},capacity:{raw:'4人まで',value:4},
        facilities:{pool:{raw:'〇',available:true}},quality:'verified',source:{label:'CI',url:'https://example.com',last_checked:'2026-08-07'}
      });
      const hotel = StayAtlasSupabase.rowToHotel({
        id:'00000000-0000-0000-0000-000000000001',slug:'ci-hotel',...record,
        created_at:'2026-08-07T00:00:00Z',updated_at:'2026-08-07T00:00:00Z'
      },{});
      return {record,hotel};
    });
    assert(mapping.record.capacity_json.value === 4, 'Supabase adapter must preserve structured capacity JSON');
    assert(mapping.hotel.source.last_checked === '2026-08-07', 'Supabase adapter must preserve source verification date');
  });

  await openPage('/stay/auth/accept-invite.html', async page => {
    await page.waitForFunction(() => (document.querySelector('#inviteStatus')?.textContent || '') !== 'checking');
    const status = await page.locator('#inviteStatus').innerText();
    const message = await page.locator('#inviteMessage').innerText();
    assert(status === 'NOT CONFIGURED', `Expected unconfigured invite page in CI, got ${status}`);
    assert(message.includes('Publishable Key'), 'Invite page must explain Project URL / Publishable Key setup');
    assert(await page.locator('#passwordForm').isHidden(), 'Password form must stay hidden without Supabase configuration');
  });

  assert(browserErrors.length === 0, `Browser errors detected:\n${browserErrors.join('\n')}`);
  console.log('Stay Atlas headless browser validation passed.');
} finally {
  await browser.close();
}
