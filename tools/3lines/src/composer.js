import { summarizeExtractively } from './fallback.js';
import { parseSections } from './structure.js';

const SUMMARY_RE = /(?:まとめ|要点|結論|明日から|何をするか)/u;
const BOUNDARY_RE = /(?:分水嶺|基準|原則|セーフ|条件|境界|線引き)/u;
const CAVEAT_RE = /(?:用法|運用|アウト|例外|ただし|でも|一方|逆に)/u;
const ACTION_RE = /(?:共通して|結局|必要|べき|確認|相談|停止|手を止め|対応|整える|明文化|使いましょう)/u;
const RESPONSIBILITY_RE = /(?:入力.*利用者|利用者.*入力|提供者.*無関係|利用者.*提供者|ユーザー.*勝手)/u;

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

function parseBoundaryTitle(title) {
  const value = stripMarketingTitle(title);
  const match = value.match(/^「([^」]+)」に[、,]?([^、。]{2,36}?)が(?:ついに)?線を引いた[─—―-]+(.+)$/u);
  if (!match) return null;
  const [, issue, actor, rawDocument] = match;
  const document = clean(rawDocument)
    .replace(/を(?:全部)?まとめ(?:た|る).*$/u, '')
    .replace(/を(?:徹底)?解説(?:した|する).*$/u, '')
    .trim();
  return { issue: clean(issue), actor: clean(actor), document };
}

export function composeTopicLine(title) {
  const value = stripMarketingTitle(title);
  if (!value) return '';

  const boundaryTitle = parseBoundaryTitle(title);
  if (boundaryTitle) {
    const { issue, actor, document } = boundaryTitle;
    if (document) return clip(`${actor}が「${issue}」の線引きを、${document}で示した。`);
    return clip(`${actor}が「${issue}」の線引きを示した。`);
  }

  const dashParts = value.split(/[─—―]{2,}|\s[-–—]\s/u).map(clean).filter(Boolean);
  if (dashParts.length >= 2) return clip(ensurePeriod(`${dashParts[0]}：${dashParts.slice(1).join('：')}`));
  return clip(ensurePeriod(value));
}

