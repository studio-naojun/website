import {readFileSync, existsSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
const base=join(root,'futurecast/era-shifts');
const source=JSON.parse(readFileSync(join(base,'scenarios.json'),'utf8'));
const page=readFileSync(join(base,'index.html'),'utf8');

test('ERA SHIFTS is an unscored candidate collection of eight',()=>{
 assert.equal(source.status,'candidate_unscored');
 assert.equal(source.scenarios.length,8);
 assert.equal(source.model,'Codex gpt-6-astra / medium');
 assert.equal(source.calibration,'uncalibrated subjective estimates');
 assert.equal(new Set(source.scenarios.map(s=>s.id)).size,8);
 assert.ok(source.scenarios.filter(s=>s.kind==='breakthrough').length>=2);
});
test('Astra probabilities are not treated as calibrated or falsely precise',()=>{
 for(const scenario of source.scenarios){
  if(scenario.probability===null)assert.equal(scenario.probabilityLabel,'1%未満');
  else{
   assert.ok(Number.isInteger(scenario.probability)&&scenario.probability>=1&&scenario.probability<=99);
   assert.equal(scenario.probabilityLabel,scenario.probability+'%');
  }
  assert.equal(scenario.window,'2027年11月3日 23:59 JST');
  assert.ok(scenario.yes.length>50&&scenario.counter.length>10);
 }
 assert.match(page,/Codex Astraが示した主観的な判断であり、検証済みの統計値ではありません/);
 assert.match(page,/採点台帳に採択されていない/);
});
test('the eight scenarios, positive alternatives and sources are reachable without JS',()=>{
 assert.equal((page.match(/<article class="era-detail"/g)||[]).length,8);
 assert.equal((page.match(/class="era-card (?:disruption|breakthrough)"/g)||[]).length,8);
 assert.equal((page.match(/<h1>/g)||[]).length,1);
 assert.doesNotMatch(page,/<script\b/i);
 assert.match(page,/核融合/);
 assert.match(page,/結核/);
 for(const s of source.scenarios){
  assert.ok(page.includes('id="'+s.id+'"'));
  assert.ok(page.includes('href="#'+s.id+'"'));
  assert.ok(s.sources.every(x=>x.url.startsWith('https://')&&!x.url.includes('"')));
 }
});
test('existing official forecast identifiers still have their unchanged ledgers',()=>{
 for(const id of ['fc-2026-0001','fc-2026-0002','fc-2026-0003']){
  assert.ok(existsSync(join(root,'futurecast/data/ledger',id+'.ndjson')));
  assert.ok(page.includes('/futurecast/p/'+id+'/'));
 }
 assert.doesNotMatch(page,/forecasting tools automatically calculate probabilities/i);
 assert.doesNotMatch(page,/private_hash|observation_snapshot|ghp_[a-z0-9]{10,}/i);
});
test('ERA SHIFTS appears in existing FUTURECAST navigation without replacing it',()=>{
 const homepage=readFileSync(join(root,'futurecast/index.html'),'utf8');
 assert.match(homepage,/\/futurecast\/era-shifts\//);
 assert.match(homepage,/fc-2026-0001/);
 assert.match(homepage,/fc-2026-0002/);
 assert.match(homepage,/fc-2026-0003/);
 const methods=readFileSync(join(root,'futurecast/methodology/index.html'),'utf8');
 assert.match(methods,/\/futurecast\/era-shifts\//);
});
