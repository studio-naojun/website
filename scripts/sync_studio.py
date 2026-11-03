"""Materialize shared NaoJun chrome/catalogue into static HTML; --check never writes."""
import argparse
import calendar
import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
VERSION='20261103r'

SECTIONS={'investment':'投資レポート','admissions':'中学受験レポート','ai-dev':'AI開発・セキュリティ日報'}
# Edition identity: an English cover word, a short subtitle and the real publishing cadence per series.
EDITIONS={'investment':('INVESTMENT','Observatory','週刊・月刊'),'admissions':('ADMISSIONS','School Notes','週刊・特集'),'ai-dev':('AI-DEV','Security Daily','日報')}
ISSUE_TYPES={'weekly':'週刊','monthly':'月刊','special':'特集','daily':'日報'}
PREVIEW_CHAPTERS=4

def feed_entries(root,section):
    return sorted(json.loads((root/section/'feed.json').read_text(encoding='utf-8'))['entries'],key=lambda e:(e['published_at'],e['path']),reverse=True)

def entry_link(section,item,summary=False):
    e=lambda value:html.escape(str(value),quote=True)
    return (f'<a class="reading-entry" href="/{section}/{e(item["path"].strip("/"))}/">'
            f'<time datetime="{e(item["published_at"])}">{e(item["published_at"])}</time>'
            f'<h3>{e(item["title"])}</h3>'
            +(f'<p>{e(item["summary"])}</p>' if summary else '')
            +'<span class="entry-arrow" aria-hidden="true">↗</span></a>')

def cover_art(section,date):
    """Decorative, category-specific cover illustration. Hidden from assistive technology."""
    e=lambda value:html.escape(str(value),quote=True)
    word,sub,_=EDITIONS[section]
    y,m,d=(date.split('-')+['','',''])[:3]
    if section=='investment':
        orbits=''.join(f'<ellipse cx="300" cy="300" rx="{r}" ry="{round(r*.42)}" transform="rotate({-18+i*9} 300 300)"/>' for i,r in enumerate([70,130,190,250,290]))
        marks=''.join(f'<circle cx="{x}" cy="{cy}" r="{r}"/>' for x,cy,r in [(512,236,9),(118,352,6),(372,174,5),(232,442,7)])
        art=(f'<svg class="cover-figure" viewBox="0 0 600 600" focusable="false"><g class="orbit-lines">{orbits}'
             '<line x1="300" y1="0" x2="300" y2="600"/><line x1="0" y1="300" x2="600" y2="300"/></g>'
             f'<g class="orbit-marks">{marks}</g></svg>')
        numerals=f'<span class="cover-numerals">{e(m)}<i>.</i>{e(d)}</span>' if d else ''
    elif section=='admissions':
        cells=''
        if y.isdigit() and m.isdigit():
            for week in calendar.Calendar(firstweekday=6).monthdayscalendar(int(y),int(m)):
                for day in week:
                    mark=' class="is-issue"' if d.isdigit() and day==int(d) else ''
                    cells+=f'<i{mark}>{day or ""}</i>'
        art=f'<div class="cover-figure cover-calendar"><b>{e(y)}.{e(m)}</b><div class="calendar-cells">{cells}</div></div>'
        numerals='<span class="cover-numerals cover-kanji">受験</span>'
    else:
        traces=['M0 60H140V20H260','M0 140H90V200H300','M60 300V240H200V120H300','M140 0V60','M200 300V250','M260 20V90H300']
        nodes=[(260,20),(300,200),(140,60),(200,120),(90,200),(200,250),(300,90)]
        art=('<svg class="cover-figure cover-circuit" viewBox="0 0 300 300" focusable="false"><g class="circuit-lines">'
             +''.join(f'<path d="{t}"/>' for t in traces)+'</g><g class="circuit-nodes">'
             +''.join(f'<circle cx="{x}" cy="{y_}" r="7"/>' for x,y_ in nodes)+'</g><rect class="circuit-chip" x="150" y="150" width="70" height="70"/></svg>')
        numerals=f'<span class="cover-numerals">[{e(m)}.{e(d)}]</span>' if d else ''
    return (f'<div class="cover-art cover-art-{section}" aria-hidden="true">{art}{numerals}'
            f'<span class="cover-word">{e(word)}<small>{e(sub)}</small></span></div>')

