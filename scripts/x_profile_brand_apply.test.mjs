import test from 'node:test';
import assert from 'node:assert/strict';
import {readBrandConfig,validateProfile,verifyReadback} from './x_profile_brand_apply.mjs';

test('brand config contains exactly the three intended X accounts',async()=>{
  const profiles=await readBrandConfig();
  assert.deepEqual(Object.keys(profiles).sort(),['naojun_juken','naojun_markets','naojun_security']);
  for(const [handle,profile] of Object.entries(profiles)){
    assert.doesNotThrow(()=>validateProfile(handle,profile));
    assert.ok([...profile.description].length<=160);
  }
});

test('JUKEN bio remains aligned to the live middle-school admissions product',async()=>{
  const profiles=await readBrandConfig();
  assert.match(profiles.naojun_juken.description,/中学受験/);
  assert.doesNotMatch(profiles.naojun_juken.description,/大学受験/);
});

test('profile validation rejects cross-account asset paths and overlong bios',()=>{
  assert.throws(()=>validateProfile('naojun_juken',{
    name:'NAOJUN JUKEN',
    description:'中学受験',
    avatar:'assets/x-profiles/naojun_security/avatar.png',
    banner:'assets/x-profiles/naojun_juken/banner.png',
  }),/Unexpected avatar path/);
  assert.throws(()=>validateProfile('naojun_security',{
    name:'NAOJUN SECURITY',
    description:'a'.repeat(161),
    avatar:'assets/x-profiles/naojun_security/avatar.png',
    banner:'assets/x-profiles/naojun_security/banner.png',
  }),/Invalid bio/);
});

test('readback requires both image URLs to change as well as copy',()=>{
  const profile={name:'NAOJUN SECURITY',description:'security bio'};
  const before={name:'old',description:'old',profile_image_url_https:'https://img/old',profile_banner_url:'https://banner/old'};
  assert.equal(verifyReadback(before,{...profile,profile_image_url_https:'https://img/new',profile_banner_url:'https://banner/new'},profile,'naojun_security'),true);
  assert.throws(()=>verifyReadback(before,{...profile,profile_image_url_https:'https://img/old',profile_banner_url:'https://banner/new'},profile,'naojun_security'),/image readback did not change/);
  assert.throws(()=>verifyReadback(before,{...profile,profile_image_url_https:'https://img/new',profile_banner_url:'https://banner/old'},profile,'naojun_security'),/banner readback did not change/);
});
