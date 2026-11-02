import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fixture} from '../fc.mjs';
import {readLines,projection,verify,hash,derive,score,validateReceipts} from '../core.mjs';
const root=mkdtempSync(join(tmpdir(),'fc-correction-')); fixture(root);
const raw=readLines(join(root,'private','demo-0001.ndjson')).map(projection);
const receipts=readLines(join(root,'private','receipts.ndjson')).map(projection);
const reseal=a=>{let prev=null;for(const e of a){e.public_prev_hash=prev;e.public_hash=hash(Object.fromEntries(Object.entries(projection(e)).filter(([k])=>k!=='public_hash')));prev=e.public_hash;}return a};
const mutate=(i,fn)=>{let a=structuredClone(raw);fn(a[i],a);reseal(a);return a};
const cases=[
 ['yes needs event',5,e=>e.event_observed_at=null,/yes event/],
 ['event must precede resolution',5,e=>e.event_observed_at='2026-03-01T00:00:00Z',/yes event/],
 ['no requires close',4,e=>{e.outcome=0;e.event_observed_at=null},/no before close/],
 ['final requires seven days',5,e=>{e.resolved_at='2026-02-08T00:00:00Z'},/objection/],
 ['final cannot change proposed outcome',5,e=>{e.outcome=0;e.event_observed_at=null;e.resolved_at='2026-04-02T00:00:00Z';e.locked_at=e.resolved_at},/objection/],
 ['missing primary basis',4,e=>e.basis_evidence_ids=[],/primary basis/],
 ['unknown resolution basis',4,e=>e.basis_evidence_ids=['absent'],/primary basis/],
 ['non-primary resolution basis',1,e=>e.source_type='secondary',/primary basis/],
 ['overlapping evidence',3,e=>e.challenges=e.supports,/duplicate evidence/],
 ['stance mismatch',1,e=>e.stance='challenges',/stance/],
 ['market evidence cannot count',1,e=>e.source_type='market_reference',/evidence/],
 ['forecast requires supporting evidence',3,e=>e.supports=[],/forecast/],
 ['evidence retrieved after cutoff is rejected',1,e=>e.retrieved_at='2026-01-01T00:00:01Z',/future or missing evidence/],
 ['malformed base rate',3,e=>e.base_rate={n:-1,k:99,estimate:42,estimator_method:'x',reference_class_ja:'x',window_ja:'x',source_evidence_ids:[]},/base rate/],
 ['nested private object rejected',1,e=>e.publisher={snapshot_sha256:'secret'},/evidence fields/],
 ['missing required field',1,e=>delete e.title,/missing field/],
 ['unknown public field',1,e=>e.extra='x',/non-public field/],
 ['invalid category',0,e=>e.category='fake',/question fields/],
 ['unsafe evidence URL',1,e=>e.url='javascript:alert(1)',/url/],
 ['invalid stance',1,e=>e.stance='fake',/evidence fields/],
 ['unexpected correction target',4,e=>e.correction_of='x',/correction target/],
 ['resolution must follow proposal',4,e=>e.kind='final',/transition/],
];
for(const [name,i,fn,pattern] of cases)test(name,()=>assert.throws(()=>verify(mutate(i,fn)),pattern));
test('final does not score before its own receipt',()=>{const ledgers={'demo-0001':raw};const r=structuredClone(receipts.slice(0,1));r[0].covered=r[0].covered.filter(c=>c.question_id==='demo-0001');reseal(r);assert.equal(score(derive(ledgers,r)).counts.pending,1)});
test('final scores after its own receipt',()=>{const ledgers={'demo-0001':raw};const r=structuredClone(receipts);for(const x of r)x.covered=x.covered.filter(c=>c.question_id==='demo-0001');reseal(r);assert.equal(score(derive(ledgers,r)).counts.scored,1)});
test('unknown historical snapshot blocks production verification',()=>assert.throws(()=>validateReceipts({'demo-0001':raw},reseal([{...structuredClone(receipts[0]),covered:[receipts[0].covered[0]]}]),{requireHistorical:true}),/UNVERIFIED/));
test('JST daily samples yield 0.088',()=>{const row={question:{question_id:'q',close_at:'2026-01-12T15:00:00Z'},resolution:{kind:'final',outcome:1},revisions:[{status:'forecast',probability:.6,public_visible_at:'2026-01-01T15:00:00Z',scoring_eligibility:'eligible',base_rate:null},{status:'forecast',probability:.8,public_visible_at:'2026-01-06T15:00:00Z',scoring_eligibility:'eligible'}]};const x=score([row]).scores[0];assert.equal(x.days,10);assert.ok(Math.abs(x.timeweighted-.088)<1e-10)});
test('hold days excluded and sensitivity retained',()=>{const row={question:{question_id:'q',close_at:'2026-01-05T15:00:00Z'},resolution:{kind:'final',outcome:1},revisions:[{status:'forecast',probability:.6,public_visible_at:'2026-01-01T15:00:00Z',scoring_eligibility:'eligible',base_rate:null},{status:'hold',probability:null,public_visible_at:'2026-01-02T15:00:00Z',scoring_eligibility:'hold'},{status:'forecast',probability:.8,public_visible_at:'2026-01-03T15:00:00Z',scoring_eligibility:'eligible'}]};let x=score([row]).scores[0];assert.equal(x.hold_days,1);assert.ok(x.timeweighted_hold_half>x.timeweighted)});
test('unknown CLI option rejected',()=>assert.throws(()=>execFileSync(process.execPath,['tools/futurecast/fc.mjs','score',root,'--typo'],{stdio:'pipe'})));
test('nonexistent public directory rejected',()=>assert.throws(()=>execFileSync(process.execPath,['tools/futurecast/fc.mjs','verify-public',join(root,'missing')],{stdio:'pipe'})));

