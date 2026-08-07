(function(){
  const db=StayAtlas.load();
  const state={region:'',search:'',chain:'',prefecture:'',capacity:'',facility:'',sort:'prefecture',view:'table'};
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const collator=new Intl.Collator('ja');
  const fmt=v=>v===null||v===undefined||v===''?'—':v;
  const yesNo=v=>v===true?'あり':v===false?'なし':'—';
  function unique(key){return [...new Set(db.hotels.map(h=>h[key]).filter(Boolean))].sort(collator.compare);}
  function populate(){
    unique('chain').forEach(v=>$('#chainFilter').insertAdjacentHTML('beforeend',`<option>${escapeHtml(v)}</option>`));
    unique('prefecture').forEach(v=>$('#prefectureFilter').insertAdjacentHTML('beforeend',`<option>${escapeHtml(v)}</option>`));
  }
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function filtered(){
    let rows=db.hotels.filter(h=>{
      const hay=[h.name_ja,h.name_en,h.prefecture,h.chain,h.brand].join(' ').toLowerCase();
      if(state.region&&h.region!==state.region)return false;
      if(state.search&&!hay.includes(state.search.toLowerCase()))return false;
      if(state.chain&&h.chain!==state.chain)return false;
      if(state.prefecture&&h.prefecture!==state.prefecture)return false;
      if(state.capacity&&(!h.capacity?.value||h.capacity.value<Number(state.capacity)))return false;
      if(state.facility){const f=h.facilities||{};if(state.facility==='breakfast'&&!f.breakfast?.has_info)return false;if(state.facility==='parking'&&!f.parking?.has_info)return false;if(['lounge','onsen','pool'].includes(state.facility)&&f[state.facility]?.available!==true)return false;}
      return true;
    });
    rows.sort((a,b)=>{
      if(state.sort==='name')return collator.compare(a.name_ja,b.name_ja);
      if(state.sort==='capacity_desc')return (b.capacity?.value||0)-(a.capacity?.value||0)||collator.compare(a.name_ja,b.name_ja);
      if(state.sort==='verified_desc')return String(b.source?.last_checked||'').localeCompare(String(a.source?.last_checked||''));
      return collator.compare(a.prefecture,b.prefecture)||collator.compare(a.name_ja,b.name_ja);
    });
    return rows;
  }
  function qualityLabel(q){return q==='verified'?'確認済':q==='needs_review'?'要確認':'未検証';}
  function tableRow(h){return `<tr><td><button class="hotel-name-button" data-hotel="${escapeHtml(h.id)}"><strong>${escapeHtml(h.name_ja||'名称未登録')}</strong><span>${escapeHtml(h.name_en||'English name pending')}</span></button></td><td>${escapeHtml(h.prefecture||'—')}<br><span class="muted">${escapeHtml(h.chain||'—')}</span></td><td>${escapeHtml(h.child?.raw||'—')}</td><td>${escapeHtml(h.capacity?.raw||'—')}</td><td>${escapeHtml(h.facilities?.lounge?.raw||'—')}</td><td>${escapeHtml(h.facilities?.breakfast?.raw||'—')}</td><td>${escapeHtml(h.facilities?.onsen?.raw||'—')}</td><td>${escapeHtml(h.facilities?.pool?.raw||'—')}</td><td>${escapeHtml(h.facilities?.parking?.raw||'—')}</td><td><span class="pill quality-${escapeHtml(h.quality)}">${qualityLabel(h.quality)}</span><br><span class="muted">${escapeHtml(h.source?.last_checked||'日付未確認')}</span></td></tr>`;}
  function card(h){return `<article class="hotel-card" tabindex="0" role="button" data-hotel="${escapeHtml(h.id)}"><span class="pill">${escapeHtml(h.prefecture||'未設定')} / ${escapeHtml(h.brand||h.chain||'')}</span><h3>${escapeHtml(h.name_ja||'名称未登録')}</h3><p class="en">${escapeHtml(h.name_en||'English name pending')}</p><div class="card-facts"><div><small>添寝</small><strong>${escapeHtml(h.child?.raw||'—')}</strong></div><div><small>定員</small><strong>${escapeHtml(h.capacity?.raw||'—')}</strong></div><div><small>ラウンジ</small><strong>${yesNo(h.facilities?.lounge?.available)}</strong></div><div><small>プール</small><strong>${yesNo(h.facilities?.pool?.available)}</strong></div></div></article>`;}
  function render(){
    const rows=filtered();$('#resultCount').textContent=rows.length;$('#hotelTableBody').innerHTML=rows.map(tableRow).join('');$('#cardView').innerHTML=rows.map(card).join('');$('#selectedRegionLabel').textContent=state.region||'全国';$('#selectedRegionCount').textContent=`${rows.length} hotels`;
    $('#hotelCount').textContent=db.hotels.length;$('#prefectureCount').textContent=new Set(db.hotels.map(h=>h.prefecture).filter(Boolean)).size;
    bindOpen();
  }
  function bindOpen(){$$('[data-hotel]').forEach(el=>{el.addEventListener('click',()=>openHotel(el.dataset.hotel));el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&el.classList.contains('hotel-card')){e.preventDefault();openHotel(el.dataset.hotel);}});});}
  function detailItem(label,value){return `<div class="detail-item"><small>${escapeHtml(label)}</small><div>${escapeHtml(fmt(value))}</div></div>`;}
  function openHotel(id){const h=db.hotels.find(x=>x.id===id);if(!h)return;const src=h.source||{};$('#hotelDialogContent').innerHTML=`<div class="dialog-inner"><p class="eyebrow">${escapeHtml(h.chain||'HOTEL')}</p><h2>${escapeHtml(h.name_ja||'名称未登録')}</h2><p class="dialog-en">${escapeHtml(h.name_en||'English name pending')}</p><div class="detail-grid">${detailItem('エリア',`${h.region||'—'} / ${h.prefecture||'—'}${h.city?' / '+h.city:''}`)}${detailItem('添寝',h.child?.raw)}${detailItem('ポイント・宿泊条件',h.award?.raw)}${detailItem('スタンダードルーム定員',h.capacity?.raw)}${detailItem('ラウンジ',h.facilities?.lounge?.raw)}${detailItem('朝食',h.facilities?.breakfast?.raw)}${detailItem('温泉',h.facilities?.onsen?.raw)}${detailItem('プール',h.facilities?.pool?.raw)}${detailItem('駐車場',h.facilities?.parking?.raw)}${detailItem('確認状態',qualityLabel(h.quality))}</div><div class="source-box"><strong>Source</strong><p>${escapeHtml(src.label||'Source未登録')}<br>最終確認: ${escapeHtml(src.last_checked||'未確認')}</p>${src.url?`<a href="${escapeHtml(src.url)}" target="_blank" rel="noopener noreferrer">Sourceを開く ↗</a>`:''}</div></div>`;$('#hotelDialog').showModal();}
  function setRegion(region){state.region=region;$$('.region').forEach(r=>r.classList.toggle('is-active',r.dataset.region===region));render();}
  populate();render();
  $('#searchInput').addEventListener('input',e=>{state.search=e.target.value;render();});$('#chainFilter').addEventListener('change',e=>{state.chain=e.target.value;render();});$('#prefectureFilter').addEventListener('change',e=>{state.prefecture=e.target.value;render();});$('#capacityFilter').addEventListener('change',e=>{state.capacity=e.target.value;render();});$('#facilityFilter').addEventListener('change',e=>{state.facility=e.target.value;render();});$('#sortSelect').addEventListener('change',e=>{state.sort=e.target.value;render();});
  $$('.region').forEach(r=>{r.addEventListener('click',()=>setRegion(r.dataset.region));r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setRegion(r.dataset.region);}});});$('#clearRegion').addEventListener('click',()=>setRegion(''));
  $$('.view-switch button').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;$$('.view-switch button').forEach(x=>x.classList.toggle('is-active',x===btn));$('#tableView').classList.toggle('is-hidden',state.view!=='table');$('#cardView').classList.toggle('is-hidden',state.view!=='cards');}));
  $('.dialog-close').addEventListener('click',()=>$('#hotelDialog').close());$('#hotelDialog').addEventListener('click',e=>{if(e.target===$('#hotelDialog'))$('#hotelDialog').close();});$('#year').textContent=new Date().getFullYear();
})();