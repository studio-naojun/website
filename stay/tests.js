(function(){
  const out=document.querySelector('#testOutput');
  const button=document.querySelector('#runTests');
  function line(ok,msg){out.textContent+=`${ok?'PASS':'FAIL'}  ${msg}\n`;if(!ok)throw new Error(msg);}
  async function run(){
    out.textContent='';
    const backup=StayAtlas.clone(StayAtlas.load());
    const backupRevs=StayAtlas.clone(StayAtlas.loadRevisions());
    try{
      const legacyResponse=await fetch('./data/legacy-table.html',{cache:'no-store'});
      line(legacyResponse.ok,'bundled legacy table is readable');
      const rawFull=StayAtlas.buildDbFromLegacyHtml(await legacyResponse.text());
      line(rawFull.hotels.length>100,'bundled legacy table imports more than 100 hotel rows');
      line(rawFull.datasetVersion===StayAtlas.DATASET_VERSION,'bundled dataset has current dataset version');
      line(rawFull.hotels.some(h=>h.name_en==='Bulgari Hotel Tokyo'),'explicit English hotel name is preserved');
      line(rawFull.hotels.some(h=>h.quality==='needs_review'),'uncertain legacy rows remain needs_review');
      const rawTokyo=rawFull.hotels.find(h=>h.name_ja==='ウォルドーフ・アストリア東京日本橋');
      line(rawTokyo?.opening_note==='2026年開業予定','legacy opening note is preserved before curation');

      const full=StayAtlas.applyCuratedPatches(rawFull);
      line(full.curationVersion===StayAtlas.CURATION_VERSION,'curation version is applied');
      const waldorfOsaka=full.hotels.find(h=>h.name_ja==='ウォルドーフ・アストリア大阪');
      line(waldorfOsaka?.status==='open'&&waldorfOsaka?.name_en==='Waldorf Astoria Osaka','Waldorf Astoria Osaka receives official identity/status patch');
      line(waldorfOsaka?.verifications?.status?.status==='verified','official status verification is stored per field');
      const canopy=full.hotels.find(h=>h.name_ja==='キャノピーbyヒルトン沖縄宮古島リゾート');
      line(canopy?.status==='open'&&canopy?.city==='宮古島市','Canopy Miyako receives official location/status patch');
      const tokyo=full.hotels.find(h=>h.name_ja==='ウォルドーフ・アストリア東京日本橋');
      line(tokyo?.opening_note==='2027年開業予定','Waldorf Astoria Tokyo opening note is corrected by curated source');
      const nagoya=full.hotels.find(h=>h.name_ja==='コンラッド名古屋');
      line(nagoya?.quality==='needs_review'&&nagoya?.verifications?.status?.status==='conflicting','Conrad Nagoya source conflict remains explicit');

      const health=StayAtlas.health(full);line(health.total===full.hotels.length,'health total matches hotel count');
      line(health.fieldVerified>0,'health reports verified fields');
      line(health.fieldConflicting>0,'health reports conflicting fields');
      const first=full.hotels[0];line(Boolean(first),'full dataset contains at least one hotel');
      StayAtlas.save(full);
      const next=StayAtlas.clone(first);next.name_ja=`${first.name_ja} TEST`;
      const diff=StayAtlas.diffHotel(first,next);line(diff.some(x=>x.path==='name_ja'),'diff detects hotel name change');
      StayAtlas.updateHotel(first.id,next,'smoke edit');line(StayAtlas.load().hotels.find(h=>h.id===first.id).name_ja.endsWith(' TEST'),'edit persists');
      const editRev=StayAtlas.loadRevisions().find(r=>r.hotelId===first.id&&r.action==='edit');line(Boolean(editRev),'edit creates revision');
      line(editRev.changes.some(c=>c.path==='name_ja'),'revision keeps field-level change summary');
      StayAtlas.restoreRevision(editRev.id);line(StayAtlas.load().hotels.find(h=>h.id===first.id).name_ja===first.name_ja,'restore returns historical snapshot');

      const html='<table><tbody><tr><td>テストホテル</td><td>東京都</td><td>12歳まで</td><td></td><td>4人まで</td><td>〇</td><td>12歳まで無料</td><td>×</td><td>〇</td><td>無料</td></tr><tr><td>未確認ホテル</td><td></td><td></td><td></td><td></td><td></td><td>いける？</td><td></td><td></td><td></td></tr></tbody></table>';
      const imported=StayAtlas.buildDbFromLegacyHtml(html);line(imported.hotels.length===2,'legacy importer reads table rows');line(imported.hotels[0].capacity.value===4,'legacy importer parses capacity');line(imported.hotels[1].quality==='needs_review','uncertain legacy data becomes needs_review');
      out.textContent+='\nAll smoke tests passed.\n';
    }catch(e){out.textContent+=`\n${e.message}\n`;}
    finally{
      StayAtlas.save(backup);
      localStorage.setItem('naojun_stay_atlas_revisions_v1',JSON.stringify(backupRevs));
    }
  }
  button.addEventListener('click',run);
})();