test('unpublished correction does not change effective result',()=>{let es=structuredClone(raw);let c={...es.at(-1),entry_id:'correction-7',seq:7,kind:'correction',outcome:0,event_observed_at:null,resolved_at:'2026-04-02T00:00:00Z',locked_at:'2026-04-02T00:00:00Z',correction_of:es.at(-1).entry_id};es.push(c);reseal(es);verify(es);let r=structuredClone(receipts);for(const x of r)x.covered=x.covered.filter(c=>c.question_id==='demo-0001');reseal(r);assert.equal(derive({'demo-0001':es},r)[0].resolution.outcome,1);let next={...structuredClone(r[1]),receipt_id:'receipt-3',receipt_seq:3,commit_sha:'2222222222222222222222222222222222222222',public_visible_at:'2026-04-03T00:00:00Z',locked_at:'2026-04-03T00:00:01Z',covered:[{question_id:'demo-0001',through_seq:7,through_public_hash:es[6].public_hash}]};r.push(next);reseal(r);assert.equal(derive({'demo-0001':es},r)[0].resolution.outcome,0)});
test('newly added question does not invalidate old receipt',()=>{let a=structuredClone(raw),b=structuredClone(raw);for(const e of b){e.question_id='demo-0004';e.entry_id=e.entry_id.replaceAll('demo-0001','demo-0004');if(e.basis_evidence_ids)e.basis_evidence_ids=e.basis_evidence_ids.map(x=>x.replaceAll('demo-0001','demo-0004'));if(e.supports)e.supports=e.supports.map(x=>x.replaceAll('demo-0001','demo-0004'));if(e.challenges)e.challenges=e.challenges.map(x=>x.replaceAll('demo-0001','demo-0004'))}reseal(b);let r=structuredClone(receipts.slice(0,1));r[0].covered=r[0].covered.filter(c=>c.question_id==='demo-0001');reseal(r);assert.equal(derive({'demo-0001':a,'demo-0004':b},r).length,2)});

