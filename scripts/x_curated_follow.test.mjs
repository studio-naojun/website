import test from 'node:test';
import assert from 'node:assert/strict';
import {readConfig,selectCandidates} from './x_curated_follow.mjs';

test('curated follow config is bounded and account-specific',async()=>{
  const config=await readConfig();
  assert.equal(config.max_new_per_account,25);
  assert.ok(config.delay_ms>=2000);
  assert.deepEqual(Object.keys(config.accounts).sort(),['naojun_juken','naojun_security']);
});

test('selection preserves priority and excludes already-following, protected and unresolved accounts',()=>{
  const users=new Map([
    ['a',{id:'1',username:'a',name:'A',description:'useful',public_metrics:{followers_count:100}}],
    ['b',{id:'2',username:'b',name:'B',description:'existing',public_metrics:{followers_count:200}}],
    ['c',{id:'3',username:'c',name:'C',description:'protected',public_metrics:{followers_count:300},protected:true}],
    ['d',{id:'4',username:'d',name:'D',description:'useful',public_metrics:{followers_count:400}}],
  ]);
  const relationships=new Map([
    ['a',new Set()],
    ['b',new Set(['following'])],
    ['c',new Set()],
    ['d',new Set()],
  ]);
  const plan=selectCandidates(['a','b','c','missing','d'],users,relationships,2);
  assert.deepEqual(plan.selected.map(item=>item.handle),['a','d']);
  assert.deepEqual(plan.skipped.map(item=>item.reason),['already-following','protected','not-resolved']);
});

test('selection carries pinned ids so apply can detect handle reuse',()=>{
  const users=new Map([
    ['a',{id:'123',username:'a',name:'A',description:'useful',public_metrics:{followers_count:100}}],
  ]);
  const plan=selectCandidates([{handle:'a',id:'123'}],users,new Map([['a',new Set()]]),1);
  assert.equal(plan.selected[0].id,'123');
  assert.equal(plan.selected[0].pinnedId,'123');
});