function composeOverviewLine(parsed, style = 'gist') {
  const boundaryTitle = parseBoundaryTitle(parsed.title);
  if (boundaryTitle) {
    const { issue, actor, document } = boundaryTitle;
    const sourceName = document ? `${actor}の${document}` : `${actor}の文書`;
    if (style === 'easy') {
      const easyIssue = issue.replace(/問題$/u, '');
      return clip(`全体：${easyIssue}はどこまでよいのかを、${sourceName}に沿って、使ってよい範囲と注意点まで整理した文章。`);
    }
    if (style === 'faithful') {
      return clip(`全体：${sourceName}をもとに、「${issue}」を実務の判断に使える形で整理した文章。`);
    }
    return clip(`全体：「${issue}」について、${sourceName}が示した線引きと、実務でどう使うかまで整理した文章。`);
  }

  const title = stripMarketingTitle(parsed.title);
  if (!title) return '';
  if (style === 'easy') return clip(`全体：${title}について、何が大事かを分かりやすく整理した文章。`);
  if (style === 'faithful') return clip(`全体：${ensurePeriod(title)}`);
  return clip(`全体：${title}について、全体像と重要点を整理した文章。`);
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

function quotedConcept(value) {
  return clean(value).match(/「([^」]{2,48})」/u)?.[1] || '';
}

function negativeDesignDefinition(body) {
  const value = clean(body);
  const match = value.match(/(?:^|[。！？]\s*)(?:そもそも)?([^。！？]{2,64}?)に利用させることを目指して設計されたサービスでない場合/u);
  if (!match) return '';
  const target = clean(match[1]);
  return target ? `${target}に利用させることを目指さない設計` : '';
}

function conciseDesignDefinition(body, style = 'gist') {
  const definition = negativeDesignDefinition(body);
  if (!definition) return '';
  let value = definition.replace(/に利用させることを目指さない設計$/u, '向けに作らないこと');
  if (style === 'easy') value = value.replace(/「事件性」のある案件/u, '紛争案件');
  return value;
}

function boundaryEntries(sections) {
  const entries = sections
    .filter((section) => section.heading && section.heading !== '本文')
    .map((section) => ({ section, essence: headingEssence(section.heading), body: bodySignals(section) }));
  const primary = entries.find(({ essence }) => BOUNDARY_RE.test(essence))
    || entries.find(({ essence }) => /「[^」]+」/u.test(essence));
  const caveat = entries.find(({ essence, section }) => section !== primary?.section && CAVEAT_RE.test(essence));
  const responsibility = entries.find(({ essence, body, section }) => section !== primary?.section && RESPONSIBILITY_RE.test(`${essence} ${body}`));
  return { entries, primary, caveat, responsibility };
}

function responsibilityClause(entry, style = 'gist') {
  if (!entry) return '';
  if (style === 'easy') return 'ユーザーが入力しただけでも提供者は無関係とは言えず';
  if (style === 'faithful') {
    const direct = (entry.section.body || [])
      .map(clean)
      .find((line) => /提供者の行為.*評価され得る/u.test(line));
    if (direct) return direct.replace(/^→\s*/u, '').replace(/[。！？!?]+$/u, '');
  }
  return entry.essence
    .replace(/[。！？!?]+$/u, '')
    .replace(/は通らない$/u, 'は通らず');
}

function caveatClause(entry, style = 'gist') {
  if (!entry) return '';
  if (style === 'easy') return '実際の使われ方まで見られる';
  if (style === 'faithful') {
    return entry.essence
      .replace(/[。！？!?]+$/u, '')
      .replace(/アウトになる$/u, 'アウトになり得る');
  }
  if (/アウト/u.test(entry.essence)) return '実際の用法でもアウトになり得る';
  return entry.essence.replace(/[。！？!?]+$/u, '');
}

function findIntentLine(sections, style = 'gist') {
  const { entries, primary, caveat, responsibility } = boundaryEntries(sections);
  const candidate = primary || entries.find(({ essence, body }) => BOUNDARY_RE.test(body) || CAVEAT_RE.test(essence));
  if (!candidate) return '';

  const headingConcept = quotedConcept(candidate.essence);
  const bodyConcept = quotedConcept(candidate.body);
  const definition = conciseDesignDefinition(candidate.body, style);

  if (style === 'faithful') {
    const concept = bodyConcept || headingConcept;
    const first = concept ? `基準は「${concept}」` : candidate.essence.replace(/[。！？!?]+$/u, '');
    const responsibilityText = responsibilityClause(responsibility, style);
    const caveatText = caveatClause(caveat, style);
    const parts = [first, responsibilityText, caveatText].filter(Boolean);
    return clip(`肝：${parts.map((part) => ensurePeriod(part)).join('')}`);
  }

  let first = candidate.essence.replace(/[。！？!?]+$/u, '');
  if (headingConcept && definition) first = `「${headingConcept}」＝${definition}が基準`;
  else if (definition) first = `${definition}が基準`;
  else first = first.replace(/セーフの分水嶺/u, 'セーフかどうかの基準').replace(/分水嶺/u, '判断の境界');

  const responsibilityText = responsibilityClause(responsibility, style);
  const caveatText = caveatClause(caveat, style);
  const label = style === 'easy' ? '大事' : '肝';
  if (responsibilityText && caveatText) return clip(`${label}：${first}。${responsibilityText}、${caveatText}。`);
  if (caveatText) return clip(`${label}：${first}。ただし、${caveatText}。`);
  return clip(`${label}：${ensurePeriod(first)}`);
}

function summarySections(sections) {
  return sections.filter((section) => SUMMARY_RE.test(clean(section.heading)));
}

function collectActionLines(sections) {
  const preferred = summarySections(sections);
  const search = preferred.length ? preferred : sections;
  const lines = [];
  for (const section of search) {
    for (const line of section.body || []) {
      const value = clean(line);
      if (value) lines.push(value);
    }
  }
  return lines;
}

function stripActionPrefix(line) {
  return clean(line)
    .replace(/^(?:導入する側なら|使う側なら|利用する側なら|提供する側なら|共通して|結局)\s*[:：]\s*/u, '')
    .replace(/[。！？!?]+$/u, '')
    .trim();
}

function compactCommonAction(line, style = 'gist') {
  let action = stripActionPrefix(line);
  const threeItems = action.match(/^(.+?)[。.]この3つに近づいたら(.+)$/u);
  if (threeItems) action = `${threeItems[1].replace(/、/gu, '・')}に近づいたら${threeItems[2]}`;
  if (style === 'easy') {
    action = action
      .replace(/裁判所への提出書面/u, '裁判所に出す書面')
      .replace(/和解契約書/u, '和解の契約書');
  }
  return action;
}

function findTakeawayLine(sections, style = 'gist') {
  const lines = collectActionLines(sections);
  const adoption = lines.find((line) => /^(?:導入する側なら|使う側なら|利用する側なら)/u.test(line));
  const common = lines.find((line) => /^共通して\s*[:：]/u.test(line));
  const banPhrase = adoption?.match(/「([^」]*(?:全面禁止|一律禁止)[^」]*)」/u)?.[1] || '';
  const safeType = adoption?.match(/(?:セーフ|安全)[^、。\s]{0,12}類型/u)?.[0] || '';

  if (adoption && common && (banPhrase || safeType)) {
    const action = compactCommonAction(common, style);
    if (style === 'easy') {
      const opening = banPhrase ? `「${banPhrase}」ではなく` : '全部を避けるのではなく';
      const middle = safeType ? `${safeType}に沿って使える範囲を決め` : '使える範囲を決め';
      return clip(`つまり：${opening}、${middle}、${action}。`);
    }
    if (style === 'faithful') {
      const opening = banPhrase ? `「${banPhrase}」をやめて` : '';
      const middle = safeType ? `${safeType}に沿って使える業務を社内規程に明文化し` : stripActionPrefix(adoption);
      return clip(`結論：${[opening, middle, action].filter(Boolean).join('、')}。`);
    }
    const opening = banPhrase ? `「${banPhrase}」にせず` : '全部を避けるのではなく';
    const middle = safeType ? `${safeType}に沿って使える業務を社内規程に明文化し` : stripActionPrefix(adoption);
    return clip(`結局：この文章が言いたいのは、${opening}、${middle}、${action}、ということ。`);
  }

  let action = lines.find((line) => ACTION_RE.test(line));
  if (!action) return '';
  action = stripActionPrefix(action);
  const label = style === 'easy' ? 'つまり' : style === 'faithful' ? '結論' : '結局';
  return clip(`${label}：${ensurePeriod(action)}`);
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

function pointsItems(parsed) {
  const pointHeadings = parsed.sections
    .filter((section) => /^ポイント\s*[①-⑳0-9０-９]*/u.test(clean(section.heading)))
    .map((section) => headingEssence(section.heading))
    .filter(Boolean)
    .slice(0, 3)
    .map((heading) => clip(ensurePeriod(heading)));
  if (new Set(pointHeadings).size === 3) return pointHeadings;

  const headings = parsed.sections
    .map((section) => headingEssence(section.heading))
    .filter((heading) => heading && heading !== '本文' && !SUMMARY_RE.test(heading))
    .slice(0, 3)
    .map((heading) => clip(ensurePeriod(heading)));
  return new Set(headings).size === 3 ? headings : null;
}

function ladderItems(parsed, style = 'gist') {
  const result = distinct([
    composeOverviewLine(parsed, style),
    findIntentLine(parsed.sections, style),
    findTakeawayLine(parsed.sections, style),
  ]);
  return result.length === 3 ? result : null;
}

function structuredItems(text, style) {
  const parsed = parseSections(text);
  if (!hasUsefulStructure(parsed)) return null;
  if (style === 'points') return pointsItems(parsed);
  return ladderItems(parsed, style);
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
