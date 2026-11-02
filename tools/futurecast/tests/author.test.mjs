import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {author} from '../author.mjs';
import {build,fixture} from '../fc.mjs';
import {readLines} from '../core.mjs';

test('author locks once, projects without receipts, and rejects conflicts',()=>{
 const dir=mkdtempSync(join(tmpdir(),'fc-author-')),input=join(dir,'seed.json'),sot=join(dir,'sot'),outpublic=join(dir,'public');
 // Generate the required source fixture inside the test's own temporary
 // directory. Never rely on ignored, locally generated fixture files.
 const old=fixture(join(dir,'synthetic'))['demo-0001'][0];
 const question=Object.fromEntries(['question_text_ja','category','significance_reason_ja','outcome_definition_ja','ambiguity_rules_ja','resolution_sources','display_timezone'].map(k=>[k,old[k]]));
 question.question_id='fc-2026-9001';question.close_at=new Date(Date.now()+200*86400000).toISOString().replace(/\.\d{3}Z$/,'Z');
 const evidence=['supports','challenges'].map((stance,i)=>({publisher:'Fixture',title:'Fixture',url:`https://example.invalid/${i}`,source_type:'primary',published_at:'2020-01-01T00:00:00Z',retrieved_at:'2020-01-02T00:00:00Z',summary_ja:'fixture',stance,observation_snapshot:{kind:'synthetic'}}));
 const seed={candidates:[{question,evidence,probability:.6,reason_ja:'fixture',generated_at:'2020-01-03T00:00:00Z',evidence_cutoff_at:'2020-01-02T00:00:00Z'}]};
 const write=()=>writeFileSync(input,JSON.stringify(seed));write();author({input,sot,outpublic});
 const before=readFileSync(join(sot,question.question_id+'.ndjson'),'utf8');author({input,sot,outpublic});assert.equal(readFileSync(join(sot,question.question_id+'.ndjson'),'utf8'),before);
 const rows=build(outpublic,join(dir,'site'),{prepublish:true});assert.equal(rows.rows,1);assert.equal(rows.score.counts.scored,0);assert.match(readFileSync(join(dir,'site','p',question.question_id,'index.html'),'utf8'),/公開確認待ち/);
 assert.equal(readLines(join(outpublic,'ledger',question.question_id+'.ndjson')).length,4);
 seed.candidates[0].probability=.7;write();assert.throws(()=>author({input,sot,outpublic}),/conflict/);assert.equal(readFileSync(join(sot,question.question_id+'.ndjson'),'utf8'),before);
});
