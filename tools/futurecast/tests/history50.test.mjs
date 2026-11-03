import {readFileSync,mkdtempSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {validateHistory50,history50Front,history50Dossier,HISTORY50_SOURCE} from '../history50.mjs';
import {build} from '../fc.mjs';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const read=p=>readFileSync(join(root,p),'utf8');
const source=()=>JSON.parse(read(HISTORY50_SOURCE));
const sha=p=>createHash('sha256').update(readFileSync(join(root,p))).digest('hex');
const home=read('futurecast/index.html'), dossier=read('futurecast/high-conviction/index.html');

test('the sealed ledger, receipts and scored projections are byte-identical to main dd60558',()=>{
 // Recorded from dd60558ec48a2202af1e39fd16179cf71d799572 before HISTORY 50+ was added.
 const pinned={
  'futurecast/data/ledger/fc-2026-0001.ndjson':'ba6968fe01dc7f2e0ed1bc2570fbe3351caacfdaef01abdcdd473a6988345cb2',
  'futurecast/data/ledger/fc-2026-0002.ndjson':'a75008ab6d2056e10dc3eb7ad6c9601b96b7b38b4e71aa44a2dde6a38d8eed3d',
  'futurecast/data/ledger/fc-2026-0003.ndjson':'7ea429a19b1a24064b249e0de6455e2b8155a837fda07e7d9962f284342de8ef',
  'futurecast/data/receipts.ndjson':'5b1d928467b1ca8e7ea664dc534dafff6b5fe290006b86a5175853fe4a2674e3',
  'futurecast/data/index.json':'aa261837b000d872211961e42c2614f6010819ae986f91dfd0c1fb25af601609',
  'futurecast/data/scoreboard.json':'774b53e49ccc1c882557cf8fa95c406e4643d8b431b310047d8c84eae067b374',
  'futurecast/era-shifts/scenarios.json':'7cf66fbc366d171423e152a176a706192b15ae091f06f19f9546a3886bc484a2',
  'futurecast/data-disagrees/candidates.json':'df0e6c08ccacee91cab3a8b9a54a4a67a5e2da93dc87f0933d1667b352780f07',
 };
 for(const [p,h] of Object.entries(pinned))assert.equal(sha(p),h,p);
});

test('HISTORY 50+ is an unsealed, unscored editorial edition of five >50% estimates',()=>{
 const d=validateHistory50(source());
 assert.equal(d.forecasts.length,5);
 assert.deepEqual(d.forecasts.map(f=>f.probability),[62,58,70,66,65]);
 assert.equal(d.sealed,false);assert.equal(d.scored,false);
 assert.equal(d.calibration,'uncalibrated_subjective_editorial');
 // Only the Nobel item has a directly measured public-majority-skeptical comparison.
 assert.deepEqual(d.forecasts.filter(f=>f.opinion.status==='direct_majority_skeptical').map(f=>f.id),['ai-nobel-discovery-2030']);
 for(const f of d.forecasts){
  assert.ok(f.sources.every(s=>s.url.startsWith('https://')));
  assert.ok(f.resolution.yes.includes('YES')&&f.resolution.no.includes('NO'));
 }
 // The edition's ids never enter the scored projection.
 const scored=read('futurecast/data/index.json')+read('futurecast/data/scoreboard.json');
 for(const f of d.forecasts)assert.ok(!scored.includes(f.id),f.id);
});

test('validation rejects items that would fake the edition premise or its separation from the ledger',()=>{
 const mutations=[
  d=>{d.forecasts[0].probability=50;},
  d=>{d.forecasts[0].probability=62.5;},
  d=>{d.forecasts[0].probability=99;},
  d=>{d.sealed=true;},
  d=>{d.scored=true;},
  d=>{d.calibration='calibrated';},
  d=>{d.forecasts[1].id=d.forecasts[0].id;},
  d=>{d.forecasts[0].sources[0].url='http://www.anthropic.com/research/ai-expectations-gap';},
  d=>{d.forecasts[0].sources[0].url='https://example.com/"onmouseover="x';},
  d=>{d.forecasts[0].evidence[0].source=9;},
  d=>{d.forecasts[0].opinion.status='majority_skeptical_assumed';},
  d=>{d.forecasts[0].deadline='2026-01-01';},
  d=>{d.as_of='2026-02-30';},
  d=>{d.forecasts[0].deadline='2030-02-30';},
  d=>{d.forecasts[0].deadline='2030-13-01';},
  d=>{d.forecasts[2].number='07';},
  d=>{d.forecasts[0].counter=[];},
 ];
 for(const m of mutations){const d=source();m(d);assert.throws(()=>validateHistory50(d),undefined,m.toString());}
});

test('data is escaped when rendered',()=>{
 const d=source();d.forecasts[0].title='<img src=x onerror="alert(1)">';
 for(const html of [history50Front(d),history50Dossier(d,{qualified_count:0})]){
  assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;img src=x'));
 }
});

test('homepage: the edition is the first, primary section; the strict gate zero is labelled separately; ledger archived below',()=>{
 const main=home.slice(home.indexOf('<main id="main">'));
 const front=main.indexOf('class="fc-front"'),strict=main.indexOf('class="fc-strict"'),ledger=main.indexOf('class="fc-ledger"');
 assert.ok(front>0&&front<strict&&strict<ledger,'order: edition, strict gate, ledger');
 assert.equal((home.match(/<h1\b/g)||[]).length,1);
 assert.ok(main.slice(front,strict).includes('<h1 id="fc-title">'));
 const d=source(),hero=main.slice(front,strict);
 for(const f of d.forecasts){
  assert.ok(hero.includes(`href="/futurecast/high-conviction/#${f.id}"`),f.id);
  assert.ok(hero.includes(`<strong>${f.probability}</strong>%`),f.id);
  assert.ok(hero.includes(`datetime="${f.deadline}"`),f.id);
  assert.ok(hero.includes(f.sources[f.evidence[0].source].url),f.id);
 }
 assert.equal((hero.match(/<li class="fc-hl/g)||[]).length,5);
 assert.match(hero,/主観的な編集推定/);
 assert.match(hero,/なぜ50％超と言えるのか/);
 const gate=main.slice(strict,ledger);
 assert.match(gate,/より厳しい別基準/);
 assert.match(gate,/採択0件/);
 assert.match(gate,/この基準の採択ではありません/);
 for(const id of ['fc-2026-0001','fc-2026-0002','fc-2026-0003'])assert.ok(main.slice(ledger).includes(`/futurecast/p/${id}/`));
 // The strict count never appears inside the edition hero.
 assert.doesNotMatch(hero,/DATA DISAGREES|採択0/);
});

test('dossier page: methodology heading, every definition, counter-case, opinion status and primary links',()=>{
 assert.equal((dossier.match(/<h1\b/g)||[]).length,1);
 assert.match(dossier,/<h2 id="why-title">なぜ50％超と言えるのか<\/h2>/);
 assert.match(dossier,/成績の採点対象外/);
 assert.match(dossier,/<link rel="canonical" href="https:\/\/naojun\.jp\/futurecast\/high-conviction\/">/);
 const d=source();
 for(const f of d.forecasts){
  const start=dossier.indexOf(`<article class="fc-dossier" id="${f.id}"`);assert.ok(start>0,f.id);
  const art=dossier.slice(start,dossier.indexOf('</article>',start));
  for(const k of ['YES / NO の判定','50%超の根拠（数値）','反対の材料','世論との比較','推定を変える条件','まだ確認できていないこと'])assert.ok(art.includes(k),f.id+' '+k);
  for(const s of f.sources)assert.ok(art.includes(`href="${s.url}" target="_blank" rel="noopener noreferrer"`),s.url);
  assert.ok(art.includes(`<strong>${f.probability}</strong>%`));
 }
 assert.match(dossier,/LEAPは2026年6月12日の既公開モデルに関する輸出管理の指示を、この問いを満たさない例として明記/);
 assert.doesNotMatch(dossier,/style="/,'CSP default-src self forbids inline styles');
 assert.doesNotMatch(dossier,/<script(?![^>]*studio\.js)/);
});

test('every FUTURECAST page shares one subnav including HISTORY 50+, and the scoreboard/method mark it unscored',()=>{
 for(const p of ['index.html','high-conviction/index.html','data-disagrees/index.html','era-shifts/index.html','scoreboard/index.html','methodology/index.html','archive/index.html','p/fc-2026-0001/index.html']){
  const html=read('futurecast/'+p);
  assert.match(html,/<nav class="mast-nav" aria-label="FUTURECAST"><a href="\/futurecast\/"[^>]*>トップ<\/a><a href="\/futurecast\/high-conviction\/"[^>]*>HISTORY 50\+<\/a>/,p);
  assert.equal((html.match(/aria-current="page"/g)||[]).length<=1,true,p);
 }
 assert.match(read('futurecast/scoreboard/index.html'),/HISTORY 50\+<\/a>の5件は封印していない主観的な編集推定のため、ここでは採点しません/);
 assert.match(read('futurecast/methodology/index.html'),/id="history50-method">HISTORY 50\+は、台帳とは別の編集号/);
});

test('generated pages are idempotent: a fresh build reproduces the checked-in output byte-for-byte',()=>{
 const out=mkdtempSync(join(tmpdir(),'fc-h50-'));
 build(join(root,'futurecast/data'),out);
 for(const p of ['index.html','high-conviction/index.html','scoreboard/index.html','methodology/index.html','archive/index.html','p/fc-2026-0001/index.html','data/index.json','data/scoreboard.json','assets/css/futurecast.css'])
  assert.deepEqual(readFileSync(join(out,p)),readFileSync(join(root,'futurecast',p)),p);
});