def chapter_preview(headings):
    """Small cover contents list built only from the article's real h2 headings."""
    if not headings:return ''
    e=lambda value:html.escape(str(value),quote=True)
    # The cover supplies its own issue ordinals; do not double-number headings such as "1. 結論".
    label=lambda value:re.sub(r'^\s*\d+[.．、)]\s*','',value)
    items=''.join(f'<li><a href="#{e(a)}"><span class="chapter-no" aria-hidden="true">{n:02d}</span><span class="chapter-title">{e(label(t))}</span></a></li>' for n,(a,t) in enumerate(headings[:PREVIEW_CHAPTERS],1))
    more=f'<a class="cover-chapters-all" href="#reading-toc">全{len(headings)}章の目次へ <span aria-hidden="true">↓</span></a>' if len(headings)>PREVIEW_CHAPTERS else ''
    return (f'<nav class="cover-chapters" aria-label="この号の章立て"><p class="cover-chapters-label"><span>IN THIS ISSUE</span><span>この号の内容・全{len(headings)}章</span></p>'
            f'<ol>{items}</ol>{more}</nav>')

def editorial_article(root,section,rel,source):
    # Remove only our generated shell before rebuilding. Published prose stays intact.
    source=re.sub(r'<!-- studio:reading:start -->.*?<!-- studio:reading:body -->\n?', '',source,flags=re.S)
    source=re.sub(r'\n?<!-- studio:reading:tail -->.*?<!-- studio:reading:end -->', '',source,flags=re.S)
    source=re.sub(r'\n<!-- studio:coverart:start -->.*?<!-- studio:coverart:end -->', '',source,flags=re.S)
    source=re.sub(r'<!-- studio:covernav:start -->.*?<!-- studio:covernav:end -->\n', '',source,flags=re.S)
    # Unwrap our display-only span before rebuilding to make repeated sync idempotent.
    source=source.replace('<span class="issue-title-unit">日報</span>','日報')
    hero_pattern=r'(<header class="(?:investment|admissions|ai-dev)-article-hero">)(.*?)(</header>)'
    def masthead(match):
        hero=match[2]
        eyebrows=re.findall(r'<div class="eyebrow">(.*?)</div>',hero,re.S)
        if eyebrows:
            issue=eyebrows[-1]
            for old,new in [('WEEKLY','週刊'),('MONTHLY','月刊'),('SPECIAL','特集'),('DAILY','日報')]:issue=issue.replace(old,new)
            line=f'<div class="issue-masthead"><span>{SECTIONS[section]}</span><span>{issue}</span></div>'
            hero=re.sub(r'(?:<div class="eyebrow">.*?</div>\s*)+',lambda m:line+'\n',hero,count=1,flags=re.S)
        return match[1]+hero+match[3]
    source=re.sub(hero_pattern,masthead,source,count=1,flags=re.S)
    match=re.search(r'<article class="(?:investment|admissions|ai-dev)-article"[^>]*>(.*?)</article>',source,re.S)
    if not match:return source
    ids=set(re.findall(r'\bid=["\']([^"\']+)',source));headings=[]
    def heading(m):
        attrs,text=m[1],m[2];existing=re.search(r'\bid=["\']([^"\']+)',attrs)
        if existing:anchor=existing[1]
        else:
            n=len(headings)+1;anchor=f'reading-section-{n}'
            while anchor in ids:n+=1;anchor=f'reading-section-{n}'
            ids.add(anchor);attrs+=f' id="{anchor}"'
        headings.append((anchor,html.unescape(re.sub('<[^>]+>','',text)).strip()))
        return '<h2'+attrs+'>'+text+'</h2>'
    article=re.sub(r'<h2([^>]*)>(.*?)</h2>',heading,match[0],flags=re.S)
    links=''.join(f'<li><a href="#{html.escape(a,quote=True)}">{html.escape(t)}</a></li>' for a,t in headings)
    toc=(f'<aside class="reading-rail"><details class="reading-toc" id="reading-toc" open><summary>このページの内容<span class="toc-count">{len(headings)}項目</span></summary>'
         f'<nav aria-label="記事の目次"><ol>{links}</ol></nav></details><a class="rail-back" href="/{section}/">← {SECTIONS[section]}一覧</a></aside>') if headings else ''
    entries=[e for e in feed_entries(root,section) if f'{section}/{e["path"].strip("/")}/index.html'!=rel]
    current=next((e for e in feed_entries(root,section) if f'{section}/{e["path"].strip("/")}/index.html'==rel),None)
    older=[e for e in entries if current and e['published_at']<=current['published_at']]
    related=(older or entries)[:1]
    footer=f'<footer class="reading-footer"><p class="reading-end">読み終えたら、もうひとつ。</p>'+''.join(entry_link(section,e) for e in related)+f'<a class="arrow-link" href="/{section}/">{SECTIONS[section]}一覧へ <span aria-hidden="true">↗</span></a></footer>'
    shell='<!-- studio:reading:start -->\n<div class="reading-layout container">'+toc+'\n<!-- studio:reading:body -->\n'+article+'\n<!-- studio:reading:tail -->\n'+footer+'</div>\n<!-- studio:reading:end -->'
    source=source[:match.start()]+shell+source[match.end():]
    # Cover spread: decorative art opens the hero; the real-chapter preview closes it.
    issue_date=current['published_at'] if current else ''
    def cover(m):
        word,sub,cadence=EDITIONS[section]
        plate=f'<div class="cover-nameplate" aria-hidden="true"><span>{word}</span><small>{sub} / {cadence}</small></div>'
        art='\n<!-- studio:coverart:start -->'+cover_art(section,issue_date)+plate+'<!-- studio:coverart:end -->'
        nav=chapter_preview(headings)
        nav=('<!-- studio:covernav:start -->'+nav+'<!-- studio:covernav:end -->\n') if nav else ''
        hero_body=m[2]
        if section=='ai-dev':
            # Preserve the article's text and published metadata; keep the two-character
            # title unit together instead of splitting 日 / 報 at narrow widths.
            hero_body=re.sub(r'(<h1\b[^>]*>[^<]*?)日報(?=｜)',r'\1<span class="issue-title-unit">日報</span>',hero_body,count=1)
        return m[1]+art+hero_body+nav+m[3]
    return re.sub(hero_pattern,cover,source,count=1,flags=re.S)

