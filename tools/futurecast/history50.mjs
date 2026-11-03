// HISTORY 50+: the unsealed, unscored editorial edition (futurecast/high-conviction/forecasts.json).
// It is rendered beside, never into, the hash-chained ledger: nothing here touches ledgers, receipts or Brier scores.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export const HISTORY50_SOURCE='futurecast/high-conviction/forecasts.json';
const OPINION=new Set(['direct_majority_skeptical','no_majority_skepticism','unmeasured']);
const esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const text=(v,max=1600)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const httpsUrl=u=>{if(typeof u!=='string'||u.length>800||/["'<>\s]/.test(u))return false;try{const x=new URL(u);return x.protocol==='https:'&&!!x.hostname&&!x.username&&!x.password&&!x.hash;}catch{return false;}};
const fail=m=>{throw Error('HISTORY 50+: '+m);};
const validDate=s=>{if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const [y,m,d]=s.split('-').map(Number);const dt=new Date(Date.UTC(y,m-1,d));return y>=2000&&dt.getUTCFullYear()===y&&dt.getUTCMonth()+1===m&&dt.getUTCDate()===d;};

export function validateHistory50(d){
 if(d?.schema_version!==1||d.kind!=='editorial_scenario_edition')fail('schema');
 // The edition must stay visibly separate from the sealed, scored ledger.
 if(d.sealed!==false||d.scored!==false||d.calibration!=='uncalibrated_subjective_editorial')fail('must be unsealed, unscored and uncalibrated');
 if(!validDate(d.as_of))fail('as_of');
 for(const k of ['edition','edition_ja','estimator_ja','estimate_note_ja'])if(!text(d[k]))fail(k);
 if(!Array.isArray(d.method)||d.method.length<3||!d.method.every(m=>text(m.title,80)&&text(m.body)))fail('method');
 if(!Array.isArray(d.limits)||!d.limits.length||!d.limits.every(x=>text(x,300)))fail('limits');
 if(!Array.isArray(d.forecasts)||d.forecasts.length<1||d.forecasts.length>8)fail('forecast count');
 const ids=new Set();
 d.forecasts.forEach((f,i)=>{
  const at=`forecast ${f?.id}`;
  if(!/^[a-z][a-z0-9-]{3,60}$/.test(f.id)||ids.has(f.id))fail(at+' id');ids.add(f.id);
  if(f.number!==String(i+1).padStart(2,'0'))fail(at+' number');
  for(const k of ['domain','title','short','deadline_label','probability_basis_ja'])if(!text(f[k],k==='probability_basis_ja'?600:80))fail(at+' '+k);
  // ">50%" is the edition's premise: an item that falls to 50% or below must be removed, not shown.
  if(!Number.isInteger(f.probability)||f.probability<=50||f.probability>95)fail(at+' probability must be an integer in 51..95');
  if(!validDate(f.deadline)||f.deadline<=d.as_of)fail(at+' deadline');
  if(!Array.isArray(f.sources)||!f.sources.length||f.sources.length>5)fail(at+' sources');
  for(const s of f.sources)if(!text(s.label,200)||!text(s.publisher,120)||!text(s.date,20)||!httpsUrl(s.url))fail(at+' source');
  const ref=n=>Number.isInteger(n)&&n>=0&&n<f.sources.length;
  if(!Array.isArray(f.evidence)||f.evidence.length<1||f.evidence.length>4)fail(at+' evidence');
  for(const e of f.evidence)if(!text(e.label,40)||!text(e.value,20)||!text(e.detail,400)||!ref(e.source))fail(at+' evidence item');
  for(const k of ['counter','changes','unverified'])if(!Array.isArray(f[k])||!f[k].length||!f[k].every(x=>text(x,600)))fail(at+' '+k);
  const r=f.resolution;
  if(!r||!text(r.yes)||!text(r.no,600)||!text(r.ambiguity)||!Array.isArray(r.sources)||!r.sources.length||!r.sources.every(ref))fail(at+' resolution');
  const o=f.opinion;
  if(!o||!OPINION.has(o.status)||!text(o.label,60)||!text(o.text,600)||!text(o.confidence,10)||!text(o.confidence_reason,200))fail(at+' opinion');
 });
 return d;
}

export const loadHistory50=root=>validateHistory50(JSON.parse(readFileSync(join(root,HISTORY50_SOURCE),'utf8')));

const ext=(url,label,cls='')=>`<a${cls?` class="${cls}"`:''} href="${esc(url)}" target="_blank" rel="noopener noreferrer">${label} <span aria-hidden="true">↗</span><span class="sr-only">（新しいタブ）</span></a>`;
// Decorative 0–100 track with a fixed 50% tick: shows the margin above even odds. The number is always printed as text.
// SVG attributes, not style="", because the FUTURECAST CSP (default-src 'self') blocks inline styles.
const meter=p=>`<svg class="fc-meter" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true" focusable="false"><rect class="fc-meter-track" width="100" height="8"/><rect class="fc-meter-fill" width="${p}" height="8"/><rect class="fc-meter-half" x="49.5" y="0" width="1" height="8"/></svg>`;
const directs=d=>d.forecasts.filter(f=>f.opinion.status==='direct_majority_skeptical');

// Homepage front: the edition's numbered headlines, each with probability, deadline and primary source.
export function history50Front(d){
 const items=d.forecasts.map(f=>{const s=f.sources[f.evidence[0].source];const direct=f.opinion.status==='direct_majority_skeptical';
  return `<li class="fc-hl${direct?' is-contrarian':''}"><span class="fc-hl-no" aria-hidden="true">${esc(f.number)}</span><div class="fc-hl-body"><p class="fc-hl-domain">${esc(f.domain)}${direct?' <span class="fc-hl-flag">世論の過半数は懐疑的</span>':''}</p><h2 class="fc-hl-title"><a href="/futurecast/high-conviction/#${esc(f.id)}"><span class="sr-only">${esc(f.number)}. </span>${esc(f.title)}</a></h2><p class="fc-hl-meta"><span>判定期限 <time datetime="${esc(f.deadline)}">${esc(f.deadline_label)}</time></span><span>根拠 ${f.evidence.slice(0,2).map(e=>`${esc(e.label)} ${esc(e.value)}`).join(' / ')}</span></p><p class="fc-hl-source">${ext(s.url,`出典：${esc(s.publisher)}`)}</p></div><p class="fc-hl-prob"><span class="fc-hl-pct"><strong>${f.probability}</strong>%</span><span class="fc-hl-label">編集推定</span>${meter(f.probability)}</p></li>`;}).join('');
 return `<section class="fc-front" aria-labelledby="fc-title"><div class="fc-front-head"><p class="fc-kicker">FUTURECAST / ${esc(d.edition)} / <time datetime="${esc(d.as_of)}">${esc(d.as_of)}</time> 編集号</p><h1 id="fc-title">人類史が動く、<br>${d.forecasts.length}つの未来。</h1><div class="fc-front-copy"><p class="fc-lead">AIの科学と数学、AIの統治、電力、手術ロボット。公開データを読み、NAOJUN STUDIOS編集部とAIが「起きる方が有力」、つまり50%超と見積もった出来事です。</p><p class="fc-caveat"><strong>数字は主観的な編集推定です。</strong>実現頻度の観測値でも、誤差を測った統計モデルの出力でもありません。封印・採点の対象外です。<a href="/futurecast/high-conviction/#why">なぜ50％超と言えるのか →</a></p></div></div><ol class="fc-headlines" aria-label="${esc(d.edition)}：50%超と見積もった${d.forecasts.length}件">${items}</ol><a class="fc-front-cta" href="/futurecast/high-conviction/">${d.forecasts.length}件の根拠・判定条件・反証をすべて読む <span aria-hidden="true">→</span></a></section>`;
}

// The stricter DATA DISAGREES result, labelled so its zero is never read as the total of FUTURECAST.
export function strictGateNote(d,dd){
 return `<section class="fc-strict" aria-labelledby="fc-strict-title"><p class="fc-strict-count" aria-hidden="true">${esc(dd.qualified_count)}</p><div><p class="fc-kicker">DATA DISAGREES / より厳しい別基準</p><h2 id="fc-strict-title">世論と確率の逆転を立証した予測は、採択${esc(dd.qualified_count)}件</h2><p>「同じ問いで代表性ある調査の過半数が起きないと答え、かつ誤差を測った数値モデルで50%超」という別の採択基準では、今も0件です。上の${d.forecasts.length}件はこの基準の採択ではありません。${directs(d).length?`世論との逆を同じ論点の調査で直接確認できたのは${directs(d).length}件（${directs(d).map(f=>esc(f.number)).join('・')}）だけです。`:'世論との逆を同じ論点の調査で直接確認できた項目はありません。'}</p><a href="/futurecast/data-disagrees/">DATA DISAGREESの調査候補を見る <span aria-hidden="true">→</span></a></div></section>`;
}

const list=(xs,cls)=>`<ul class="${cls}">${xs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`;
function dossierItem(f){
 const srcs=f.sources;
 const evidence=f.evidence.map(e=>`<li><strong class="fc-ev-value">${esc(e.value)}</strong><span class="fc-ev-label">${esc(e.label)}</span><p>${esc(e.detail)}　${ext(srcs[e.source].url,esc(srcs[e.source].publisher))}</p></li>`).join('');
 const rsrc=f.resolution.sources.map(i=>ext(srcs[i].url,esc(srcs[i].label))).join('、');
 return `<article class="fc-dossier" id="${esc(f.id)}" aria-labelledby="${esc(f.id)}-title"><header class="fc-dossier-head"><p class="fc-dossier-no" aria-hidden="true">${esc(f.number)}</p><div><p class="fc-dossier-domain">${esc(f.domain)} · 判定期限 <time datetime="${esc(f.deadline)}">${esc(f.deadline_label)}</time></p><h2 id="${esc(f.id)}-title"><span class="sr-only">${esc(f.number)}. </span>${esc(f.title)}</h2></div><p class="fc-dossier-prob"><span class="fc-hl-pct"><strong>${f.probability}</strong>%</span><span class="fc-hl-label">編集推定・未校正</span>${meter(f.probability)}</p></header>`
 +`<p class="fc-dossier-basis"><strong>この数字の出し方：</strong>${esc(f.probability_basis_ja)}</p>`
 +`<div class="fc-dossier-grid"><section class="fc-dossier-block fc-resolution"><h3>YES / NO の判定</h3><dl><dt>YES</dt><dd>${esc(f.resolution.yes)}</dd><dt>NO</dt><dd>${esc(f.resolution.no)}</dd><dt>曖昧さと例外</dt><dd>${esc(f.resolution.ambiguity)}</dd><dt>判定資料</dt><dd>${rsrc}</dd></dl></section>`
 +`<section class="fc-dossier-block"><h3>50%超の根拠（数値）</h3><ul class="fc-evidence">${evidence}</ul></section>`
 +`<section class="fc-dossier-block"><h3>反対の材料</h3>${list(f.counter,'fc-bullets')}</section>`
 +`<section class="fc-dossier-block fc-opinion is-${esc(f.opinion.status)}"><h3>世論との比較</h3><p class="fc-opinion-label">${esc(f.opinion.label)}</p><p>${esc(f.opinion.text)}</p><p class="fc-opinion-conf">比較の確からしさ：<strong>${esc(f.opinion.confidence)}</strong>（${esc(f.opinion.confidence_reason)}）</p></section>`
 +`<section class="fc-dossier-block"><h3>推定を変える条件</h3>${list(f.changes,'fc-bullets')}</section>`
 +`<section class="fc-dossier-block"><h3>まだ確認できていないこと</h3>${list(f.unverified,'fc-bullets')}</section></div>`
 +`<section class="fc-dossier-sources"><h3>一次資料・参照先</h3><ul>${srcs.map(s=>`<li>${ext(s.url,esc(s.label))} <span>${esc(s.publisher)} / ${esc(s.date)}</span></li>`).join('')}</ul></section></article>`;
}

// Full dossier page /futurecast/high-conviction/ (body only; fc.mjs wraps it in the shared page chrome).
export function history50Dossier(d,dd){
 const toc=d.forecasts.map(f=>`<li><a href="#${esc(f.id)}"><span class="fc-toc-no">${esc(f.number)}</span><span class="fc-toc-title">${esc(f.short)}</span><span class="fc-toc-prob">${f.probability}%</span><span class="fc-toc-due">${esc(f.deadline_label)}</span></a></li>`).join('');
 const method=d.method.map((m,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span><div><h3>${esc(m.title)}</h3><p>${esc(m.body)}</p></div></li>`).join('');
 return `<section class="fc-dossier-cover" aria-labelledby="hc-title"><p class="fc-kicker">FUTURECAST / ${esc(d.edition)} / <time datetime="${esc(d.as_of)}">${esc(d.as_of)}</time> 編集号</p><h1 id="hc-title">${esc(d.edition_ja)}。</h1><p class="fc-lead">${d.forecasts.length}件それぞれの判定条件、50%超と見た根拠の数字、反対の材料、世論との比較、まだ確認できていないことを一枚にまとめました。</p><ul class="fc-badges" aria-label="この編集号の性格"><li>主観的な編集推定</li><li>未校正</li><li>封印なし</li><li>成績の採点対象外</li></ul><p class="fc-cover-note">${esc(d.estimator_ja)}。${esc(d.estimate_note_ja)}</p><nav class="fc-toc" aria-label="${d.forecasts.length}件の予測"><ol>${toc}</ol></nav></section>`
 +`<section class="fc-why" id="why" aria-labelledby="why-title"><div class="fc-why-head"><p class="fc-kicker">METHOD / 読み方</p><h2 id="why-title">なぜ50％超と言えるのか</h2><p>答えは「言い切れない」です。そのうえで、どの数字を出発点に、何を割り引いて50%超と判断したかを示します。</p></div><ol class="fc-why-list">${method}</ol><div class="fc-limits"><h3>この編集号の限界</h3>${list(d.limits,'fc-bullets')}</div></section>`
 +`<div class="fc-dossiers">${d.forecasts.map(dossierItem).join('')}</div>`
 +`<section class="fc-relations" aria-labelledby="rel-title"><h2 id="rel-title">ほかの記録との関係</h2><ul><li><strong>封印済みの予測台帳（3件）</strong><span>ハッシュ連鎖で固定し、判定後にBrierスコアで採点します。この編集号の数字は含みません。</span><a href="/futurecast/#fc-ledger-title">台帳を見る →</a></li><li><strong>DATA DISAGREES（採択${esc(dd.qualified_count)}件）</strong><span>世論と確率の逆転を同じ問いで立証する、より厳しい基準です。</span><a href="/futurecast/data-disagrees/">調査候補を見る →</a></li><li><strong>低確率の文明シナリオ研究</strong><span>1〜8%の旧ERA SHIFTSは研究アーカイブとして残しています。</span><a href="/futurecast/era-shifts/">研究アーカイブを見る →</a></li><li><strong>成績と方法論</strong><span>採点の対象と方法、この編集号との違い。</span><a href="/futurecast/methodology/#history50-method">方法論を見る →</a></li></ul><p class="fc-disclaimer">投資・医療・政策の判断を勧めるものではありません。数字の誤りや新しい資料は<a href="/contact/">お問い合わせ</a>からお知らせください。</p></section>`;
}
