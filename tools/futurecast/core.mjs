import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,readdirSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {execFileSync} from 'node:child_process';

const jcsString = s => {
  for (let i=0;i<s.length;i++) {
    const c=s.charCodeAt(i);
    if (c>=0xd800&&c<=0xdbff) {
      const next=s.charCodeAt(++i);
      if (!(next>=0xdc00&&next<=0xdfff)) throw Error('unpaired surrogate in canonical JSON');
    } else if (c>=0xdc00&&c<=0xdfff) throw Error('unpaired surrogate in canonical JSON');
  }
  return JSON.stringify(s);
};
export const canonical = x => {
  if (x === null || typeof x === 'boolean') return JSON.stringify(x);
  if (typeof x === 'string') return jcsString(x);
  if (typeof x === 'number' && Number.isFinite(x)) return JSON.stringify(x);
  if (Array.isArray(x)) return '['+Array.from(x,canonical).join(',')+']';
  if (typeof x === 'object' && Object.getPrototypeOf(x) === Object.prototype) return '{'+Object.keys(x).sort().map(k=>jcsString(k)+':'+canonical(x[k])).join(',')+'}';
  throw Error('unsupported canonical JSON value');
};
export const hash = x => 'sha256:'+createHash('sha256').update(canonical(x)).digest('hex');
const common=['schema_version','entry_type','entry_id','question_id','seq','locked_at','public_prev_hash','public_hash'];
const fields={question:['question_text_ja','category','significance_reason_ja','outcome_definition_ja','ambiguity_rules_ja','resolution_sources','close_at','display_timezone','horizon_bucket'],evidence:['publisher','title','url','source_type','published_at','retrieved_at','summary_ja','stance','archive_url'],revision:['revision_no','public_prev_revision_hash','status','probability','hold_reason','base_rate','base_rate_unavailable_reason_ja','update_reason_ja','supports','challenges','calibration_status','evidence_cutoff_at'],resolution:['kind','outcome','event_observed_at','resolved_at','basis_evidence_ids','rule_applied_ja','correction_of','adjudicator'],erratum:['field','before','after','semantic_change','reason_ja'],publication_receipt:['schema_version','entry_type','receipt_id','receipt_seq','plan_hash','commit_sha','public_visible_at','verification_method','checked_urls','covered','locked_at','public_prev_hash','public_hash']};
const allow=e=>e.entry_type==='publication_receipt'?fields.publication_receipt:common.concat(fields[e.entry_type]||[]);
const pick=(o,ks)=>Object.fromEntries(ks.filter(k=>Object.hasOwn(o,k)).map(k=>[k,o[k]]));
const omit=(o,k)=>Object.fromEntries(Object.entries(o).filter(([a])=>a!==k));
export function projection(e){
 const p=pick(e,allow(e));
 if (Array.isArray(p.resolution_sources)) p.resolution_sources=p.resolution_sources.map(x=>pick(x,['publisher','description_ja','url']));
 if (p.base_rate && typeof p.base_rate==='object') p.base_rate=pick(p.base_rate,['reference_class_ja','n','k','window_ja','estimate','source_evidence_ids']);
 if (Array.isArray(p.covered)) p.covered=p.covered.map(x=>pick(x,['question_id','through_seq','through_public_hash']));
 return p;
}
const assert=(v,m)=>{if(!v) throw Error(m)};
const time=s=>{assert(typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString()===s.replace('Z','.000Z'),'invalid UTC timestamp: '+s);return Date.parse(s)};
const str=(v,max=4000)=>typeof v==='string'&&v.length>0&&[...v].length<=max;
const strings=(v,max=4000)=>Array.isArray(v)&&v.every(x=>str(x,max));
const url=v=>{try {const u=new URL(v);return typeof v==='string'&&u.protocol==='https:'&&!!u.hostname&&!u.username&&!u.password}catch{return false}};
// Public output must never contain local paths, including path fragments in prose.
// Inspect canonical JSON: a UNC prefix is encoded as four backslashes.
const secrets=/private_|run_|route|prompt|sk-[A-Za-z0-9]|ghp_|(?:^|[^A-Za-z0-9])[A-Za-z]:[\\/]|(?:^|[^A-Za-z0-9/])\/(?:home|Users|etc|root|mnt|tmp|var|opt|srv|private)(?:\/|["\s]|$)|\\{4,}/i;
export function verify(entries,{privateLedger=false,production=false,receipt=false}={}){
 let prev=null,priv=null,lastTime=0,rev=null,revNo=0,q=null,final=false,state='pending',proposal=null,dispute=null,effective=null; const ids=new Map();
 for(let i=0;i<entries.length;i++){
  const e=entries[i], pub=projection(e), seq=receipt?'receipt_seq':'seq';
  assert(e && typeof e==='object'&&!Array.isArray(e),'entry object'); assert(e.schema_version===1&&e[seq]===i+1,'schema/sequence'); assert(receipt?e.entry_type==='publication_receipt':!!fields[e.entry_type]&&e.entry_type!=='publication_receipt','entry type');
  for(const k of allow(e)) { if (!(e.entry_type==='evidence' && k==='archive_url')) assert(Object.hasOwn(e,k),'missing field '+k); }
  assert(e.public_prev_hash===prev&&e.public_hash===hash(omit(pub,'public_hash')),'public hash chain');
  assert(/^sha256:[0-9a-f]{64}$/.test(e.public_hash),'hash format');
  assert(!secrets.test(canonical(pub)),'secret pattern'); if(!privateLedger) {assert(canonical(e)===canonical(pub),'non-public field / base rate fields');}
  if(privateLedger){assert(e.private_prev_hash===priv&&e.private_hash===hash(omit(e,'private_hash')),'private hash chain');priv=e.private_hash;}
  if(privateLedger&&production){const req={question:['selection_record_id','conflict_check'],evidence:['snapshot_sha256','license_note'],revision:['generated_at','run_id','route_receipt','prompt_version','raw_runs','aggregation'],publication_receipt:['readback_raw','idempotency_key']}[e.entry_type]||[];for(const k of req)assert(Object.hasOwn(e,k),'missing private metadata '+k);if(e.entry_type==='question')assert(str(e.selection_record_id)&&e.conflict_check&&typeof e.conflict_check==='object'&&!Array.isArray(e.conflict_check),'private question metadata');if(e.entry_type==='evidence')assert(/^sha256:[0-9a-f]{64}$/.test(e.snapshot_sha256)&&str(e.license_note),'private source trace');if(e.entry_type==='revision')assert(str(e.run_id)&&str(e.prompt_version)&&e.route_receipt&&typeof e.route_receipt==='object'&&!Array.isArray(e.route_receipt)&&Array.isArray(e.raw_runs)&&e.aggregation&&typeof e.aggregation==='object'&&!Array.isArray(e.aggregation),'private revision metadata');if(receipt)assert(e.readback_raw&&typeof e.readback_raw==='object'&&!Array.isArray(e.readback_raw)&&str(e.idempotency_key),'private receipt metadata');}
  for(const k of ['resolution_sources','base_rate','covered'])if(Object.hasOwn(e,k))assert(canonical(e[k])===canonical(pub[k]),'non-public field');
  const locked=time(e.locked_at); assert(locked>=lastTime,'lock order');lastTime=locked;
  if(receipt){assert(Array.isArray(e.covered)&&e.covered.every(c=>c&&typeof c==='object'&&!Array.isArray(c)&&canonical(Object.keys(c).sort())===canonical(['question_id','through_public_hash','through_seq'])&&str(c.question_id,100)&&Number.isInteger(c.through_seq)&&c.through_seq>0&&/^sha256:[0-9a-f]{64}$/.test(c.through_public_hash)),'receipt coverage');assert(str(e.receipt_id)&&/^sha256:[0-9a-f]{64}$/.test(e.plan_hash)&&/^[0-9a-f]{40}$/.test(e.commit_sha)&&e.verification_method==='pages_readback'&&time(e.public_visible_at)<=locked&&Array.isArray(e.covered)&&Array.isArray(e.checked_urls)&&e.checked_urls.length>0&&e.checked_urls.every(u=>url(u)&&new URL(u).hostname==='naojun.jp'),'receipt');prev=e.public_hash;continue;}
  assert(str(e.entry_id,200)&&!ids.has(e.entry_id),'entry id');ids.set(e.entry_id,e);
  assert(typeof e.question_id==='string'&&(production?/^fc-\d{4}-\d{4}$/.test(e.question_id):/^(fc-\d{4}-\d{4}|demo-[a-z0-9-]+)$/.test(e.question_id)),'question id');
  if(i===0){assert(e.entry_type==='question','first must be question');q=e; const days=Math.ceil((time(e.close_at)-locked)/86400000);assert(e.seq===1&&days>=30&&days<=365,'question horizon');assert(Array.isArray(e.resolution_sources)&&e.resolution_sources.every(x=>x&&typeof x==='object'&&!Array.isArray(x)&&canonical(Object.keys(x).sort())===canonical(['description_ja','publisher','url'])&&str(x.publisher,300)&&str(x.description_ja,1000)&&url(x.url)),'resolution source fields');const bucket=days<=90?'d30_90':days<=180?'d91_180':'d181_365';assert(e.horizon_bucket===bucket,'horizon bucket mismatch');assert(['ai_tech','economy','geopolitics','science_space','environment_energy','industry'].includes(e.category)&&str(e.question_text_ja,160)&&[...e.question_text_ja].length>=20&&e.question_text_ja.endsWith('\u304b')&&str(e.significance_reason_ja,300)&&str(e.outcome_definition_ja),'question fields');assert(e.display_timezone==='Asia/Tokyo'&&Array.isArray(e.resolution_sources)&&e.resolution_sources.length&&strings(e.ambiguity_rules_ja)&&e.ambiguity_rules_ja.length,'question fields');}
  assert(e.question_id===q.question_id,'mixed questions');assert(i===0||e.entry_type!=='question','second question');
  if(e.entry_type==='evidence'){assert(str(e.publisher,300)&&str(e.title,500)&&str(e.summary_ja,200)&&['primary','secondary','dataset','market_reference'].includes(e.source_type)&&['supports','challenges','context'].includes(e.stance),'evidence fields');assert(time(e.published_at)<=time(e.retrieved_at)&&time(e.retrieved_at)<=locked&&url(e.url)&&(e.archive_url==null||url(e.archive_url)),'evidence time/url');}
  if(e.entry_type==='revision'){
   assert(!final&&locked<time(q.close_at),'revision after close/final');assert(e.revision_no===++revNo&&e.public_prev_revision_hash===rev,'revision chain');rev=e.public_hash;
   assert(time(e.evidence_cutoff_at)<=locked,'future cutoff');if(privateLedger)assert(time(e.evidence_cutoff_at)<=time(e.generated_at)&&time(e.generated_at)<=locked,'generation time');
   if(e.base_rate!==null){const b=e.base_rate;assert(b&&typeof b==='object'&&!Array.isArray(b)&&canonical(Object.keys(b).sort())===canonical(['estimate','k','n','reference_class_ja','source_evidence_ids','window_ja'])&&Number.isInteger(b.n)&&b.n>=0&&Number.isInteger(b.k)&&b.k>=0&&b.k<=b.n&&typeof b.estimate==='number'&&Number.isFinite(b.estimate)&&Math.abs(b.estimate-(b.k+1)/(b.n+2))<1e-9&&str(b.reference_class_ja)&&str(b.window_ja)&&strings(b.source_evidence_ids)&&b.source_evidence_ids.length>0&&b.source_evidence_ids.every(id=>{const ev=ids.get(id);return ev?.entry_type==='evidence'&&ev.source_type!=='market_reference'&&time(ev.published_at)<=time(e.evidence_cutoff_at)&&time(ev.retrieved_at)<=time(e.evidence_cutoff_at)}),'base rate fields / future or missing evidence');assert(e.base_rate_unavailable_reason_ja===null,'base rate reason');}else assert(str(e.base_rate_unavailable_reason_ja),'base rate reason');assert(str(e.update_reason_ja,400)&&e.calibration_status==='uncalibrated'&&strings(e.supports)&&strings(e.challenges),'revision fields');
   if(e.status==='hold')assert(e.probability===null&&['insufficient_evidence','no_resolution_source_yet','model_disagreement','pending_event_check'].includes(e.hold_reason),'hold');else {assert(e.status==='forecast'&&typeof e.probability==='number'&&e.probability>=.01&&e.probability<=.99&&Math.abs(e.probability*100-Math.round(e.probability*100))<1e-8&&e.hold_reason===null&&e.supports.length>=1&&e.challenges.length>=1,'forecast');}
   const refs=[...e.supports,...e.challenges];assert(new Set(refs).size===refs.length,'duplicate evidence');for(const [stance,list] of [['supports',e.supports],['challenges',e.challenges]])for(const id of list){const ev=ids.get(id);assert(ev?.entry_type==='evidence'&&ev.stance===stance&&time(ev.published_at)<=time(e.evidence_cutoff_at)&&time(ev.retrieved_at)<=time(e.evidence_cutoff_at)&&ev.source_type!=='market_reference','future or missing evidence / stance');}
  }
  if(e.entry_type==='erratum')assert(str(e.reason_ja)&&((e.field==='ambiguity_rules_ja'&&strings(e.before)&&strings(e.after))||(e.field!=='ambiguity_rules_ja'&&str(e.before)&&str(e.after)))&&!final&&locked<time(q.close_at)&&['question_text_ja','significance_reason_ja','ambiguity_rules_ja'].includes(e.field)&&e.semantic_change===false,'erratum');
  if(e.entry_type==='resolution'){
   assert(['proposed','final','disputed','void','correction'].includes(e.kind)&&time(e.resolved_at)<=locked,'resolution');
   assert(['disputed','void'].includes(e.kind)?e.outcome===null:[0,1].includes(e.outcome),'outcome');
   assert(strings(e.basis_evidence_ids)&&new Set(e.basis_evidence_ids).size===e.basis_evidence_ids.length&&str(e.rule_applied_ja)&&['rule','editor','owner'].includes(e.adjudicator),'resolution fields');
   if(e.kind!=='void')assert(e.basis_evidence_ids.length>0&&e.basis_evidence_ids.every(id=>{const v=ids.get(id);return v?.entry_type==='evidence'&&v.source_type==='primary'&&time(v.retrieved_at)<=time(e.resolved_at)}),'resolution primary basis');
   if(e.outcome===1)assert(e.event_observed_at!==null&&time(e.event_observed_at)<=time(e.resolved_at)&&time(e.event_observed_at)<=time(q.close_at),'yes event time');
   else {assert(e.event_observed_at===null,'non-yes event');if(e.outcome===0)assert(time(e.resolved_at)>=time(q.close_at),'no before close');}
   if(e.kind==='proposed'){assert(state==='pending','invalid proposed transition');proposal=e;state='proposed';}
   if(e.kind==='disputed'){assert(state==='pending'||state==='proposed','invalid disputed transition');dispute=e;state='disputed';}
   if(e.kind==='final'){assert((state==='proposed'&&time(e.resolved_at)>=time(proposal.resolved_at)+7*86400000&&e.outcome===proposal.outcome&&e.event_observed_at===proposal.event_observed_at)||(state==='disputed'&&time(e.resolved_at)<time(dispute.resolved_at)+60*86400000),'invalid final transition / objection period');state='final';effective=e;}
   if(e.kind==='void'){assert(state==='pending'||(state==='disputed'&&time(e.resolved_at)>=time(dispute.resolved_at)+60*86400000),'invalid void transition');state='void';effective=e;}
   if(e.kind==='correction'){assert((state==='final'||state==='void')&&effective&&e.correction_of===effective.entry_id,'correction target');effective=e;state='final';}
   else assert(e.correction_of===null,'unexpected correction target');
   if(state!=='pending')final=true;
  }
  prev=e.public_hash;
 }
 return true;
}
export const readLines=p=>{if(!existsSync(p))throw Error('missing input: '+p);const s=readFileSync(p,'utf8');if(!s)return [];assert(s.endsWith('\n'),'missing newline');return s.slice(0,-1).split('\n').map(l=>{let x=JSON.parse(l);assert(canonical(x)===l,'noncanonical line');return x})};
export const lines=a=>a.map(canonical).join('\n')+(a.length?'\n':'');
export function seal(e,prev=null,privatePrev=null){e={...e,public_prev_hash:prev};e.public_hash=hash(omit(projection(e),'public_hash'));e.private_prev_hash=privatePrev;e.private_hash=hash(omit(e,'private_hash'));return e;}
export function validateReceipts(ledgers,receipts,{requireHistorical=false,requireCommitted=false}={}){
 verify(receipts,{receipt:true}); const seen={}, commits=new Map(); let last=0, historical=Object.keys(ledgers).length&&!receipts.length?'UNVERIFIED':'GIT_VERIFIED_READBACK_SELF_ATTESTED';
 for(const r of receipts){
  assert(/^[0-9a-f]{40}$/.test(r.commit_sha),'commit sha');assert(time(r.public_visible_at)>=last,'receipt time order');last=time(r.public_visible_at);
  assert(!commits.has(r.commit_sha),'duplicate commit receipt');commits.set(r.commit_sha,r.covered);
  const ids=r.covered.map(c=>c.question_id);assert(new Set(ids).size===ids.length,'duplicate coverage');
  let historicalNames=null;try {const paths=execFileSync('git',['ls-tree','-r','--name-only',r.commit_sha,'--','futurecast/data/ledger'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});historicalNames=paths.trim().split('\n').filter(Boolean).map(p=>p.split('/').at(-1).replace(/\.ndjson$/,''));}catch{historical='UNVERIFIED';}
  if(historicalNames)assert(canonical(ids.slice().sort())===canonical(historicalNames.sort()),'historical coverage');
  if(historicalNames){try{execFileSync('git',['merge-base','--is-ancestor',r.commit_sha,'HEAD'],{stdio:'ignore'});}catch{throw Error('receipt commit not in HEAD history');}const commitTime=Number(execFileSync('git',['show','-s','--format=%ct',r.commit_sha],{encoding:'utf8'}).trim())*1000;assert(Number.isFinite(commitTime)&&time(r.public_visible_at)>=commitTime,'receipt before commit');for(const c of r.covered){const bytes=execFileSync('git',['show',`${r.commit_sha}:futurecast/data/ledger/${c.question_id}.ndjson`]);const es=ledgers[c.question_id];assert(es&&bytes.equals(Buffer.from(lines(es.slice(0,c.through_seq)))),'historical ledger bytes');}
   assert(canonical(ids)===canonical(ids.slice().sort()),'receipt coverage order');
   const urls=['https://naojun.jp/futurecast/',...ids.flatMap(id=>[`https://naojun.jp/futurecast/p/${id}/`,`https://naojun.jp/futurecast/data/ledger/${id}.ndjson`])];
   assert(canonical(r.checked_urls)===canonical(urls),'receipt checked URLs');
   assert(r.receipt_id===`receipt-${r.commit_sha}`&&r.plan_hash===hash({commit_sha:r.commit_sha,covered:r.covered}),'receipt identity/plan');
   let prior=Buffer.alloc(0);try{prior=execFileSync('git',['show',`${r.commit_sha}:futurecast/data/receipts.ndjson`],{stdio:['ignore','pipe','ignore']});}catch{}
   assert(prior.equals(Buffer.from(lines(receipts.slice(0,r.receipt_seq-1)))),'historical receipts bytes');
  }
  for(const id of Object.keys(seen))assert(ids.includes(id),'receipt omitted previous question');
  for(const c of r.covered){assert(canonical(Object.keys(c).sort())===canonical(['question_id','through_public_hash','through_seq']),'coverage fields');const es=ledgers[c.question_id];assert(Number.isInteger(c.through_seq)&&c.through_seq>0&&c.through_seq>=(seen[c.question_id]||0)&&es?.[c.through_seq-1]?.public_hash===c.through_public_hash,'receipt coverage');assert(time(r.public_visible_at)>=time(es[c.through_seq-1].locked_at),'receipt before lock');seen[c.question_id]=c.through_seq;}
 }
 if(requireHistorical)assert(historical==='GIT_VERIFIED_READBACK_SELF_ATTESTED','historical completeness UNVERIFIED');
 if(requireCommitted&&receipts.length){
  const revisions=execFileSync('git',['rev-list','--reverse','HEAD','--','futurecast/data/receipts.ndjson'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);let found=0;
  for(const rev of revisions){let b;try{b=execFileSync('git',['show',`${rev}:futurecast/data/receipts.ndjson`],{stdio:['ignore','pipe','ignore']});}catch{continue;}while(found<receipts.length&&b.subarray(0,Buffer.byteLength(lines(receipts.slice(0,found+1)))).equals(Buffer.from(lines(receipts.slice(0,found+1))))){const ct=Number(execFileSync('git',['show','-s','--format=%ct',rev],{encoding:'utf8'}).trim())*1000;assert(ct>=time(receipts[found].locked_at),'receipt after containing commit');found++;}}
  assert(found===receipts.length,'receipt not found in Git history');
 }
 return historical;
}
export function derive(ledgers,receipts){
 const historical=validateReceipts(ledgers,receipts);return Object.values(ledgers).map(es=>{
  const q=es[0],visible=e=>receipts.filter(x=>x.covered.some(c=>c.question_id===q.question_id&&c.through_seq>=e.seq)).map(x=>x.public_visible_at).sort()[0]||null;
  const res=es.filter(e=>e.entry_type==='resolution'&&['final','disputed','void','correction'].includes(e.kind)&&visible(e)).at(-1);
  const revisions=es.filter(e=>e.entry_type==='revision').map(r=>{const v=visible(r),event=res?.event_observed_at;let eligibility=r.status==='hold'?'hold':event&&r.locked_at>=event?'locked_after_event':!v?'visibility_unconfirmed':v>=(event&&event<q.close_at?event:q.close_at)?'late_publication':'eligible';return {...r,public_visible_at:v,scoring_eligibility:eligibility};});
  return {question:q,resolution:res||null,revisions,evidence:es.filter(e=>e.entry_type==='evidence'),history:es.filter(e=>['resolution','erratum'].includes(e.entry_type)&&visible(e)),historical_completeness:historical};
 });
}
export function score(rows){
 const counts={total:rows.length,scored:0,unscored_hold:0,unscored_visibility_unconfirmed:0,unscored_late_publication:0,pending:0,disputed:0,void:0},scores=[],records=[];
 for(const x of rows){const r=x.resolution, forecasts=x.revisions.filter(z=>z.status==='forecast'), first=forecasts[0];let category=!r?'pending':r.kind==='void'?'void':r.kind==='disputed'?'disputed':!first?'unscored_hold':first.scoring_eligibility==='visibility_unconfirmed'?'unscored_visibility_unconfirmed':first.scoring_eligibility!=='eligible'?'unscored_late_publication':'scored';counts[category]++;let result={question_id:x.question.question_id,category,reason:category,resolution_status:r?.kind||null,recomputed_due_to:r?.kind==='correction'?r.entry_id:null};
  if(category==='scored'){
   const eligible=forecasts.filter(z=>z.scoring_eligibility==='eligible'), b=p=>(p-r.outcome)**2, end=Date.parse(r.event_observed_at&&r.event_observed_at<x.question.close_at?r.event_observed_at:x.question.close_at), day=86400000, offset=9*3600000;
   const start=Math.floor((Date.parse(first.public_visible_at)+offset)/day)*day-offset+day, limit=Math.floor((end+offset)/day)*day-offset;
   let sum=0,sensitivity=0,n=0,hold=0;
   for(let t=start;t<limit;t+=day){const revision=x.revisions.filter(z=>z.public_visible_at&&Date.parse(z.public_visible_at)<=t&&Date.parse(z.public_visible_at)<end).at(-1);if(!revision)continue;n++;if(revision.status==='hold'){hold++;sensitivity+=b(.5)}else{sum+=b(revision.probability);sensitivity+=b(revision.probability)}}
   result={...result,first:b(first.probability),last:b(eligible.at(-1).probability),timeweighted:n>hold?sum/(n-hold):null,timeweighted_hold_half:n?sensitivity/n:null,days:n,hold_days:hold,hold_fraction:n?hold/n:null,baseline_half:.25,baseline_rate:first.base_rate?b(first.base_rate.estimate):null,recomputed_due_to:r.kind==='correction'?r.entry_id:null};scores.push(result);
  }records.push(result);
 }
 const mean=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;const rates=scores.filter(s=>s.baseline_rate!==null).map(s=>s.baseline_rate);return {counts,scores,records,aggregate:{n:scores.length,first:mean(scores.map(s=>s.first)),last:mean(scores.map(s=>s.last)),timeweighted:mean(scores.map(s=>s.timeweighted).filter(x=>x!==null)),timeweighted_n:scores.filter(s=>s.timeweighted!==null).length},baseline:{half:.25,rate_n:rates.length,rate:mean(rates)},limitations:{reference_only:counts.scored<30,correlated_questions:true,zero_day_count:scores.filter(s=>s.days===0).length}};
}
export function loadPublic(dir,{production=false}={}){assert(existsSync(dir),'missing input directory: '+dir);const path=join(dir,'ledger');const ledgers={};if(existsSync(path))for(const f of readdirSync(path).filter(x=>x.endsWith('.ndjson')).sort()){let es=readLines(join(path,f));assert(es.length&&f===es[0].question_id+'.ndjson','ledger filename');verify(es,{production});ledgers[es[0].question_id]=es;}assert(existsSync(path)||existsSync(join(dir,'index.json'))&&readFileSync(join(dir,'index.json'),'utf8').trim()==='[]','missing public ledger or explicit empty dataset');return {ledgers,receipts:existsSync(join(dir,'receipts.ndjson'))?readLines(join(dir,'receipts.ndjson')):[]};}
export function writeNew(p,s){mkdirSync(dirname(p),{recursive:true});if(existsSync(p)){assert(readFileSync(p,'utf8')===s,'destination exists with different content: '+p);return;}writeFileSync(p,s,{flag:'wx'});}
export function checkAppend(base,dir){
 const names=execFileSync('git',['ls-tree','-r','--name-only',base,'--',dir],{encoding:'utf8'}).trim().split('\n').filter(p=>p.endsWith('.ndjson'));
 assert(existsSync(dir),'missing append input: '+dir);
 if(!names.length){
  // On the first release there are no published NDJSON bytes to preserve.
  // This is NOT a waiver for an existing ledger: Git's base tree must truly contain none.
  const {ledgers,receipts}=loadPublic(dir,{production:true});
  assert(Object.keys(ledgers).length>0&&!receipts.length,'initial release requires real, unreceipted public ledgers');
  return {initial_release:true,base};
 }
 for(const p of names){
  const old=execFileSync('git',['show',`${base}:${p}`]);
  assert(existsSync(p)&&readFileSync(p).subarray(0,old.length).equals(old),'append-only violation: '+p);
 }
 return {initial_release:false,base,previous_files:names.length};
}