for(const [name,i,change] of [
 ['ambiguity object',0,e=>e.ambiguity_rules_ja=[{internal_path:'C:/Users/jun/secret.txt'}]],
 ['source publisher object',0,e=>e.resolution_sources[0].publisher={internal_path:'C:/Users/jun/secret.txt'}],
 ['revision reason object',3,e=>e.update_reason_ja={internal_path:'C:/Users/jun/secret.txt'}],
 ['empty hostname',1,e=>e.url='https://'],
 ['nested unknown key',0,e=>e.resolution_sources[0].internal_path='secret'],
 ['invented category',0,e=>e.category='technology'],
 ['bad hold reason',3,e=>{e.status='hold';e.probability=null;e.hold_reason='invented'}],
 ['invalid base rate estimate',3,e=>{e.base_rate={reference_class_ja:'x',n:10,k:4,window_ja:'x',estimate:.9,source_evidence_ids:[raw[1].entry_id]};e.base_rate_unavailable_reason_ja=null}],
 ['missing base rate evidence',3,e=>{e.base_rate={reference_class_ja:'x',n:10,k:4,window_ja:'x',estimate:5/12,source_evidence_ids:['missing']};e.base_rate_unavailable_reason_ja=null}],
])test('rehash rejects '+name,()=>assert.throws(()=>verify(mutate(i,change))));
for(const status of ['forecast','hold'])test('base rate cannot use later evidence for '+status,()=>{let a=mutate(3,e=>{e.status=status;if(status==='hold'){e.probability=null;e.hold_reason='insufficient_evidence'}e.base_rate={reference_class_ja:'x',n:10,k:4,window_ja:'x',estimate:5/12,source_evidence_ids:[raw[1].entry_id]};e.base_rate_unavailable_reason_ja=null});a[1].published_at='2026-01-02T00:00:00Z';a[1].retrieved_at=a[1].published_at;a[1].locked_at=a[1].published_at;reseal(a);assert.throws(()=>verify(a),/base rate/);});
test('specified ai category accepted',()=>assert.ok(verify(mutate(0,e=>e.category='ai_tech'))));
test('correct six-field base rate accepted',()=>assert.ok(verify(mutate(3,e=>{e.base_rate={reference_class_ja:'x',n:10,k:4,window_ja:'x',estimate:5/12,source_evidence_ids:[raw[1].entry_id]};e.base_rate_unavailable_reason_ja=null}))));
test('void directly from open with reason',()=>{let a=structuredClone(raw.slice(0,4));a.push({...structuredClone(raw[4]),kind:'void',outcome:null,event_observed_at:null,basis_evidence_ids:[],rule_applied_ja:'reason'});reseal(a);assert.ok(verify(a))});
test('duplicate recorded receipt is rejected; retries must be no-ops',()=>{let r=structuredClone(receipts.slice(0,1));r[0].covered=r[0].covered.filter(c=>c.question_id==='demo-0001');r.push({...structuredClone(r[0]),receipt_id:'retry',receipt_seq:2});reseal(r);assert.throws(()=>validateReceipts({'demo-0001':raw},r),/duplicate/)});
test('same commit different coverage conflicts',()=>{let r=structuredClone(receipts.slice(0,1));r[0].covered=r[0].covered.filter(c=>c.question_id==='demo-0001');r.push({...structuredClone(r[0]),receipt_id:'retry',receipt_seq:2,covered:[]});reseal(r);assert.throws(()=>validateReceipts({'demo-0001':raw},r),/duplicate/)});
test('three-question mean Brier and benchmarks',()=>{const rows=[[.7,1],[.2,0],[.5,0]].map(([p,o],i)=>({question:{question_id:'q'+i,close_at:'2026-01-10T00:00:00Z'},resolution:{kind:'final',outcome:o},revisions:[{status:'forecast',probability:p,public_visible_at:'2026-01-01T00:00:00Z',scoring_eligibility:'eligible',base_rate:{estimate:.5}}]}));const s=score(rows);for(const k of ['first','last','timeweighted'])assert.ok(Math.abs(s.aggregate[k]-.1266666666667)<1e-10);assert.equal(s.baseline.rate,.25);assert.equal(s.baseline.rate_n,3)});
test('wrong public input path rejected',()=>assert.throws(()=>execFileSync(process.execPath,['tools/futurecast/fc.mjs','verify-public','tools/futurecast','--production'],{stdio:'pipe'})));
test('missing append directory rejected',()=>assert.throws(()=>execFileSync(process.execPath,['tools/futurecast/fc.mjs','check-append','--base','HEAD','--dir','does-not-exist-fc-review'],{stdio:'pipe'})));
test('rehash rejects erratum object',()=>{const a=structuredClone(raw.slice(0,4));a.push({...structuredClone(raw[3]),entry_type:'erratum',entry_id:'erratum-5',seq:5,locked_at:'2026-01-06T00:00:00Z',field:'question_text_ja',before:{internal_path:'C:/Users/jun/secret.txt'},after:'text',semantic_change:false,reason_ja:'reason'});for(const k of ['revision_no','public_prev_revision_hash','status','probability','hold_reason','base_rate','base_rate_unavailable_reason_ja','update_reason_ja','supports','challenges','calibration_status','evidence_cutoff_at'])delete a[4][k];reseal(a);assert.throws(()=>verify(a))});
test('excluded correction preserves status',()=>{const s=score([{question:{question_id:'q'},resolution:{kind:'correction',entry_id:'fix'},revisions:[]}]);assert.equal(s.records[0].category,'unscored_hold');assert.equal(s.records[0].recomputed_due_to,'fix')});
test('synthetic build copies stylesheet',()=>{const out=join(root,'css-site');const publicDir=join(root,'css-public');execFileSync(process.execPath,['tools/futurecast/fc.mjs','project',join(root,'private'),publicDir],{stdio:'pipe'});execFileSync(process.execPath,['tools/futurecast/fc.mjs','build',publicDir,out,'--synthetic'],{stdio:'pipe'});assert.doesNotThrow(()=>readFileSync(join(out,'assets/css/futurecast.css')))});
for(const [name,value] of [
 ['POSIX absolute path','/home/jun/confidential.txt'],
 ['Windows drive path after equals','reference=C:/Users/jun/confidential.txt'],
 ['UNC share path',String.fromCharCode(92,92)+'fileserver'+String.fromCharCode(92)+'share'+String.fromCharCode(92)+'confidential.txt'],
])test('public secrets reject '+name,()=>assert.throws(()=>verify(mutate(1,e=>e.summary_ja=value)),/secret pattern/));
test('horizon bucket must match the actual days',()=>assert.throws(()=>verify(mutate(0,e=>e.horizon_bucket='d181_365')),/horizon bucket mismatch/));
test('private production validate rejects a directory without ledgers',()=>assert.throws(()=>execFileSync(process.execPath,['tools/futurecast/fc.mjs','validate','tools/futurecast','--production'],{stdio:'pipe'}),/Command failed/));
