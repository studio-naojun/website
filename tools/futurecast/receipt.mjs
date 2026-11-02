import {execFileSync} from 'node:child_process';
import {createHash, randomUUID} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdirSync} from 'node:fs';
import {join, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonical, hash, seal, projection, verify, readLines, lines, loadPublic, validateReceipts} from './core.mjs';

const origin='https://naojun.jp';
const digest=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{stdio:['ignore','pipe','pipe']});
const requireValue=(ok,msg)=>{if(!ok)throw Error(msg)};
const nowUTC=()=>new Date().toISOString().replace(/\.\d{3}Z$/,'Z');

// This function never writes: injection is solely for isolated tests. The CLI below
// always uses the fixed HTTPS origin and native fetch, with no test switches.
export async function prepareReceipt({commit, publicDir, privateReceipts=[], request=fetch, clock=nowUTC, gitRead=git, validateHistory=validateReceipts}) {
 requireValue(/^[0-9a-f]{40}$/.test(commit),'commit must be a full lowercase SHA');
 const actual=gitRead('rev-parse','--verify',`${commit}^{commit}`).toString().trim();
 requireValue(actual===commit,'wrong commit SHA');
 gitRead('merge-base','--is-ancestor',commit,'HEAD');
 const commitTime=Number(gitRead('show','-s','--format=%ct',commit).toString().trim())*1000;
 requireValue(Number.isFinite(commitTime)&&commitTime>0,'invalid commit timestamp');
 const {ledgers,receipts}=loadPublic(publicDir,{production:true});
 verify(privateReceipts,{privateLedger:true,production:true,receipt:true});
 requireValue(canonical(privateReceipts.map(projection))===canonical(receipts),'public/private receipt mismatch');
 const paths=gitRead('ls-tree','-r','--name-only',commit,'--','futurecast/data/ledger').toString().trim().split('\n').filter(Boolean);
 requireValue(paths.length>0&&paths.every(p=>/^futurecast\/data\/ledger\/fc-\d{4}-\d{4}\.ndjson$/.test(p)),'invalid committed ledger paths');
 const ids=paths.map(p=>p.split('/').at(-1).slice(0,-7)).sort();
 requireValue(canonical(ids)===canonical(Object.keys(ledgers).sort()),'missing question or extra ledger');
 const covered=ids.map(question_id=>{const es=ledgers[question_id], path=`futurecast/data/ledger/${question_id}.ndjson`, bytes=gitRead('show',`${commit}:${path}`);requireValue(bytes.equals(Buffer.from(lines(es))),'committed ledger bytes mismatch');return {question_id,through_seq:es.length,through_public_hash:es.at(-1).public_hash};});
 if(receipts.length)validateHistory(ledgers,receipts,{requireHistorical:true});
 const prior=receipts.find(r=>r.commit_sha===commit);
 if(prior){requireValue(canonical(prior.covered)===canonical(covered),'same commit different coverage');return {noop:true,receipt:prior};}
 let previousBytes;try {previousBytes=gitRead('show',`${commit}:futurecast/data/receipts.ndjson`);}catch {previousBytes=Buffer.alloc(0);}
 requireValue(previousBytes.equals(Buffer.from(lines(receipts))),'committed prior receipts mismatch');
 const targets=[['/futurecast/','futurecast/index.html'],...ids.flatMap(id=>[[`/futurecast/p/${id}/`,`futurecast/p/${id}/index.html`],[`/futurecast/data/ledger/${id}.ndjson`,`futurecast/data/ledger/${id}.ndjson`]])];
 const observations=[];
 for(const [path,gitPath] of targets){
  const expected=gitRead('show',`${commit}:${gitPath}`), url=origin+path;
  let response=await request(url,{redirect:'manual',signal:AbortSignal.timeout(30000),headers:{'cache-control':'no-cache','accept-encoding':'identity'}});
  requireValue(response.status===200,`HTTP ${response.status}: ${url}`);
  const bytes=Buffer.from(await response.arrayBuffer());
  requireValue(bytes.equals(expected),`HTTP bytes mismatch: ${url}`);
  observations.push({url,status:response.status,sha256:digest(bytes)});
 }
 const visible=clock();
 requireValue(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(visible)&&Number.isFinite(Date.parse(visible))&&Date.parse(visible)>=commitTime,'readback before commit or invalid clock');
 requireValue(covered.every(c=>Date.parse(ledgers[c.question_id].at(-1).locked_at)<=Date.parse(visible)),'readback before ledger lock');
 const locked=clock();requireValue(Date.parse(locked)>=Date.parse(visible),'lock before readback');
 const plan_hash=hash({commit_sha:commit,covered});
 const last=privateReceipts.at(-1);
 const receipt=seal({schema_version:1,entry_type:'publication_receipt',receipt_id:`receipt-${commit}`,receipt_seq:receipts.length+1,plan_hash,commit_sha:commit,public_visible_at:visible,verification_method:'pages_readback',checked_urls:targets.map(([path])=>origin+path),covered,locked_at:locked,readback_raw:{observations,run_id:randomUUID()},idempotency_key:`receipt:${commit}`},last?.public_hash||null,last?.private_hash||null);
 verify([...privateReceipts,receipt],{privateLedger:true,production:true,receipt:true});
 validateHistory(ledgers,[...receipts,projection(receipt)],{requireHistorical:true});
 return {noop:false,receipt};
}

