const HEADING_RE = /^(?:[■◆●▲▼◇□▪︎▶︎]|#{1,6}\s*|【.+】|(?:ポイント|前提|まとめ|要点|結論|設計上|セーフ|アウト|推奨|適用範囲|見送られた論点|ロードマップ|ここで終わりじゃない)\s*[①-⑳0-9０-９]*\s*[:：]?)/u;
const SUMMARY_RE = /^(?:まとめ|要点|結論|明日から|何をするか)/u;
const CORE_RE = /^(?:ポイント|前提|設計上)|(?:分水嶺|価値中立|事件性|用法)/u;
const PRACTICAL_RE = /^(?:セーフ|アウト|推奨|適用範囲|見送られた論点)/u;
const LOW_RE = /(?:出典|保存して|共有して|ロードマップ)/u;
const META_RE = /(?:今回いちばん|ここも見落と|強調して|読み飛ば|じゃあ全部|個人的には|書いておきます|逆にこちらが危ない側|ここを真っ黒)/u;

function normalizeMatch(value) { return String(value).normalize('NFKC').replace(/\s+/g, ' ').trim(); }
function cleanLayoutText(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}
function cleanHeading(line) { return line.replace(/^[■◆●▲▼◇□▪︎▶︎#\s]+/u, '').trim(); }
function meaningfulLines(text) { return cleanLayoutText(text).split(/\n+/u).map((line) => line.trim()).filter(Boolean); }
function isHeading(line) { const n=normalizeMatch(line); return HEADING_RE.test(line) || HEADING_RE.test(n) || (/^.{2,40}[：:]$/u.test(line) && !/[。！？!?]$/u.test(line)); }
function isTitleLike(line) { return /^【.+】/u.test(line) || (/^[^。！？!?]{10,160}$/u.test(line) && /(?:保存版|まとめ|ガイドライン|問題|解説)/u.test(normalizeMatch(line))); }

function coalesceLines(lines) {
  const out=[];
  for(let i=0;i<lines.length;i+=1){
    const line=lines[i];
    if (/^(?:提供する側なら|導入する側なら|共通して)$/u.test(line) && /^→/u.test(lines[i+1]||'')) {
      out.push(`${line}：${lines[i+1].replace(/^→\s*/u,'')}`); i+=1; continue;
    }
    if (/^→/u.test(line) && out.length && [...out[out.length-1]].length < 30) {
      out[out.length-1]=`${out[out.length-1]}：${line.replace(/^→\s*/u,'')}`; continue;
    }
    out.push(line);
  }
  return out;
}

function rawSentenceParts(lines) {
  const source=coalesceLines(lines);
  const parts=[];
  for(const line of source){
    if (/^(?:[・]|[①-⑳]|\d+[.)]|《)/u.test(line) || !/[。！？!?]/u.test(line)) { parts.push(line); continue; }
    const matches=line.match(/[^。！？!?]+[。！？!?]?/gu)||[];
    for(const m of matches){const v=m.trim();if(v)parts.push(v);}
  }
  return parts;
}

export function parseSections(text) {
  const lines=meaningfulLines(text);
  if(!lines.length) return {title:'',sections:[]};
  let cursor=0; let title='';
  if(isTitleLike(lines[0])) { title=lines[0]; cursor=1; }
  else title=lines[0];
  const sections=[]; let current={heading:'本文',body:[]};
  for(let i=cursor;i<lines.length;i+=1){
    const line=lines[i];
    if(isHeading(line)){
      if(current.body.length || current.heading!=='本文') sections.push({...current,body:coalesceLines(current.body)});
      current={heading:cleanHeading(line),body:[]};
    }else current.body.push(line);
  }
  if(current.body.length || current.heading!=='本文') sections.push({...current,body:coalesceLines(current.body)});
  if(!sections.length) sections.push({heading:'本文',body:coalesceLines(lines.slice(cursor))});
  return {title,sections};
}

function sectionScore(section,style){
  const heading=normalizeMatch(section.heading); const body=normalizeMatch(section.body.join(' ')); let score=0;
  if(SUMMARY_RE.test(heading)) score+=style==='gist'?14:10;
  if(CORE_RE.test(heading)) score+=style==='gist'?11:10;
  if(/分水嶺|価値中立/u.test(heading)) score+=4;
  if(/用法|運用/u.test(heading)) score+=4;
  if(/入力.*利用者|提供者は無関係/u.test(heading)) score+=2;
  if(PRACTICAL_RE.test(heading)) score+=style==='points'?9:7;
  if(/^前提/u.test(heading)) score+=8;
  if(/^本文$/u.test(heading)) score+=2;
  if(LOW_RE.test(heading)) score-=4;
  if(/価値中立|事件性|用法|運用の実態|提供者の行為|認識・認容|ガバナンス/u.test(body)) score+=4;
  if(/提供する側|導入する側|共通して|弁護士へ/u.test(body)) score+=5;
  return score;
}

function sentenceScore(sentence,section){
  const s=normalizeMatch(sentence); const h=normalizeMatch(section.heading); let score=0;
  const len=[...sentence].length;
  if(len>=20&&len<=180) score+=2; else if(len<10) score-=3;
  if(META_RE.test(s)) score-=6;
  if(/価値中立|事件性|用法|運用|設計|提供者|利用者|認識・認容|評価され|ガバナンス|弁護士/u.test(s)) score+=4;
  if(/したがって|つまり|終わらない|必要|べき|困難|評価され得る|明文化|整える|手を止め/u.test(s)) score+=3;
  if(/基準|分水嶺|考え方|運用の実態/u.test(s)) score+=4;
  if(/^ポイント1/u.test(h) && /提供者|利用者|ユーザー/u.test(s)) score+=4;
  if(/^ポイント2/u.test(h) && /価値中立|設計|作った時点|事件性/u.test(s)) score+=4;
  if(/^ポイント3/u.test(h) && /用法|運用|認識・認容|評価/u.test(s)) score+=4;
  if(SUMMARY_RE.test(h) && /提供する側|導入する側|共通して/u.test(s)) score+=6;
  return score;
}

function representativeSentences(section,style){
  const h=normalizeMatch(section.heading);
  if(SUMMARY_RE.test(h)){
    const actions=coalesceLines(section.body).filter((line)=>/^(?:提供する側なら|導入する側なら|共通して)/u.test(line));
    if(actions.length>=3) return actions.slice(0,3);
  }
  const sentences=rawSentenceParts(section.body).filter(Boolean);
  if(!sentences.length) return [];
  const ranked=sentences.map((sentence,index)=>({sentence,index,score:sentenceScore(sentence,section)})).sort((a,b)=>b.score-a.score||a.index-b.index);
  return ranked.slice(0,2).sort((a,b)=>a.index-b.index).map(({sentence})=>sentence);
}

function bestRepresentative(section){
  const parts=rawSentenceParts(section.body).filter(Boolean);
  const compactLines=coalesceLines(section.body).filter((line)=>[...line].length>=12 && [...line].length<=140 && /[。！？!?]/u.test(line));
  const candidates=[...parts,...compactLines].filter((value,index,list)=>list.indexOf(value)===index);
  if(!candidates.length) return '';
  return candidates.map((sentence,index)=>({sentence,index,score:sentenceScore(sentence,section)})).sort((a,b)=>b.score-a.score||a.index-b.index)[0]?.sentence || '';
}

export function buildStructuredSlate(text,style='gist',maxChars=4000){
  const {title,sections}=parseSections(text);
  const ranked=sections.map((section,index)=>({section,index,score:sectionScore(section,style)})).sort((a,b)=>b.score-a.score||a.index-b.index);
  const priority=[]; const add=(entry)=>{if(entry&&!priority.some((x)=>x.index===entry.index))priority.push(entry);};
  add(ranked.find(({section})=>SUMMARY_RE.test(normalizeMatch(section.heading))));
  for(const entry of ranked.filter(({section})=>CORE_RE.test(normalizeMatch(section.heading))).slice(0,5)) add(entry);
  for(const entry of ranked.filter(({section})=>PRACTICAL_RE.test(normalizeMatch(section.heading))).slice(0,3)) add(entry);
  for(const entry of ranked) add(entry);
  const blocks=[]; let used=0;
  if(title){const line=`[TITLE] ${title}`;if(line.length<=maxChars){blocks.push(line);used+=line.length+1;}}
  for(const {section} of priority){
    const reps=representativeSentences(section,style); if(!reps.length) continue;
    const h=normalizeMatch(section.heading); const label=SUMMARY_RE.test(h)?'SUMMARY':CORE_RE.test(h)?'CORE':PRACTICAL_RE.test(h)?'PRACTICAL':'CONTEXT';
    const block=`[${label}] ${section.heading}\n${reps.map((s)=>`- ${s}`).join('\n')}`;
    if(used+block.length+1>maxChars) continue;
    blocks.push(block); used+=block.length+1;
  }
  return blocks.join('\n');
}

export function structuralFallbackCandidates(text,style='gist'){
  const {sections}=parseSections(text);
  const ranked=sections.map((section,index)=>({section,index,score:sectionScore(section,style)})).sort((a,b)=>b.score-a.score||a.index-b.index);
  const summary=ranked.find(({section})=>SUMMARY_RE.test(normalizeMatch(section.heading)))?.section;
  const core=ranked.filter(({section})=>CORE_RE.test(normalizeMatch(section.heading)));
  const pointCore=core.filter(({section})=>/^ポイント/u.test(normalizeMatch(section.heading)));
  const preferredCore=pointCore.length>=2 ? pointCore : core;
  if(style!=='points' && summary && preferredCore.length>=2){
    const summaryActions=coalesceLines(summary.body).filter((line)=>/^(?:提供する側なら|導入する側なら|共通して)/u.test(line));
    const action=summaryActions.find((line)=>/^共通して/u.test(line)) || summaryActions.at(-1) || representativeSentences(summary,style)[0];
    const result=[bestRepresentative(preferredCore[0].section),bestRepresentative(preferredCore[1].section),action].filter(Boolean);
    if(result.length===3 && new Set(result).size===3) return result;
  }
  if(summary){
    const actions=coalesceLines(summary.body).filter((line)=>/^(?:提供する側なら|導入する側なら|共通して)/u.test(line));
    if(actions.length>=3) return actions.slice(0,3);
  }
  const result=[]; const categories=new Set();
  for(const {section} of ranked){
    const h=normalizeMatch(section.heading); const cat=SUMMARY_RE.test(h)?'summary':CORE_RE.test(h)?'core':PRACTICAL_RE.test(h)?'practical':'context';
    if(categories.has(cat)&&cat!=='core') continue;
    const rep=bestRepresentative(section) || representativeSentences(section,style)[0];
    if(rep&&[...rep].length>=8&&!result.includes(rep)){result.push(rep);categories.add(cat);}
    if(result.length===3) break;
  }
  return result;
}

const STOP_TOKENS = new Set(['する','した','して','いる','ある','こと','もの','ため','場合','今回','これ','それ','その','この','よう','など','から','まで','として','について','サービス','ガイドライン']);
function termSet(text){
  const n=normalizeMatch(text).toLocaleLowerCase('ja-JP');
  const raw=n.match(/[\p{Script=Han}]{2,}|[\p{Script=Katakana}]{2,}|[a-z]{2,}|\d{2,}/gu)||[];
  return new Set(raw.filter((t)=>!STOP_TOKENS.has(t)));
}
function overlapScore(item,section){
  const itemTerms=termSet(item); if(!itemTerms.size) return 0;
  const bodyTerms=termSet(`${section.heading} ${section.body.join(' ')}`);
  let shared=0; for(const t of itemTerms) if(bodyTerms.has(t)) shared+=1;
  return shared/itemTerms.size;
}
export function validateStructuredCoverage(output,text,style='gist'){
  const items=Array.isArray(output?.items)?output.items:[];
  if(items.length!==3) return {ok:false,reason:'shape'};
  const {sections}=parseSections(text);
  const typed=sections.map((section,index)=>{const h=normalizeMatch(section.heading);return{section,index,category:SUMMARY_RE.test(h)?'summary':CORE_RE.test(h)?'core':PRACTICAL_RE.test(h)?'practical':'context'};});
  const majorSections=typed.filter((x)=>x.category==='summary'||x.category==='core');
  if(majorSections.length<2) return {ok:true,mappings:[]};
  const mappings=items.map((item)=>{
    const ranked=typed.map((entry)=>({...entry,score:overlapScore(item,entry.section)})).sort((a,b)=>b.score-a.score||a.index-b.index);
    return ranked[0];
  });
  const matched=mappings.filter((m)=>m&&m.score>=0.18);
  if(matched.length<2) return {ok:false,reason:'weak-structure-match',mappings};
  const distinct=new Set(matched.map((m)=>m.index));
  if(distinct.size<2) return {ok:false,reason:'single-section-detail',mappings};
  if(style!=='points'){
    const majorCount=matched.filter((m)=>m.category==='summary'||m.category==='core').length;
    if(majorCount<2) return {ok:false,reason:'detail-only',mappings};
  }
  return {ok:true,mappings};
}
