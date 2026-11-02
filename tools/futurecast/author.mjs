import {readFileSync,writeFileSync,mkdirSync,existsSync,renameSync,unlinkSync} from 'node:fs';
import {join,dirname,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {canonical,hash,seal,verify,projection,readLines,lines} from './core.mjs';

// An import is a single-writer operation. Never invent a receipt or rewrite a ledger.
export function author({input,sot,outpublic}) {
  if(!input||!sot||!outpublic) throw Error('required: --input PATH --sot PATH --outpublic PATH');
  const seed=JSON.parse(readFileSync(input,'utf8'));
  if(!Array.isArray(seed.candidates)||!seed.candidates.length) throw Error('empty candidates');
  const now=new Date().toISOString().replace(/\.\d{3}Z$/,'Z');
  const pending=[], ids=new Set();
  for(const c of seed.candidates){
    const q=c.question,id=q.question_id, digest=hash(c);
    if(ids.has(id)) throw Error('duplicate question'); ids.add(id);
    if(!Array.isArray(c.evidence)||c.evidence.length<2||new Set(c.evidence.map(e=>e.url)).size<2||!c.evidence.some(e=>e.stance==='supports')||!c.evidence.some(e=>e.stance==='challenges')) throw Error('balanced distinct sources required');
    if(c.probability<.05||c.probability>.95||!Number.isFinite(c.probability)) throw Error('probability range');
    if(!Number.isFinite(Date.parse(c.generated_at))||!Number.isFinite(Date.parse(c.evidence_cutoff_at))||Date.parse(c.generated_at)>=Date.parse(now)||Date.parse(c.evidence_cutoff_at)>Date.parse(c.generated_at)) throw Error('generation must precede actual lock and cutoff must precede generation');
    const path=join(sot,id+'.ndjson'), publicPath=join(outpublic,'ledger',id+'.ndjson');
    let es;
    if(existsSync(path)){
      es=readLines(path);verify(es,{privateLedger:true,production:true});
      if(es[0]?.candidate_sha256!==digest) throw Error('idempotency conflict: '+id);
      for(const e of es){const {schema_version,seq,locked_at,public_prev_hash,public_hash,private_prev_hash,private_hash,idempotency_key,content_sha256,candidate_sha256,...content}=e;if(idempotency_key!==`${id}:${e.entry_type}:${e.entry_id}`||content_sha256!==hash(content))throw Error('idempotency metadata conflict: '+id);}
    } else {
      es=[];
      const add=(type,fields,privateFields={})=>{
        const entry_id=`${id}-${type}-${es.length+1}`, idempotency_key=`${id}:${type}:${entry_id}`;
        const content_sha256=hash({entry_type:type,entry_id,question_id:id,...fields,...privateFields});
        es.push(seal({schema_version:1,entry_type:type,entry_id,question_id:id,seq:es.length+1,locked_at:now,...fields,...privateFields,idempotency_key,content_sha256,candidate_sha256:digest},es.at(-1)?.public_hash||null,es.at(-1)?.private_hash||null));
      };
      const {question_id,...question}=q;
      const days=Math.ceil((Date.parse(q.close_at)-Date.parse(now))/86400000);
      add('question',{...question,horizon_bucket:days<=90?'d30_90':days<=180?'d91_180':'d181_365'},{selection_record_id:id,conflict_check:{reviewed:true}});
      for(const e of c.evidence){
        if(Date.parse(e.retrieved_at)>Date.parse(c.evidence_cutoff_at)||Date.parse(e.published_at)>Date.parse(e.retrieved_at)||!e.observation_snapshot) throw Error('source timestamp or observation');
        const {observation_snapshot,...pub}=e;
        add('evidence',pub,{snapshot_sha256:hash(observation_snapshot),observation_snapshot,license_note:'Source observations and paraphrases; original remains at cited URL.'});
      }
      const ev=es.filter(x=>x.entry_type==='evidence');
      add('revision',{revision_no:1,public_prev_revision_hash:null,status:'forecast',probability:c.probability,hold_reason:null,base_rate:null,base_rate_unavailable_reason_ja:'同一条件の実績データを確認できないため使用しない。',update_reason_ja:c.reason_ja,supports:ev.filter(x=>x.stance==='supports').map(x=>x.entry_id),challenges:ev.filter(x=>x.stance==='challenges').map(x=>x.entry_id),calibration_status:'uncalibrated',evidence_cutoff_at:c.evidence_cutoff_at},{generated_at:c.generated_at,run_id:'futurecast-20261102',route_receipt:{model:'gpt-6.1-terra',reasoning:'high'},prompt_version:'human-directed-v1',raw_runs:[],aggregation:{method:'single uncalibrated judgment'}});
      verify(es,{privateLedger:true,production:true});
      pending.push([path,lines(es)]);
    }
    const projected=lines(es.map(projection));
    const old=existsSync(publicPath)?readFileSync(publicPath,'utf8'):'';
    if(!projected.startsWith(old)) throw Error('public append conflict: '+id);
    if(old!==projected) pending.push([publicPath,projected]);
  }
  // Preflight all files before making changes; rename per file, not a multi-file transaction.
  const staged=[];
  try {for(const [p,s] of pending){mkdirSync(dirname(p),{recursive:true});const old=existsSync(p)?readFileSync(p,'utf8'):null;const tmp=p+'.'+randomUUID()+'.tmp';writeFileSync(tmp,s,{flag:'wx'});staged.push({p,tmp,old});}
    for(const x of staged)if((existsSync(x.p)?readFileSync(x.p,'utf8'):null)!==x.old)throw Error('concurrent modification');
    for(const x of staged)renameSync(x.tmp,x.p);
  } finally {for(const x of staged)if(existsSync(x.tmp))unlinkSync(x.tmp);}
  return {count:seed.candidates.length,candidate_sha256:hash(seed),attempted_at:now};
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
  try {const a=process.argv.slice(2), opts={};if(a.length!==6)throw Error('required: --input PATH --sot PATH --outpublic PATH');for(let i=0;i<a.length;i+=2){if(!['--input','--sot','--outpublic'].includes(a[i])||opts[a[i].slice(2)]||!a[i+1])throw Error('invalid arguments');opts[a[i].slice(2)]=a[i+1];}console.log(canonical(author(opts)));}catch(e){console.error(e.message);process.exitCode=1;}
}
