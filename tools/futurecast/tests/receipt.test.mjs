import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareReceipt} from '../receipt.mjs';
import {projection,lines,loadPublic,validateReceipts,seal} from '../core.mjs';

const root=mkdtempSync(join(tmpdir(),'fc-receipt-')), data=join(root,'data');
mkdirSync(join(data,'ledger'),{recursive:true});
const ids=['fc-2026-0001','fc-2026-0002','fc-2026-0003'];
for(const id of ids)copyFileSync(`futurecast/data/ledger/${id}.ndjson`,join(data,'ledger',id+'.ndjson'));
const sha='a'.repeat(40), blobs=new Map();
blobs.set('futurecast/index.html',readFileSync('futurecast/index.html'));
for(const id of ids){blobs.set(`futurecast/p/${id}/index.html`,readFileSync(`futurecast/p/${id}/index.html`));blobs.set(`futurecast/data/ledger/${id}.ndjson`,readFileSync(`futurecast/data/ledger/${id}.ndjson`));}
function fakeGit(...args){
 if(args[0]==='merge-base')return Buffer.alloc(0);
 if(args[0]==='rev-parse')return Buffer.from(sha+'\n');
 if(args[0]==='ls-tree')return Buffer.from(ids.map(id=>`futurecast/data/ledger/${id}.ndjson`).join('\n')+'\n');
 if(args[0]==='show'&&args[1]==='-s')return Buffer.from('1700000000\n');
 if(args[0]==='show'){const path=args[1].slice(41);if(!blobs.has(path))throw Error('missing Git blob');return blobs.get(path);}
 throw Error('unexpected Git command');
}
let mode='ok';
const server=createServer((req,res)=>{
 if(mode==='status'){res.writeHead(503);res.end();return;}
 if(mode==='redirect'){res.writeHead(302,{location:'https://unrelated.invalid/'});res.end();return;}
 let path=req.url.slice(1);if(path.endsWith('/'))path+='index.html';
 const body=blobs.get(path);if(!body){res.writeHead(404);res.end();return;}
 res.writeHead(200);res.end(mode==='mismatch'?Buffer.concat([body,Buffer.from('!')]):body);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
test.after(()=>server.close());
const request=(url,options)=>fetch(`http://127.0.0.1:${server.address().port}${new URL(url).pathname}`,options);
const validateHistory=()=> 'GIT_VERIFIED_READBACK_SELF_ATTESTED';
const opts={commit:sha,publicDir:data,gitRead:fakeGit,request,clock:()=> '2027-01-01T00:00:00Z',validateHistory};
test('local HTTP roundtrip constructs complete private and public chains',async()=>{const x=await prepareReceipt(opts);assert.equal(x.noop,false);assert.equal(x.receipt.covered.length,3);assert.equal(x.receipt.readback_raw.observations.length,7);assert.equal(x.receipt.public_visible_at,'2027-01-01T00:00:00Z');});
test('HTTP byte mismatch fails before receipt',async()=>{mode='mismatch';await assert.rejects(prepareReceipt(opts),/bytes mismatch/);mode='ok'});
test('non-200 fails before receipt',async()=>{mode='status';await assert.rejects(prepareReceipt(opts),/HTTP 503/);mode='ok'});
test('redirect is refused',async()=>{mode='redirect';await assert.rejects(prepareReceipt(opts),/HTTP 302/);mode='ok'});
test('wrong commit SHA is rejected',async()=>assert.rejects(prepareReceipt({...opts,commit:'b'.repeat(40)}),/wrong commit/));
test('malformed commit SHA is rejected',async()=>assert.rejects(prepareReceipt({...opts,commit:'main'}),/full lowercase/));
test('missing question is rejected',async()=>{const g=(...a)=>a[0]==='ls-tree'?Buffer.from(`futurecast/data/ledger/${ids[0]}.ndjson\n`):fakeGit(...a);await assert.rejects(prepareReceipt({...opts,gitRead:g}),/missing question/)});
test('changed committed ledger bytes are rejected',async()=>{const g=(...a)=>a[0]==='show'&&a[1].includes('/ledger/')?Buffer.from('bad'):fakeGit(...a);await assert.rejects(prepareReceipt({...opts,gitRead:g}),/committed ledger bytes/)});
test('visible time before commit is rejected',async()=>assert.rejects(prepareReceipt({...opts,clock:()=> '2000-01-01T00:00:00Z'}),/before commit/));
test('lock time before visibility is rejected',async()=>{let i=0;await assert.rejects(prepareReceipt({...opts,clock:()=>++i===1?'2027-01-01T00:00:00Z':'2026-01-01T00:00:00Z'}),/lock before/)});
test('missing Git history fails production validation',()=>{const d=loadPublic(data);const x=seal({schema_version:1,entry_type:'publication_receipt',receipt_id:'test',receipt_seq:1,plan_hash:'sha256:'+'0'.repeat(64),commit_sha:sha,public_visible_at:'2027-01-01T00:00:00Z',verification_method:'pages_readback',checked_urls:['https://naojun.jp/futurecast/'],covered:ids.map(id=>({question_id:id,through_seq:d.ledgers[id].length,through_public_hash:d.ledgers[id].at(-1).public_hash})),locked_at:'2027-01-01T00:00:00Z'},null,null);assert.throws(()=>validateReceipts(d.ledgers,[projection(x)],{requireHistorical:true}),/UNVERIFIED/)});
test('retry returns original receipt without another HTTP request',async()=>{const x=await prepareReceipt(opts);writeFileSync(join(data,'receipts.ndjson'),lines([projection(x.receipt)]));try{const again=await prepareReceipt({...opts,privateReceipts:[x.receipt],request:()=>{throw Error('unexpected request')}});assert.equal(again.noop,true);assert.equal(again.receipt.public_visible_at,x.receipt.public_visible_at)}finally{writeFileSync(join(data,'receipts.ndjson'),'')}});
test('private/public mismatch is rejected',async()=>{const x=await prepareReceipt(opts);await assert.rejects(prepareReceipt({...opts,privateReceipts:[x.receipt]}),/mismatch/)});