def front_cover(root,items,spotlight):
    """Home cover: the playable spotlight work and Koechara's real screen, both from the registry."""
    e=lambda value:html.escape(str(value),quote=True)
    koechara=next(item for item in items if item['id']=='koechara')
    shot=re.search(r'<img\b[^>]*>',(root/koechara['cover']).read_text(encoding='utf-8'))[0].replace(' loading="lazy"','')
    image=spotlight.get('specimen')
    frame=(f'<span class="play-frame"><img src="{e(image["src"])}" width="{int(image["width"])}" height="{int(image["height"])}" alt="{e(image["alt"])}" fetchpriority="high"></span>') if image else ''
    return (f'<div class="front-type"><p class="front-folio"><span>NAOJUN STUDIOS</span><span>ふたりの小さな制作スタジオ</span></p>'
            '<h1 id="studio-title" class="front-title">日々に、<br>小さな発明を。</h1>'
            '<ol class="front-lines" aria-label="このサイトでできること">'
            f'<li><a href="{e(spotlight["href"])}"><b>遊ぶ。</b><span>{e(spotlight["title"])}／{e(spotlight["status"])}</span></a></li>'
            '<li><a href="/works/"><b>つくる。</b><span>Koecharaと、スタジオの作品</span></a></li>'
            '<li><a href="#journal"><b>確かめる。</b><span>投資・中学受験・AI開発の三誌</span></a></li></ol>'
            '<figure class="hero-art" aria-label="ふたつの線が交わる、スタジオのシンボル"><img src="/assets/art/two-threads.svg" width="700" height="700" alt=""><canvas id="thread-canvas" width="700" height="700" aria-hidden="true"></canvas><figcaption class="art-caption"><button class="motion-toggle" type="button" hidden>動きを止める</button></figcaption></figure></div>'
            f'<a class="front-play" href="{e(spotlight["href"])}">{frame}<span class="play-copy"><span class="play-status">{e(spotlight["status"])}</span>'
            f'<strong>{e(spotlight["title"])}を遊ぶ</strong><span class="play-note">{e(spotlight["summary"])}</span><span class="play-go" aria-hidden="true">PLAY NOW ↗</span></span></a>'
            f'<a class="front-specimen" href="{e(koechara["href"])}"><span class="specimen-crop">{shot}</span>'
            f'<span class="specimen-tag"><b>{e(koechara["title"])}</b><span>{e(koechara["label"])}・{e(koechara["status"])}</span></span></a>')

