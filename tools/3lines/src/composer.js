import { summarizeExtractively } from './fallback.js';
import { parseSections } from './structure.js';

const SUMMARY_RE = /(?:まとめ|要点|結論|明日から|何をするか)/u;
const BOUNDARY_RE = /(?:分水嶺|基準|原則|セーフ|条件|境界|線引き)/u;
const CAVEAT_RE = /(?:用法|運用|アウト|例外|ただし|でも|一方|逆に)/u;
const ACTION_RE = /(?:共通して|結局|必要|べき|確認|相談|停止|手を止め|対応|整える|明文化|使いましょう)/u;
const RESPONSIBILITY_RE = /(?:入力.*利用者|利用者.*入力|提供者.*無関係|利用者.*提供者|ユーザー.*勝手)/u;
const DOCUMENT_CONTEXT_RE = /(?:公表|文書|ガイドライン|指針|報告|答申|ロードマップ)/u;

function clean(value) {
  return String(value || '').normalize('NFKC').replace(/[ \t\u3000]+/gu, ' ').trim();
}

function ensurePeriod(value) {
  const text = clean(value).replace(/[。！？!?]+$/u, '');
  return text ? `${text}。` : '';
}

function clip(value, max = 140) {
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

function introSection(parsed) {
  return parsed.sections.find((section) => clean(section.heading) === '本文') || parsed.sections[0] || null;
}

function extractOfficialDocument(parsed) {
  const intro = introSection(parsed);
  if (!intro) return '';
  for (const rawLine of intro.body || []) {
    const line = clean(rawLine);
    if (!DOCUMENT_CONTEXT_RE.test(line)) continue;
    const matches = [...line.matchAll(/「([^」]{12,140})」/gu)].map((match) => clean(match[1]));
    const candidate = matches.find((value) => /(?:について|関係|ガイドライン|指針|報告|方針)/u.test(value));
    if (candidate) return candidate;
  }
  return '';
}

function relationFrame(documentTitle) {
  const title = clean(documentTitle).replace(/^ビジネス分野における/u, '');
  const match = title.match(/^(.+?)と(.+?)の関係について$/u);
  if (!match) return null;
  const left = clean(match[1]).replace(/提供$/u, '');
  const right = clean(match[2]);
  const activity = /法務業務/u.test(left) ? '法務業務' : /法律/u.test(left) ? '法律業務' : '業務';
  return { left, right, activity, title };
}

function plainServiceName(value, style = 'gist') {
  let text = clean(value).replace(/等/u, '');
  if (style === 'easy') text = text.replace(/^AI法務業務支援サービス$/u, 'AIを使う法務支援サービス');
  else text = text.replace(/^AI法務業務支援サービス$/u, 'AI法務支援サービス');
  return text;
}

function findActor(parsed) {
  const fromTitle = parseBoundaryTitle(parsed.title)?.actor;
  if (fromTitle) return fromTitle;
  const intro = introSection(parsed);
  const joined = clean((intro?.body || []).join(' '));
  return joined.match(/([^、。]{2,24})が(?:正面から答える文書|[^。]{0,24}公表)/u)?.[1] || '';
}

function bodyGroundedProfile(parsed) {
  const documentTitle = extractOfficialDocument(parsed);
  if (!documentTitle) return null;
  return {
    documentTitle,
    relation: relationFrame(documentTitle),
    actor: findActor(parsed),
  };
}

function composeOverviewLine(parsed, style = 'gist') {
  const profile = bodyGroundedProfile(parsed);
  if (profile?.relation) {
    const { left, right, activity } = profile.relation;
    const actor = profile.actor || '本文';
    const service = plainServiceName(left, style);
    if (style === 'faithful') {
      return clip(`全体：${actor}が公表した「${profile.documentTitle}」をもとに、${service}が${right}に照らしてどこまで${activity}を扱えるかを整理した文章。`);
    }
    if (style === 'easy') {
      return clip(`全体：${actor}が、${service}をどこまで使えるのか、${right}との線引きと注意点を整理した内容。`);
    }
    return clip(`全体：${actor}が、${service}と${right}の関係を整理した内容。${service}がどこまで${activity}を扱えるか、その線引きが主題。`);
  }

  const boundaryTitle = parseBoundaryTitle(parsed.title);
  if (boundaryTitle) {
    const { issue, actor, document } = boundaryTitle;
    const sourceName = document ? `${actor}の${document}` : `${actor}の文書`;
    if (style === 'easy') return clip(`全体：${issue.replace(/問題$/u, '')}はどこまでよいのかを、${sourceName}に沿って、使ってよい範囲と注意点まで整理した文章。`);
    if (style === 'faithful') return clip(`全体：${sourceName}をもとに、「${issue}」を実務の判断に使える形で整理した文章。`);
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

function prefaceMeaning(sections) {
  const preface = sections.find((section) => /^前提/u.test(clean(section.heading)));
  if (!preface) return null;
  const body = (preface.body || []).map(clean).filter(Boolean);
  const termLine = body.find((line) => /(?:キモ|重要|ポイント).+「[^」]+」/u.test(line)) || body.find((line) => /「事件性」/u.test(line));
  const term = quotedConcept(termLine || '');
  let definition = '';
  if (term) {
    const definitionLine = body.find((line) => /紛争性のある案件/u.test(line));
    definition = definitionLine?.match(/(紛争性のある案件)/u)?.[1] || '';
  }
  const rule = clean(preface.heading).match(/((?:弁護士|法律)[^：:]{0,24}法\s*\d+条)/u)?.[1] || '';
  return term ? { term, definition, rule } : null;
}

function responsibilityClause(entry, style = 'gist') {
  if (!entry) return '';
  if (style === 'easy') return 'ユーザーが入力しただけでも提供者は無関係とは言えず';
  if (style === 'faithful') {
    const direct = (entry.section.body || []).map(clean).find((line) => /提供者の行為.*評価され得る/u.test(line));
    if (direct) return direct.replace(/^→\s*/u, '').replace(/[。！？!?]+$/u, '');
  }
  return entry.essence.replace(/[。！？!?]+$/u, '').replace(/は通らない$/u, 'は通らず');
}

function caveatClause(entry, style = 'gist') {
  if (!entry) return '';
  if (style === 'easy') return '実際の使われ方まで見られる';
  if (style === 'faithful') return entry.essence.replace(/[。！？!?]+$/u, '').replace(/アウトになる$/u, 'アウトになり得る');
  if (/アウト/u.test(entry.essence)) return '実際の使われ方でも問題になり得る';
  return entry.essence.replace(/[。！？!?]+$/u, '');
}

function findIntentLine(parsed, style = 'gist') {
  const { entries, primary, caveat, responsibility } = boundaryEntries(parsed.sections);
  const candidate = primary || entries.find(({ essence, body }) => BOUNDARY_RE.test(body) || CAVEAT_RE.test(essence));
  if (!candidate) return '';

  const preface = prefaceMeaning(parsed.sections);
  const profile = bodyGroundedProfile(parsed);
  const service = plainServiceName(profile?.relation?.left || 'サービス', style);
  const headingConcept = quotedConcept(candidate.essence);
  const bodyConcept = quotedConcept(candidate.body);
  const designTarget = negativeDesignDefinition(candidate.body)
    .replace(/「[^」]+」のある案件/u, preface?.definition || '紛争性のある案件')
    .replace(/に利用させることを目指さない設計$/u, 'に使わせる前提で作らないこと');

  if (preface?.term && preface.definition) {
    const rule = preface.rule || 'このルール';
    if (style === 'faithful') {
      const concept = bodyConcept || headingConcept;
      return clip(`肝：${rule}のキモは「${preface.term}」、つまり${preface.definition}。基準は${concept ? `「${concept}」` : '中立的な設計'}で、設計だけでなく提供後の用法・運用実態も見られる。`);
    }
    if (style === 'easy') {
      return clip(`大事：${rule}で弁護士以外が扱えないのは、紛争性のある法律案件。${service}はそこに使う前提で作らず、実際の使われ方でも紛争対応へ踏み込まないことが大事。`);
    }
    const responsibilityText = responsibility ? '利用者任せでは逃れられず' : '';
    const caveatText = caveat ? '実際の使われ方も見られる' : '';
    return clip(`肝：${rule}で問題になる「${preface.term}」とは、${preface.definition}のこと。${service}はそこに使わせる前提で作らないことが基準で、${[responsibilityText, caveatText].filter(Boolean).join('、')}。`);
  }

  const concept = bodyConcept || headingConcept;
  const responsibilityText = responsibilityClause(responsibility, style);
  const caveatText = caveatClause(caveat, style);
  let first = designTarget ? `${concept ? `「${concept}」＝` : ''}${designTarget}が基準` : candidate.essence.replace(/[。！？!?]+$/u, '').replace(/セーフの分水嶺/u, '判断の基準').replace(/分水嶺/u, '判断の境界');
  const label = style === 'easy' ? '大事' : '肝';
  return clip(`${label}：${first}。${[responsibilityText, caveatText].filter(Boolean).join('、')}。`);
}

function summarySections(sections) {
  return sections.filter((section) => SUMMARY_RE.test(clean(section.heading)));
}

function collectActionLines(sections) {
  const preferred = summarySections(sections);
  const search = preferred.length ? preferred : sections;
  const lines = [];
  for (const section of search) for (const line of section.body || []) if (clean(line)) lines.push(clean(line));
  return lines;
}

function stripActionPrefix(line) {
  return clean(line)
    .replace(/^(?:導入する側なら|使う側なら|利用する側なら|提供する側なら|共通して|結局)\s*[:：]\s*/u, '')
    .replace(/[。！？!?]+$/u, '')
    .trim();
}

function extractConcreteExamples(adoption) {
  if (!adoption) return '';
  const parts = clean(adoption).split(/。/u).map(clean).filter(Boolean);
  const candidate = parts.find((part) => (part.match(/、/gu)?.length || 0) >= 2 && !/(?:類型|全面禁止|一律禁止)/u.test(part));
  if (!candidate) return '';
  return candidate
    .replace(/あたりは.*$/u, '')
    .replace(/などは.*$/u, '')
    .replace(/、会議支援/u, '、会議支援')
    .trim();
}

function compactCommonAction(line, style = 'gist') {
  let action = stripActionPrefix(line);
  const threeItems = action.match(/^(.+?)[。.]この3つに近づいたら(.+)$/u);
  if (threeItems) action = `${threeItems[1].replace(/、/gu, '・')}に近づいたら${threeItems[2]}`;
  action = action.replace(/手を止めて弁護士へ$/u, '弁護士へ切り替える');
  if (style === 'easy') action = action.replace(/裁判所への提出書面/u, '裁判所に出す書面').replace(/和解契約書/u, '和解の契約書');
  return action;
}

function findTakeawayLine(parsed, style = 'gist') {
  const lines = collectActionLines(parsed.sections);
  const adoption = lines.find((line) => /^(?:導入する側なら|使う側なら|利用する側なら)/u.test(line));
  const common = lines.find((line) => /^共通して\s*[:：]/u.test(line));
  const banPhrase = adoption?.match(/「([^」]*(?:全面禁止|一律禁止)[^」]*)」/u)?.[1] || '';
  const examples = extractConcreteExamples(adoption);
  const action = common ? compactCommonAction(common, style) : '';
  const profile = bodyGroundedProfile(parsed);
  const service = plainServiceName(profile?.relation?.left || 'AI', style);

  if (adoption && common) {
    const exampleText = examples || '本文で認められた範囲の業務';
    if (style === 'easy') {
      return clip(`つまり：${service}を全部禁止する必要はない。${exampleText}などは社内で使い方を決めて活用し、${action}。`);
    }
    if (style === 'faithful') {
      return clip(`結論：${banPhrase ? `「${banPhrase}」をやめ、` : ''}${exampleText}など使える業務を社内規程に明文化し、${action}。`);
    }
    return clip(`結局：${service}を全面禁止する必要はない。${exampleText}など使える業務は社内でルールを決めて活用し、${action}、という話。`);
  }

  let fallback = lines.find((line) => ACTION_RE.test(line));
  if (!fallback) return '';
  fallback = stripActionPrefix(fallback);
  const label = style === 'easy' ? 'つまり' : style === 'faithful' ? '結論' : '結局';
  return clip(`${label}：${ensurePeriod(fallback)}`);
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
    findIntentLine(parsed, style),
    findTakeawayLine(parsed, style),
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
