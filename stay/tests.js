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
      line(full.curationVersion===4&&full.curationVersion===StayAtlas.CURATION_VERSION,'curation version 4 is applied');

      const waldorfOsaka=full.hotels.find(h=>h.name_ja==='ウォルドーフ・アストリア大阪');
      line(waldorfOsaka?.status==='open'&&waldorfOsaka?.name_en==='Waldorf Astoria Osaka','Waldorf Astoria Osaka receives official identity/status patch');
      line(waldorfOsaka?.verifications?.status?.status==='verified','official status verification is stored per field');
      const canopy=full.hotels.find(h=>h.name_ja==='キャノピーbyヒルトン沖縄宮古島リゾート');
      line(canopy?.status==='open'&&canopy?.city==='宮古島市','Canopy Miyako receives official location/status patch');
      const tokyo=full.hotels.find(h=>h.name_ja==='ウォルドーフ・アストリア東京日本橋');
      line(tokyo?.opening_note==='2027年開業予定','Waldorf Astoria Tokyo opening note is corrected by curated source');
      const nagoya=full.hotels.find(h=>h.name_ja==='コンラッド名古屋');
      line(nagoya?.quality==='needs_review'&&nagoya?.verifications?.status?.status==='conflicting','Conrad Nagoya source conflict remains explicit');

      const hiltonTokyo=full.hotels.find(h=>h.name_ja==='ヒルトン東京');
      line(hiltonTokyo?.name_en==='Hilton Tokyo'&&hiltonTokyo?.city==='新宿区','Hilton Tokyo receives official identity/location patch');
      line(hiltonTokyo?.child?.max_age===5&&hiltonTokyo?.verifications?.['child.raw']?.status==='verified','Hilton Tokyo bed-sharing policy is curated from official policy');
      line(hiltonTokyo?.facilities?.parking?.raw==='1泊1,500円','Hilton Tokyo parking is updated from official hotel info');
      line(hiltonTokyo?.verifications?.['facilities.onsen']?.status==='conflicting','Hilton Tokyo legacy onsen value is flagged for review');

      const tokyoBay=full.hotels.find(h=>h.name_ja==='ヒルトン東京ベイ');
      line(tokyoBay?.name_en==='Hilton Tokyo Bay'&&tokyoBay?.city==='浦安市','Hilton Tokyo Bay receives official identity/location patch');
      line(tokyoBay?.verifications?.['families.booking_age']?.status==='verified','Hilton Tokyo Bay booking age classification is stored separately from bed-sharing policy');
      line(tokyoBay?.facilities?.parking?.raw.includes('3泊以上6,300円'),'Hilton Tokyo Bay parking schedule is curated');
      line(tokyoBay?.facilities?.pool?.raw.includes('室内プール（通年）'),'Hilton Tokyo Bay pool information is curated');

      const hiltonOsaka=full.hotels.find(h=>h.name_ja==='ヒルトン大阪');
      line(hiltonOsaka?.child?.max_age===11&&hiltonOsaka?.child?.rule_type==='age_under','Hilton Osaka bed-sharing policy is curated');
      line(hiltonOsaka?.facilities?.parking?.raw==='1泊7,200円','Hilton Osaka parking is curated');
      line(hiltonOsaka?.verifications?.['facilities.onsen']?.status==='conflicting','Hilton Osaka legacy onsen value is flagged for review');

      const conradTokyo=full.hotels.find(h=>h.name_ja==='コンラッド東京');
      line(conradTokyo?.name_en==='Conrad Tokyo'&&conradTokyo?.city==='港区','Conrad Tokyo receives official identity/location patch');
      line(conradTokyo?.facilities?.pool?.raw==='〇 25m室内プール','Conrad Tokyo pool information is curated');
      line(conradTokyo?.verifications?.['facilities.lounge']?.status==='verified','Conrad Tokyo Executive Lounge is verified');

      const odaiba=full.hotels.find(h=>h.name_ja==='ヒルトン東京お台場');
      line(odaiba?.name_en==='Hilton Tokyo Odaiba'&&odaiba?.city==='港区','Hilton Tokyo Odaiba receives official identity/location patch');
      line(odaiba?.facilities?.parking?.raw==='1泊2,000円','Hilton Tokyo Odaiba parking is curated');
      line(odaiba?.verifications?.['families.booking_age']?.status==='verified','Hilton Tokyo Odaiba booking age classification is stored separately');
      line(odaiba?.verifications?.['facilities.pool']?.status==='verified','Hilton Tokyo Odaiba pool is verified');

      const ariake=full.hotels.find(h=>h.name_ja==='ダブルツリーbyヒルトン東京有明');
      line(ariake?.name_en==='DoubleTree by Hilton Tokyo Ariake'&&ariake?.city==='江東区','DoubleTree Tokyo Ariake receives official identity/location patch');
      line(ariake?.child?.max_age===11&&ariake?.child?.rule_type==='age_under','DoubleTree Tokyo Ariake bed-sharing policy is curated');
      line(ariake?.facilities?.breakfast?.raw.includes('0〜5歳無料'),'DoubleTree Tokyo Ariake child breakfast policy is curated');
      line(ariake?.facilities?.parking?.raw==='× 駐車場なし','DoubleTree Tokyo Ariake parking availability is curated');

      const odawara=full.hotels.find(h=>h.name_ja==='ヒルトン小田原リゾート＆スパ');
      line(odawara?.name_en==='Hilton Odawara Resort & Spa'&&odawara?.city==='小田原市','Hilton Odawara receives official identity/location patch');
      line(odawara?.child?.max_age===5&&odawara?.child?.rule_type==='age_under','Hilton Odawara bed-sharing policy is curated');
      line(odawara?.facilities?.onsen?.available===true&&odawara?.verifications?.['facilities.onsen']?.status==='verified','Hilton Odawara hot spring is explicitly verified');
      line(odawara?.facilities?.parking?.raw==='〇 無料','Hilton Odawara complimentary parking is curated');
      line(odawara?.verifications?.['facilities.lounge']?.status==='conflicting','Hilton Odawara legacy lounge value is flagged for review');

      const hiltonNagoya=full.hotels.find(h=>h.name_ja==='ヒルトン名古屋');
      line(hiltonNagoya?.name_en==='Hilton Nagoya'&&hiltonNagoya?.city==='名古屋市','Hilton Nagoya receives official identity/location patch');
      line(hiltonNagoya?.quality==='needs_review'&&hiltonNagoya?.verifications?.['child.raw']?.status==='conflicting','Hilton Nagoya child policy conflict remains explicit');
      line(hiltonNagoya?.facilities?.parking?.raw==='1泊3,000円','Hilton Nagoya parking is curated');
      line(hiltonNagoya?.verifications?.['facilities.lounge']?.status==='verified'&&hiltonNagoya?.verifications?.['facilities.breakfast']?.status==='verified','Hilton Nagoya lounge and breakfast fields are verified');

      const westinYokohama=full.hotels.find(h=>h.name_ja==='ウェスティンホテル横浜');
      line(westinYokohama?.name_en==='The Westin Yokohama'&&westinYokohama?.city==='横浜市','The Westin Yokohama receives official identity/location patch');
      line(westinYokohama?.facilities?.lounge?.available===true&&westinYokohama?.verifications?.['facilities.lounge']?.status==='verified','The Westin Yokohama Club Lounge is verified');
      line(westinYokohama?.facilities?.pool?.raw.includes('大人3,300円'),'The Westin Yokohama pool fee is curated');
      line(westinYokohama?.facilities?.parking?.raw.includes('6,000円/日'),'The Westin Yokohama parking is curated');

      const sheratonBay=full.hotels.find(h=>h.name_ja==='シェラトン・グランデ・トーキョーベイ・ホテル');
      line(sheratonBay?.name_en==='Sheraton Grande Tokyo Bay Hotel'&&sheratonBay?.city==='浦安市','Sheraton Grande Tokyo Bay receives official identity/location patch');
      line(sheratonBay?.facilities?.pool?.available===true&&sheratonBay?.verifications?.['facilities.pool']?.status==='verified','Sheraton Grande Tokyo Bay pool is verified');
      line(sheratonBay?.facilities?.parking?.raw.includes('1泊目3,100円'),'Sheraton Grande Tokyo Bay parking is curated');

      const fujiMarriott=full.hotels.find(h=>h.name_ja==='富士マリオット・ホテル山中湖');
      line(fujiMarriott?.name_en==='Fuji Marriott Hotel Lake Yamanaka'&&fujiMarriott?.city==='南都留郡山中湖村','Fuji Marriott Lake Yamanaka receives official identity/location patch');
      line(fujiMarriott?.facilities?.onsen?.available===true&&fujiMarriott?.verifications?.['facilities.onsen']?.status==='verified','Fuji Marriott Lake Yamanaka hot spring is verified');
      line(fujiMarriott?.facilities?.parking?.raw==='〇 無料','Fuji Marriott Lake Yamanaka parking is curated');

      const courtyardHakuba=full.hotels.find(h=>h.name_ja==='コートヤード・バイ・マリオット白馬');
      line(courtyardHakuba?.name_en==='Courtyard by Marriott Hakuba'&&courtyardHakuba?.city==='白馬村','Courtyard Hakuba receives official identity/location patch');
      line(courtyardHakuba?.facilities?.onsen?.raw==='〇 白馬姫川温泉'&&courtyardHakuba?.verifications?.['facilities.onsen']?.status==='verified','Courtyard Hakuba hot spring is verified');
      line(courtyardHakuba?.facilities?.parking?.raw==='〇 無料','Courtyard Hakuba parking is curated');

      const health=StayAtlas.health(full);line(health.total===full.hotels.length,'health total matches hotel count');
      line(health.fieldVerified>50,'health reports expanded verified field coverage');
      line(health.fieldConflicting>=7,'health reports explicit conflicting fields');
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
