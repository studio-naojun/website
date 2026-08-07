(async function(){
  const db=await StayAtlas.bootstrapLegacy();
  const state={region:'',search:'',chain:'',prefecture:'',capacity:'',facility:'',quality:'',status:'',child12:false,sort:'prefecture',view:'table'};
  const $=s=>document.querySelector(s);
  const $$=s=>[...document.querySelectorAll(s)];
  const collator=new Intl.Collator('ja');
  const fmt=v=>v===null||v===undefined||v===''?'—':v;
  const yesNo=v=>v===true?'あり':v===false?'なし':'—';
  function escapeHtml(s){return String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function safeUrl(value){try{const u=new URL(value,location.href);return /^https?:$/.test(u.protocol)?u.href:'';}catch(e){return'';}}
  function unique(key){return [...new Set(db.hotels.map(h=>h[key]).filter(Boolean))].sort(collator.compare);}
  function populate(){
    unique('chain').forEach(v=>$('#chainFilter').insertAdjacentHTML('beforeend',`<option>${escapeHtml(v)}</option>`));
    unique('prefecture').forEach(v=>$('#prefectureFilter').insertAdjacentHTML('beforeend',`<option>${escapeHtml(v)}</option>`));
  }
  function supportsChild12(h){if(h.child?.rule_type==='age')return Number(h.child.max_age)>=12;if(h.child?.raw&&/17歳まで|13歳まで|12歳まで/.test(h.child.raw))return true;return false;}
  function filtered(){
    let rows=db.hotels.filter(h=>{
      const hay=[h.name_ja,h.name_en,h.prefecture,h.city,h.chain,h.brand,h.portfolio].join(' ').toLowerCase();
      if(state.region&&h.region!==state.region)return false;
      if(state.search&&!hay.includes(state.search.toLowerCase()))return false;
      if(state.chain&&h.chain!==state.chain)return false;
      if(state.prefecture&&h.prefecture!==state.prefecture)return false;
      if(state.capacity&&(!h.capacity?.value||h.capacity.value<Number(state.capacity)))return false;
      if(state.quality&&h.quality!==state.quality)return false;
      if(state.status&&h.status!==state.status)return false;
      if(state.child12&&!supportsChild12(h))return false;
      if(state.facility){const f=h.facilities||{};if(state.facility==='breakfast'&&!f.breakfast?.has_info)return false;if(state.facility==='parking'&&!f.parking?.has_info)return false;if(['lounge','onsen','pool'].includes(state.facility)&&f[state.facility]?.available!==true)return false;}
      return true;
    });
    rows.sort((a,b)=>{
      if(state.sort==='name')return collator.compare(a.name_ja,b.name_ja);
      if(state.sort==='capacity_desc')return (b.capacity?.value||0)-(a.capacity?.value||0)||collator.compare(a.name_ja,b.name_ja);
      if(state.sort==='verified_desc')return latestVerification(b).localeCompare(latestVerification(a))||collator.compare(a.name_ja,b.name_ja);
      return collator.compare(a.prefecture,b.prefecture)||collator.compare(a.name_ja,b.name_ja);
    });
    return rows;
  }
  function latestVerification(h){const dates=Object.values(h.verifications||{}).map(v=>v.checked_at||'').filter(Boolean);return dates.sort().at(-1)||h.source?.last_checked||'';}
  function qualityLabel(q){return q==='verified'?'確認済':q==='needs_review'?'要確認':q==='missing'?'不足':q==='conflicting'?'競合':'未検証';}
  function statusLabel(s){return s==='planned'?'開業予定':s==='closed'?'終了':s==='hidden'?'非公開':'営業中';}
  function checkLabel(s){return s==='verified'?'確認済':s==='conflicting'?'競合':s==='needs_review'?'要確認':'未検証';}
  function tableRow(h){const checked=latestVerification(h);return `<tr><td><button class="hotel-name-button" data-hotel="${escapeHtml(h.id)}"><strong>${escapeHtml(h.name_ja||'名称未登録')}</strong><span>${escapeHtml(h.name_en||'English name pending')}</span></button></td><td>${escapeHtml(h.prefecture||'—')}<br><span class="muted">${escapeHtml(h.chain||'—')}</span></td><td>${escapeHtml(h.child?.raw||'—')}</td><td>${escapeHtml(h.capacity?.raw||'—')}</td><td>${escapeHtml(h.facilities?.lounge?.raw||'—')}</td><td>${escapeHtml(h.facilities?.breakfast?.raw||'—')}</td><td>${escapeHtml(h.facilities?.onsen?.raw||'—')}</td><td>${escapeHtml(h.facilities?.pool?.raw||'—')}</td><td>${escapeHtml(h.facilities?.parking?.raw||'—')}</td><td><span class="pill quality-${escapeHtml(h.quality)}">${qualityLabel(h.quality)}</span><br><span class="muted">${escapeHtml(checked||'日付未確認')}</span></td></tr>`;}
  function card(h){const verified=Object.values(h.verifications||{}).filter(v=>v.status==='verified').length;return `<article class="hotel-card" tabindex="0" role="button" data-hotel="${escapeHtml(h.id)}"><span class="pill">${escapeHtml(h.prefecture||'未設定')} / ${escapeHtml(h.brand||h.chain||'')}</span><h3>${escapeHtml(h.name_ja||'名称未登録')}</h3><p class="en">${escapeHtml(h.name_en||'English name pending')}</p>${verified?`<p class="verified-line">公式確認 ${verified}項目</p>`:''}<div class="card-facts"><div><small>添寝</small><strong>${escapeHtml(h.child?.raw||'—')}</strong></div><div><small>定員</small><strong>${escapeHtml(h.capacity?.raw||'—')}</strong></div><div><small>ラウンジ</small><strong>${yesNo(h.facilities?.lounge?.available)}</strong></div><div><small>プール</small><strong>${yesNo(h.facilities?.pool?.available)}</strong></div></div></article>`;}
  function updateMapCounts(){const counts={};db.hotels.forEach(h=>{if(h.region)counts[h.region]=(counts[h.region]||0)+1;});$$('[data-count-region]').forEach(el=>{el.textContent=counts[el.dataset.countRegion]||0;});$$('.region').forEach(el=>{const r=el.dataset.region;el.setAttribute('aria-label',`${r} ${counts[r]||0}件`);});}
  function render(){
    const rows=filtered();$('#resultCount').textContent=rows.length;$('#hotelTableBody').innerHTML=rows.map(tableRow).join('');$('#cardView').innerHTML=rows.map(card).join('');$('#selectedRegionLabel').textContent=state.region||'全国';$('#selectedRegionCount').textContent=`${rows.length} hotels`;
    $('#hotelCount').textContent=db.hotels.length;$('#prefectureCount').textContent=new Set(db.hotels.map(h=>h.prefecture).filter(Boolean)).size;
    const health=StayAtlas.health(db);$('#reviewCount').textContent=health.quality.needs_review||0;bindOpen();
  }
  function bindOpen(){$$('[data-hotel]').forEach(el=>{el.addEventListener('click',()=>openHotel(el.dataset.hotel));el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&el.classList.contains('hotel-card')){e.preventDefault();openHotel(el.dataset.hotel);}});});}
  function detailItem(label,value){return `<div class="detail-item"><small>${escapeHtml(label)}</small><div>${escapeHtml(fmt(value))}</div></div>`;}
  function verificationHtml(h){const checks=Object.values(h.verifications||{});if(!checks.length)return '<p class="muted">公式Sourceによる項目確認はまだありません。</p>';return `<div class="verification-list">${checks.map(v=>{const url=safeUrl(v.source_url);return `<div class="verification-item"><span class="pill ${v.status==='verified'?'quality-verified':v.status==='conflicting'?'quality-needs_review':''}">${escapeHtml(checkLabel(v.status))}</span><div><strong>${escapeHtml(v.label||'項目')}</strong><small>${escapeHtml(v.checked_at||'日付未登録')}</small>${v.note?`<p>${escapeHtml(v.note)}</p>`:''}${url?`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(v.source_label||'公式Source')} ↗</a>`:''}</div></div>`;}).join('')}</div>`;}
  function openHotel(id){const h=db.hotels.find(x=>x.id===id);if(!h)return;const src=h.source||{};const srcUrl=safeUrl(src.url);const officialUrl=safeUrl(h.official_url);$('#hotelDialogContent').innerHTML=`<div class="dialog-inner"><p class="eyebrow">${escapeHtml(h.chain||'HOTEL')} / ${escapeHtml(statusLabel(h.status))}</p><h2>${escapeHtml(h.name_ja||'名称未登録')}</h2><p class="dialog-en">${escapeHtml(h.name_en||'English name pending')}</p><div class="detail-grid">${detailItem('エリア',`${h.region||'—'} / ${h.prefecture||'—'}${h.city?' / '+h.city:''}`)}${h.opening_note?detailItem('営業・開業メモ',h.opening_note):''}${detailItem('添寝',h.child?.raw)}${detailItem('ポイント・宿泊条件',h.award?.raw)}${detailItem('スタンダードルーム定員',h.capacity?.raw)}${detailItem('ラウンジ',h.facilities?.lounge?.raw)}${detailItem('朝食',h.facilities?.breakfast?.raw)}${detailItem('温泉',h.facilities?.onsen?.raw)}${detailItem('プール',h.facilities?.pool?.raw)}${detailItem('駐車場',h.facilities?.parking?.raw)}${detailItem('レコード状態',qualityLabel(h.quality))}</div><div class="source-box"><strong>Data provenance</strong><p>移行元: ${escapeHtml(src.label||'Source未登録')}<br>移行元の最終確認: ${escapeHtml(src.last_checked||'未確認')}</p>${srcUrl?`<a href="${escapeHtml(srcUrl)}" target="_blank" rel="noopener noreferrer">移行元を開く ↗</a>`:''}${officialUrl?`<br><a href="${escapeHtml(officialUrl)}" target="_blank" rel="noopener noreferrer">ホテル公式ページ ↗</a>`:''}<h3>公式確認</h3>${verificationHtml(h)}</div></div>`;$('#hotelDialog').showModal();}
  function setRegion(region){state.region=region;$$('.region').forEach(r=>r.classList.toggle('is-active',r.dataset.region===region));render();}
  function clearFilters(){state.region='';state.search='';state.chain='';state.prefecture='';state.capacity='';state.facility='';state.quality='';state.status='';state.child12=false;$('#searchInput').value='';$('#chainFilter').value='';$('#prefectureFilter').value='';$('#capacityFilter').value='';$('#facilityFilter').value='';$('#qualityFilter').value='';$('#statusFilter').value='';$('#child12Filter').checked=false;$$('.region').forEach(r=>r.classList.remove('is-active'));render();}
  populate();updateMapCounts();render();
  $('#searchInput').addEventListener('input',e=>{state.search=e.target.value;render();});$('#chainFilter').addEventListener('change',e=>{state.chain=e.target.value;render();});$('#prefectureFilter').addEventListener('change',e=>{state.prefecture=e.target.value;render();});$('#capacityFilter').addEventListener('change',e=>{state.capacity=e.target.value;render();});$('#facilityFilter').addEventListener('change',e=>{state.facility=e.target.value;render();});$('#qualityFilter').addEventListener('change',e=>{state.quality=e.target.value;render();});$('#statusFilter').addEventListener('change',e=>{state.status=e.target.value;render();});$('#child12Filter').addEventListener('change',e=>{state.child12=e.target.checked;render();});$('#sortSelect').addEventListener('change',e=>{state.sort=e.target.value;render();});
  $$('.region').forEach(r=>{r.addEventListener('click',()=>setRegion(r.dataset.region));r.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setRegion(r.dataset.region);}});});$('#clearRegion').addEventListener('click',()=>setRegion(''));$('#clearFilters').addEventListener('click',clearFilters);
  $$('.view-switch button').forEach(btn=>btn.addEventListener('click',()=>{state.view=btn.dataset.view;$$('.view-switch button').forEach(x=>x.classList.toggle('is-active',x===btn));$('#tableView').classList.toggle('is-hidden',state.view!=='table');$('#cardView').classList.toggle('is-hidden',state.view!=='cards');}));
  $('.dialog-close').addEventListener('click',()=>$('#hotelDialog').close());$('#hotelDialog').addEventListener('click',e=>{if(e.target===$('#hotelDialog'))$('#hotelDialog').close();});$('#year').textContent=new Date().getFullYear();
})();