async function main(){
 const args=process.argv.slice(2),opts={};
 requireValue(args.length===6,'required: --sot DIR --public DIR --commit SHA');
 for(let i=0;i<args.length;i+=2){const k=args[i];requireValue(['--sot','--public','--commit'].includes(k)&&!opts[k]&&args[i+1]&&!args[i+1].startsWith('--'),'invalid arguments');opts[k]=args[i+1];}
 const privatePath=join(opts['--sot'],'receipts','ledger.ndjson'), publicPath=join(opts['--public'],'receipts.ndjson');
 const privateReceipts=existsSync(privatePath)?readLines(privatePath):[];
 const publicData=loadPublic(opts['--public'],{production:true});
 for(const [id,entries] of Object.entries(publicData.ledgers)){
  const privateEntries=readLines(join(opts['--sot'],id+'.ndjson'));
  verify(privateEntries,{privateLedger:true,production:true});
  requireValue(canonical(privateEntries.map(projection))===canonical(entries),'private/public ledger mismatch: '+id);
 }
 const result=await prepareReceipt({commit:opts['--commit'],publicDir:opts['--public'],privateReceipts});
 if(result.noop){console.log('already recorded; original receipt retained');return;}
 const nextPrivate=lines([...privateReceipts,result.receipt]),nextPublic=lines([...privateReceipts.map(projection),projection(result.receipt)]);
 const stages=[];let written=[];
 try {
  for(const [p,next] of [[privatePath,nextPrivate],[publicPath,nextPublic]]){mkdirSync(dirname(p),{recursive:true});const old=existsSync(p)?readFileSync(p):null;const tmp=p+'.'+randomUUID()+'.tmp';writeFileSync(tmp,next,{flag:'wx'});stages.push({p,tmp,old});}
  for(const x of stages){const current=existsSync(x.p)?readFileSync(x.p):null;requireValue(x.old===null?current===null:current!==null&&current.equals(x.old),'receipt destination changed');}
  for(const x of stages){renameSync(x.tmp,x.p);written.push(x);}
 }catch(e){for(const x of written.reverse()){if(x.old===null)unlinkSync(x.p);else {const restore=x.p+'.'+randomUUID()+'.restore';writeFileSync(restore,x.old,{flag:'wx'});renameSync(restore,x.p);}}throw e;
 }finally{for(const x of stages)if(existsSync(x.tmp))unlinkSync(x.tmp);}
 console.log(`recorded ${result.receipt.receipt_id}; readback is self-attested`);
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url)))main().catch(e=>{console.error(e.message);process.exitCode=1;});
