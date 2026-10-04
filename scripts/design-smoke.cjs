/* Browser regression checks. Set PLAYWRIGHT_MODULE to an installed Playwright module.
 * Optional AXE_MODULE enables WCAG checks; DESIGN_ARTIFACTS selects screenshot output.
 * DESIGN_BROWSER selects chromium/webkit. Use DESIGN_TLS_CERT and DESIGN_TLS_KEY
 * for local HTTPS when checking pages with upgrade-insecure-requests CSP. */
const browserType = require(process.env.PLAYWRIGHT_MODULE || 'playwright')[process.env.DESIGN_BROWSER || 'chromium'];
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const works = JSON.parse(fs.readFileSync(path.join(root,'content/works.json'),'utf8'));
const site = JSON.parse(fs.readFileSync(path.join(root,'content/site.json'),'utf8'));
const output = process.env.DESIGN_ARTIFACTS;
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png' };
const tls = process.env.DESIGN_TLS_CERT && process.env.DESIGN_TLS_KEY;
const serve = (req,res) => {
  if (req.url === '/__design-audit/axe.js' && process.env.AXE_MODULE) {
    res.setHeader('Content-Type','text/javascript');fs.createReadStream(process.env.AXE_MODULE).pipe(res);return;
  }
  let file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url,'http://local').pathname));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file,'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
};
const server = tls ? https.createServer({cert:fs.readFileSync(process.env.DESIGN_TLS_CERT),key:fs.readFileSync(process.env.DESIGN_TLS_KEY)},serve) : http.createServer(serve);
(async () => {
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const base = (tls?'https':'http')+'://127.0.0.1:' + server.address().port;
  const browser = await browserType.launch({headless:true});
  const errors = [];
  const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce',ignoreHTTPSErrors:!!tls});
  await page.addInitScript(()=>{window.__artDraws=0;const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='thread-canvas')window.__artDraws++;return clear.apply(this,args);};});
  page.on('pageerror',error => errors.push(error.message));
  page.on('requestfailed',request=>{if(new URL(request.url()).hostname==='127.0.0.1')errors.push('Resource failed '+request.url()+' '+request.failure()?.errorText);});
  page.on('response',response=>{if(new URL(response.url()).hostname==='127.0.0.1'&&response.status()>=400)errors.push('HTTP '+response.status()+' '+response.url());});
  try {
    await page.goto(base,{waitUntil:'networkidle'});
    if(output){fs.mkdirSync(output,{recursive:true});await page.screenshot({path:path.join(output,'home-desktop.png'),fullPage:true});await page.screenshot({path:path.join(output,'home-hero.png')});}
    assert.equal(await page.locator('main a[href$="koechara/"]').count() > 0, true, 'Koechara remains reachable from home');
    assert.equal(await page.locator('main a').filter({hasText:'YouTubeチャンネルへ'}).getAttribute('href'),site.youtube_url,'Home exposes the verified official channel');
    assert.equal(await page.locator('#thread-canvas').getAttribute('data-motion'), 'paused', 'Reduced motion starts with a still frame');
    assert.equal(await page.locator('.hero-art > img').evaluate(el=>getComputedStyle(el).visibility),'hidden','Canvas enhancement hides its static fallback instead of double rendering');
    await page.emulateMedia({reducedMotion:'no-preference'});
    const initialDraws=await page.evaluate(()=>window.__artDraws);
    await page.waitForFunction(n=>window.__artDraws>n+2,initialDraws);
    await page.getByRole('button',{name:'動きを止める',exact:true}).click();
    assert.equal(await page.locator('#thread-canvas').getAttribute('data-motion'), 'paused', 'Motion toggle pauses the artwork');
    const pausedDraws=await page.evaluate(()=>window.__artDraws);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>window.__artDraws),pausedDraws,'Paused artwork makes no draw calls');
    await page.getByRole('button',{name:'動きを再生',exact:true}).click();
    await page.locator('.studio-footer').scrollIntoViewIfNeeded();
    await page.waitForTimeout(180);
    const offscreenDraws=await page.evaluate(()=>window.__artDraws);
    await page.waitForTimeout(180);
    assert.equal(await page.evaluate(()=>window.__artDraws),offscreenDraws,'Offscreen artwork makes no draw calls');
    await page.evaluate(()=>scrollTo(0,0));
    await page.emulateMedia({reducedMotion:'reduce'});
    const journalLinks=page.locator('.journal-section a');
    await page.keyboard.press('Tab');await journalLinks.nth(1).focus();
    assert.equal(await journalLinks.nth(1).evaluate(el=>el.matches(':focus-visible')),true,'Keyboard focus receives a visible indicator');
    const focusContrast=await page.evaluate(()=>{const el=document.activeElement;const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);const lum=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);const fg=lum(getComputedStyle(el).outlineColor),bg=lum(getComputedStyle(el.closest('.journal-section')).backgroundColor);return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);});
    assert.ok(focusContrast>=3,'Dark-surface keyboard focus contrast must reach 3:1; got '+focusContrast);
    await page.evaluate(()=>scrollTo(0,0));
    await page.setViewportSize({width:390,height:844});
    await page.getByRole('button',{name:'メニューを開く',exact:true}).waitFor({state:'visible',timeout:5000});
    assert.equal(await page.getByRole('button',{name:'メニューを開く',exact:true}).count(),1,'Mobile navigation has a named disclosure button');
    await page.getByRole('button',{name:'メニューを開く',exact:true}).click();
    assert.equal(await page.locator('#studio-nav').isVisible(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#studio-nav').isVisible(),false,'Escape closes the mobile menu');
    assert.equal(await page.getByRole('button',{name:'メニューを開く',exact:true}).evaluate(el=>el===document.activeElement),true,'Escape returns focus');
    await page.goto(base+'/works/',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'ツール',exact:true}).click();
    assert.equal(await page.locator('[data-work]:visible').count(),works.filter(w=>w.category==='tool').length,'Tool filter shows all registered tools');
    assert.equal(await page.locator('[data-work][data-category="companion"]').isVisible(),false,'Filter hides other categories');
    await page.getByRole('button',{name:'すべて',exact:true}).click();
    assert.equal(await page.locator('[data-work]:visible').count(),works.length,'All registered works are restored');
    console.log('PASS mobile disclosure, Escape/focus, catalogue filtering, preserved product route');
    const routes = ['','works/','about/','contact/','koechara/','investment/','admissions/','tools/jan/','investment/weekly/2026-10-03/','investment/monthly/2026-09/','admissions/weekly/2026-09-14/','admissions/special/r4-2009-2026/'];
    const failures = [];
    for(const width of [360,390,768,1440]){
      await page.setViewportSize({width,height:width<600?844:1000});
      for(const route of routes){
        await page.goto(base+'/'+route,{waitUntil:'networkidle'});
        assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(244, 243, 236)','Studio stylesheet loaded for '+route);
        assert.equal(await page.locator('.footer-links a').filter({hasText:'YouTube'}).getAttribute('href'),site.youtube_url,'Every shared footer exposes the same channel');
        const overflow = await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
        if(overflow){
          const layout=await page.evaluate(()=>({innerWidth,scrollWidth:document.documentElement.scrollWidth,outside:[...document.querySelectorAll('main *')].map(el=>({tag:el.tagName,cls:el.className,rect:el.getBoundingClientRect().toJSON()})).filter(x=>x.rect.right>innerWidth+1).slice(0,8)}));
          failures.push(route+' overflows at '+width+' '+JSON.stringify(layout));
        }
        const clipped = await page.locator('.rain-type').evaluateAll(els=>els.map(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect();return a.top<b.top-1||a.bottom>b.bottom+1;}).some(Boolean));
        if(clipped)failures.push(route+' game title clipped at '+width);
        if(output && [390,1440].includes(width) && route==='investment/weekly/2026-10-03/')
          await page.screenshot({path:path.join(output,'article-head-'+width+'.png')});
        if(output && [390,1440].includes(width) && ['','works/','about/','koechara/','investment/','admissions/','investment/weekly/2026-10-03/','admissions/special/r4-2009-2026/'].includes(route))
          await page.screenshot({path:path.join(output,(route.replaceAll('/','')||'home')+'-'+width+'.png'),fullPage:true});
        if(process.env.AXE_MODULE && width===390){
          await page.addScriptTag({url:base+'/__design-audit/axe.js'});
          const violations = await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})));
          if(violations.length)failures.push(route+' accessibility: '+JSON.stringify(violations));
        }
      }
    }
    const nojs = await browser.newPage({javaScriptEnabled:false,viewport:{width:390,height:844},ignoreHTTPSErrors:!!tls});
    await nojs.goto(base+'/works/');
    assert.equal(await nojs.locator('[data-work]:visible').count(),works.length,'No-JS catalogue stays fully available');
    assert.equal(await nojs.locator('#studio-nav').isVisible(),true,'No-JS navigation stays available');
    await nojs.close();
    assert.deepEqual(errors,[],'No client JavaScript errors');
    assert.deepEqual(failures,[],'Responsive and accessibility checks: '+JSON.stringify(failures));
    console.log('PASS '+routes.length*4+' responsive route/width checks, no-JS access, zero JS/resource errors'+(process.env.AXE_MODULE?', '+routes.length+' WCAG audits':''));
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
