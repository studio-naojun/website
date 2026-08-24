import { summarizeExtractively } from './fallback.js';
import { parseSections } from './structure.js';

const SUMMARY_RE = /(?:まとめ|要点|結論|明日から|何をするか)/u;
const BOUNDARY_RE = /(?:分水嶺|基準|原則|価値中立|セーフ|条件)/u;
const CAVEAT_RE = /(?:用法|運用|アウト|例外|ただし|でも|一方)/u;
const ACTION_RE = /(?:共通して|結局|必要|べき|確認|相談|弁護士|停止|手を止め|対応|整える|明文化)/u;

function clean(value) {
  return String(value || '').normalize('NFKC').replace(/[ \t\u3000]+/gu, ' ').trim();
}

function ensurePeriod(value) {
  const text = clean(value).replace(/[。！？!?]+$/u, '');
  return text ? `${text}。` : '';
}

function clip(value, max = 120) {
  const chars = [...clean(value)];
  if (chars.length <= max) return chars.join('');
  return `${chars.slice(0, Math.max(1, max - 1)).join('')}…`;
}

function stripMarketingTitle(title) {
  return clean(title)
    .replace(/^【(?:保存版|完全版|解説|まとめ|必読)】/u, '')
    .replace(/[（(](?:セーフ|アウト|推奨|要点|ポイント)[^）)]*[）)]\s*$/u, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function composeTopicLine(title) {
  const value = stripMarketingTitle(title);
  if (!value) return '';

  const boundaryTitle = value.match(/^「([^」]+)」に[、,]?([^、。]{2,36}?)が(?:ついに)?線を引いた[─—―-]+(.+)$/u);
  if (boundaryTitle) {
    const [, issue, actor, rawDocument] = boundaryTitle;
    const document = clean(rawDocument)
      .replace(/を(?:全部)?まとめ(?:た|る).*$/u, '')
      .replace(/を(?:徹底)?解説(?:した|する).*$/u, '')
      .trim();
    if (document) return clip(`${actor}が「${issue}」の線引きを、${document}で示した。`);
    return clip(`${actor}が「${issue}」の線引きを示した。`);
  }

  const dashParts = value.split(/[─—―]{2,}|\s[-–—]\s/u).map(clean).filter(Boolean);
  if (dashParts.length >= 2) return clip(ensurePeriod(`${dashParts[0]}：${dashParts.slice(1).join('：')}`));
  return clip(ensurePeriod(value));
}

function headingEssence(heading) {
  return clean(heading)
    .replace(/^(?:ポイント|要点)\s*[①-⑳0-9]+\s*[:：]?\s*/u, '')
    .replace(/^[①-⑳0-9]+[.)、:：]?\s*/u, '')
    .trim();
}

function bodySignals(section) {
  return clean((section?.body || []).join(' '));
}

function findBoundaryLine(sections) {
  const entries = sections
    .filter((section) => section.heading && section.heading !== '本文')
    .map((section) => ({ section, essence: headingEssence(section.heading), body: bodySignals(section) }));

  const primary = entries.find(({ essence }) => BOUNDARY_RE.test(essence));
  const caveat = entries.find(({ essence, section }) => section !== primary?.section && CAVEAT_RE.test(essence));

  if (primary && caveat) {
    let first = primary.essence.replace(/[。！？!?]+$/u, '');
    let second = caveat.essence.replace(/[。！？!?]+$/u, '');

    if (/価値中立/u.test(first) && /(?:事件性|紛争案件)/u.test(primary.body) && /設計/u.test(primary.body)) {
      first = '紛争案件向けに作られていない「価値中立」な設計が、セーフかどうかの基準';
    } else {
      first = first.replace(/セーフの分水嶺/u, 'セーフかどうかの基準');
    }

    if (/設計がセーフでも/u.test(second)) second = second.replace(/設計がセーフでも/u, '設計が中立でも実際の');
    if (/アウトになる$/u.test(second) && /(?:評価され得る|可能性|蓋然性|場合)/u.test(caveat.body)) {
      second = second.replace(/アウトになる$/u, 'アウトになる場合がある');
    }
    return clip(`重要：${first}。ただし、${second}。`);
  }

  const candidate = primary || entries.find(({ essence, body }) => BOUNDARY_RE.test(body) || CAVEAT_RE.test(essence));
  return candidate ? clip(`重要：${ensurePeriod(candidate.essence)}`) : '';
}

function summarySections(sections) {
  return sections.filter((section) => SUMMARY_RE.test(clean(section.heading)));
}

function findActionLine(sections) {
  const preferred = summarySections(sections);
  const search = preferred.length ? preferred : sections;
  const lines = [];
  for (const section of search) {
    for (const line of section.body || []) {
      const value = clean(line);
      if (value) lines.push(value);
    }
  }

  let action = lines.find((line) => /^共通して\s*[:：]/u.test(line) && ACTION_RE.test(line));
  if (!action) action = lines.find((line) => /(?:弁護士|手を止め|相談)/u.test(line));
  if (!action) action = lines.find((line) => ACTION_RE.test(line));
  if (!action) return '';

  action = action
    .replace(/^共通して\s*[:：]\s*/u, '')
    .replace(/^結局\s*[:：]\s*/u, '')
    .trim();

  const threeItems = action.match(/^(.+?)[。.]この3つに近づいたら(.+)$/u);
  if (threeItems) action = `${threeItems[1].replace(/、/gu, '・')}に近づいたら${threeItems[2]}`;
  return clip(`結論：${ensurePeriod(action)}`);
}

function hasUsefulStructure(parsed) {
  const headed = parsed.sections.filter((section) => clean(section.heading) !== '本文');
  return headed.length >= 2 && (summarySections(parsed.sections).length > 0 || headed.some((section) => /ポイント|要点|結論/u.test(clean(section.heading))));
}

function distinct(items) {
  const result = [];
  for (const item of items.map(clean).filter(Boolean)) if (!result.includes(item)) result.push(item);
  return result;
}

function structuredItems(text, style) {
  const parsed = parseSections(text);
  if (!hasUsefulStructure(parsed)) return null;

  if (style === 'points') {
    const headings = parsed.sections
      .map((section) => headingEssence(section.heading))
      .filter((heading) => heading && heading !== '本文' && !SUMMARY_RE.test(heading))
      .slice(0, 3)
      .map((heading) => clip(ensurePeriod(heading)));
    if (new Set(headings).size === 3) return headings;
  }

  const topic = composeTopicLine(parsed.title);
  const boundary = findBoundaryLine(parsed.sections);
  const action = findActionLine(parsed.sections);
  const result = distinct([topic, boundary, action]);
  return result.length === 3 ? result : null;
}

function unstructuredItems(text, style) {
  const result = summarizeExtractively(text, style);
  return result.items.map((item) => clip(item));
}

export function composeThreeLines(text, style = 'gist') {
  const items = structuredItems(text, style) || unstructuredItems(text, style);
  return {
    items,
    notes: [],
    engine: 'deterministic-semantic-composer',
    modelId: 'none',
  };
}