def editions(root):
    """Three live issue covers from each series feed: latest issue, two back numbers."""
    e=lambda value:html.escape(str(value),quote=True)
    rows=[]
    for section,label in SECTIONS.items():
        entries=feed_entries(root,section)
        if not entries:continue
        latest,back=entries[0],entries[1:3]
        href=f'/{section}/{e(latest["path"].strip("/"))}/'
        issue=ISSUE_TYPES.get(latest.get('type'),'')
        backlist=''.join(f'<li><a href="/{section}/{e(b["path"].strip("/"))}/"><time datetime="{e(b["published_at"])}">{e(b["published_at"])}</time><span>{e(b["title"])}</span></a></li>' for b in back)
        rows.append(f'<article class="edition edition-{section}" aria-labelledby="edition-{section}-title">{cover_art(section,latest["published_at"])}'
                    f'<p class="edition-mast"><span>{label}</span><span>{EDITIONS[section][2]}</span></p>'
                    f'<p class="edition-issue"><span>{issue}</span><time datetime="{e(latest["published_at"])}">{e(latest["published_at"])}</time></p>'
                    f'<h3 id="edition-{section}-title"><a class="edition-link" href="{href}">{e(latest["title"])}</a></h3><p class="edition-summary">{e(latest["summary"])}</p>'
                    f'<div class="edition-back"><p>バックナンバー</p><ul>{backlist}</ul><a class="edition-all" href="{section}/">{label}一覧へ <span aria-hidden="true">↗</span></a></div></article>')
    return '\n'.join(rows) or '<p>公開記事を準備しています。</p>'

def validate_works(items):
    ids=set()
    for item in items:
        if not re.fullmatch(r'[a-z0-9-]+',item['id']) or item['id'] in ids:
            raise ValueError('Invalid or duplicate work id: '+item['id'])
        ids.add(item['id'])
        href=item['href'];u=urlsplit(href)
        if not ((href.startswith('/') and not href.startswith('//') and not u.netloc) or (u.scheme=='https' and u.netloc)):
            raise ValueError('Work URL must be a local absolute path or HTTPS: '+href)
        if item['category'] not in {'companion','game','tool','research','film'}:
            raise ValueError('Unknown work category: '+item['category'])
        for key in ['title','summary','label','status','cover']:
            if not isinstance(item.get(key),str) or not item[key].strip():raise ValueError('Missing '+key)
        if not isinstance(item.get('featured'),bool):raise ValueError('featured must be boolean')
        if 'specimen' in item:
            image=item['specimen']
            if not (isinstance(image,dict) and re.fullmatch(r'/[a-z0-9/_.-]+\.(?:webp|png|jpg)',str(image.get('src',''))) and isinstance(image.get('width'),int) and isinstance(image.get('height'),int) and str(image.get('alt','')).strip()):
                raise ValueError('specimen needs a local image src, integer width/height and alt: '+item['id'])

