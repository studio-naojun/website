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
    ['a',{screen_name:'a',name:'A',description:'useful',followers_count:100}],
    ['b',{screen_name:'b',name:'B',description:'existing',followers_count:200}],
    ['c',{screen_name:'c',name:'C',description:'protected',followers_count:300,protected:true}],
    ['d',{screen_name:'d',name:'D',description:'useful',followers_count:400}],
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
    ['a',{id_str:'123',screen_name:'a',name:'A',description:'useful',followers_count:100}],
  ]);
  const plan=selectCandidates([{handle:'a',id:'123'}],users,new Map([['a',new Set()]]),1);
  assert.equal(plan.selected[0].id,'123');
  assert.equal(plan.selected[0].pinnedId,'123');
});