def load_works(root):
    items=json.loads((root/'content/works.json').read_text(encoding='utf-8'))
    validate_works(items)
    for item in items:
        cover=(root/item['cover']).resolve()
        if not cover.is_relative_to((root/'_partials/covers').resolve()) or not cover.is_file():
            raise ValueError('Cover must exist under _partials/covers: '+item['cover'])
        if item['href'].startswith('/') and not (root/item['href'].strip('/')/'index.html').exists():
            raise ValueError('Work destination does not exist: '+item['href'])
        if 'specimen' in item and not (root/item['specimen']['src'].lstrip('/')).is_file():
            raise ValueError('Specimen image does not exist: '+item['specimen']['src'])
    return items

def render_cards(root,items,featured):
    rows=[];heading='h3' if featured else 'h2'
    for index,item in enumerate(items,1):
        if featured and not item['featured']:continue
        e={key:html.escape(str(value),quote=True) for key,value in item.items()}
        cover=(root/item['cover']).read_text(encoding='utf-8').strip().replace('{{STATUS}}',e['status'])
        rows.append(f'<a class="project" href="{e["href"]}" data-work data-work-id="{e["id"]}" data-category="{e["category"]}">\n{cover}\n<div class="project-meta"><span>{index:02d} / {e["label"]}</span><span>{e["status"]}</span></div>\n<{heading}>{e["title"]}<span class="arrow" aria-hidden="true">↗</span></{heading}><p>{e["summary"]}</p></a>')
    return '\n'.join(rows)

def replace_block(source,key,body):
    start=f'<!-- studio:{key}:start -->';end=f'<!-- studio:{key}:end -->'
    pattern=re.escape(start)+r'.*?'+re.escape(end)
    if not re.search(pattern,source,re.S):raise ValueError('Missing managed block '+key)
    return re.sub(pattern,lambda m:start+'\n'+body+'\n'+end,source,flags=re.S)

def sync_page(root,path,source):
    rel=path.relative_to(root).as_posix()
    article=bool(re.search(r'<article class="(?:investment|admissions|ai-dev)-article"',source))
    config=json.loads((root/'content/site.json').read_text(encoding='utf-8'))
    youtube=config['youtube_url']
    store=config['store_url']
    if urlsplit(youtube).hostname!='www.youtube.com' or urlsplit(youtube).scheme!='https':raise ValueError('Official YouTube URL must use https://www.youtube.com/')
    store_parts=urlsplit(store)
    if store_parts.scheme!='https' or store_parts.hostname!='naojun-studios.stores.jp':raise ValueError('Official store URL must use https://naojun-studios.stores.jp/')
    header=(root/'_partials/header.html').read_text(encoding='utf-8').strip().replace('{{STORE_URL}}',html.escape(store,quote=True))
    current={'works/index.html':'/works/','about/index.html':'/about/','contact/index.html':'/contact/'}.get(rel)
    if current:header=header.replace(f'href="{current}"',f'href="{current}" aria-current="page"')
    footer=(root/'_partials/footer.html').read_text(encoding='utf-8').strip().replace('{{YOUTUBE_URL}}',html.escape(youtube,quote=True))
    for tag,css,markup in [('header','site-header',header),('footer','site-footer',footer)]:
        pattern=r'<'+tag+r'\b(?=[^>]*\bclass=["\'][^"\']*\b'+css+r'\b)[^>]*>.*?</'+tag+'>'
        if len(re.findall(pattern,source,re.S))!=1:raise ValueError(rel+': expected exactly one shared '+tag)
        source=re.sub(pattern,lambda m:markup,source,count=1,flags=re.S)
    section='investment' if rel.startswith('investment/') else ('ai-dev' if rel.startswith('ai-dev/') else 'admissions')
    if not article and rel in {'investment/index.html','admissions/index.html','ai-dev/index.html'}:
        source=re.sub(r'(<body\b[^>]*\bclass=")([^"]*)(")',lambda m:m[1]+(m[2] if 'edition-'+section in m[2].split() else m[2]+' edition-'+section)+m[3],source,count=1)
    if article:
        def article_body(match):
            tag=match[0];classes=re.search(r'\bclass=(["\'])(.*?)\1',tag)
            required=['studio-site','studio-interior','studio-article','edition-'+section]
            if classes:
                existing=classes[2].split();merged=existing+[c for c in required if c not in existing]
                return tag[:classes.start(2)]+' '.join(merged)+tag[classes.end(2):]
            return tag[:-1]+' class="'+' '.join(required)+'">'
        source=re.sub(r'<body\b[^>]*>',article_body,source,count=1)
        table_index=0
        def accessible_table(match):
            nonlocal table_index
            table_index+=1;tag=match[0]
            if not re.search(r'\btabindex=',tag):tag=tag[:-1]+' tabindex="0">'
            if not re.search(r'\baria-label(?:ledby)?=',tag):tag=tag[:-1]+f' aria-label="表{table_index}（横にスクロールできます）">'
            return tag
        source=re.sub(r'<table\b[^>]*>',accessible_table,source)
        label={'investment':'投資レポート','admissions':'中学受験レポート','ai-dev':'AI開発・セキュリティ日報'}[section]
        if 'class="article-breadcrumb ' not in source:
            crumb=f'<nav class="article-breadcrumb container" aria-label="パンくず"><a href="/">Home</a><span aria-hidden="true">/</span><a href="/{section}/">{label}</a></nav>'
            source=source.replace('<main>','<main>\n'+crumb,1).replace('<main id="main">','<main id="main">\n'+crumb,1)
        source=editorial_article(root,section,rel,source)
    source=source.replace('<main>','<main id="main">',1)
    if 'class="skip-link"' not in source:source=re.sub(r'(<body[^>]*>)',r'\1\n<a class="skip-link" href="#main">本文へスキップ</a>',source,count=1)
    if '/assets/css/studio.css' not in source:source=source.replace('</head>','  <link rel="stylesheet" href="/assets/css/studio.css?v='+VERSION+'">\n</head>',1)
    source=re.sub(r'/assets/css/studio\.css\?v=[^"\s]+','/assets/css/studio.css?v='+VERSION,source)
    # Section sheets may precede this script in older publisher output.
    # Keep the shared editorial layer last in the cascade, including AI-dev.
    if article:
        source=re.sub(r'[ \t]*<link rel="stylesheet" href="/assets/css/studio.css\?v=[^"]+">\n?', '',source)
        source=source.replace('</head>','  <link rel="stylesheet" href="/assets/css/studio.css?v='+VERSION+'">\n</head>',1)
    # Roll out the new first-party event script atomically across generated pages.
    source=re.sub(r'(assets/js/main\.js)(?:\?v=[^"\s]+)?',r'\g<1>?v=20261025a',source)
    if '/assets/js/studio.js' not in source:source=source.replace('</body>','  <script src="/assets/js/studio.js?v=20261004" defer></script>\n</body>',1)
    source=re.sub(r'/assets/js/studio\.js\?v=[^"\s]+','/assets/js/studio.js?v='+VERSION,source)
    if rel=='index.html':
        items=load_works(root)
        source=replace_block(source,'featured',render_cards(root,[item for item in items if item['id']!='koechara'],True))
        spotlight=next(w for w in items if w['id']==config['spotlight_id'])
        if 'studio:frontcover:start' in source:source=replace_block(source,'frontcover',front_cover(root,items,spotlight))
        if 'studio:editions:start' in source:source=replace_block(source,'editions',editions(root))
        by_url={item['href']:item for item in items}
        def utility(match):
            item=by_url.get('/'+match[1].lstrip('/') if not match[1].startswith('https://') else match[1])
            if not item:raise ValueError('Home utility missing from work registry: '+match[1])
            card=re.sub(r'<h3>.*?</h3>',lambda m:'<h3>'+html.escape(item['title'])+'</h3>',match[0],flags=re.S)
            return re.sub(r'<p>.*?</p>',lambda m:'<p>'+html.escape(item['summary'])+'</p>',card,flags=re.S)
        source=re.sub(r'<a class="utility" href="([^"]+)">.*?</a>',utility,source,flags=re.S)
        channel=f'<section class="studio-channel container" aria-labelledby="channel-title"><div><span class="section-index">FILM / YOUTUBE</span><h2 id="channel-title">映像でも、NAOJUN STUDIOSを。</h2></div><a class="arrow-link" href="{html.escape(youtube,quote=True)}" target="_blank" rel="noopener noreferrer">YouTubeチャンネルへ<span class="arrow" aria-hidden="true">↗</span><span class="sr-only">（新しいタブ）</span></a></section>'
        if 'studio:channel:start' in source:source=replace_block(source,'channel',channel)
        else:source=source.replace('<section class="journal-section"',f'<!-- studio:channel:start -->\n{channel}\n<!-- studio:channel:end -->\n<section class="journal-section"',1)
    if rel=='works/index.html':
        items=load_works(root)
        source=replace_block(source,'catalogue',render_cards(root,items,False))
        source=re.sub(r'\d+ WORKS / ALWAYS GROWING',f'{len(items):02d} WORKS / ALWAYS GROWING',source)
        source=re.sub(r'(<p class="work-count"[^>]*>)\d+ 件の作品',lambda m:m[1]+f'{len(items)} 件の作品',source)
        categories={'companion':'アプリ','game':'ゲーム','tool':'ツール','research':'読み物','film':'映像'}
        filters='<button data-filter="all" aria-pressed="true">すべて</button>'+''.join(f'<button data-filter="{k}" aria-pressed="false">{v}</button>' for k,v in categories.items() if any(w['category']==k for w in items))
        source=re.sub(r'(<div class="work-filters"[^>]*>).*?(</div>)',lambda m:m[1]+filters+m[2],source,count=1,flags=re.S)
    return source

def pages(root):
    paths=set()
    for path in root.rglob('*.html'):
        rel=path.relative_to(root)
        if any(p in {'.git','node_modules','tests','_partials','_templates'} for p in rel.parts):continue
        source=path.read_text(encoding='utf-8')
        if 'studio-site' in source or re.search(r'<article class="(?:investment|admissions|ai-dev)-article"',source):paths.add(path)
    for section in ['investment','admissions','ai-dev']:
        for item in json.loads((root/section/'feed.json').read_text(encoding='utf-8'))['entries']:
            path=root/section/item['path'].strip('/')/'index.html'
            if not path.is_file():raise ValueError('Missing article '+str(path))
            paths.add(path)
    return sorted(paths)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    load_works(ROOT);changed=[]
    for path in pages(ROOT):
        source=path.read_text(encoding='utf-8');desired=sync_page(ROOT,path,source)
        if source!=desired:
            changed.append(path.relative_to(ROOT).as_posix())
            if not args.check:path.write_text(desired,encoding='utf-8',newline='\n')
    print(json.dumps({'changed':changed,'count':len(changed),'checked':len(pages(ROOT))},ensure_ascii=False))
    if args.check and changed:raise SystemExit('Run python scripts/sync_studio.py and commit the generated HTML.')

if __name__=='__main__':main()
