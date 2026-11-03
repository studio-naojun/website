"""Materialize shared NaoJun chrome/catalogue into static HTML; --check never writes."""
import argparse
import html
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
VERSION='20261103a'

SECTIONS={'investment':'投資レポート','admissions':'中学受験レポート','ai-dev':'AI開発・セキュリティ日報'}

def feed_entries(root,section):
    return sorted(json.loads((root/section/'feed.json').read_text(encoding='utf-8'))['entries'],key=lambda e:(e['published_at'],e['path']),reverse=True)

def entry_link(section,item,summary=False):
    e=lambda value:html.escape(str(value),quote=True)
    return (f'<a class="reading-entry" href="/{section}/{e(item["path"].strip("/"))}/">'
            f'<time datetime="{e(item["published_at"])}">{e(item["published_at"])}</time>'
            f'<h3>{e(item["title"])}</h3>'
            +(f'<p>{e(item["summary"])}</p>' if summary else '')
            +'<span class="entry-arrow" aria-hidden="true">↗</span></a>')

def editorial_article(root,section,rel,source):
    # Remove only our generated shell before rebuilding. Published prose stays intact.
    source=re.sub(r'<!-- studio:reading:start -->.*?<!-- studio:reading:body -->\n?', '',source,flags=re.S)
    source=re.sub(r'\n?<!-- studio:reading:tail -->.*?<!-- studio:reading:end -->', '',source,flags=re.S)
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
    toc=(f'<aside class="reading-rail"><details class="reading-toc" open><summary>このページの内容<span class="toc-count">{len(headings)}項目</span></summary>'
         f'<nav aria-label="記事の目次"><ol>{links}</ol></nav></details><a class="rail-back" href="/{section}/">← {SECTIONS[section]}一覧</a></aside>') if headings else ''
    entries=[e for e in feed_entries(root,section) if f'{section}/{e["path"].strip("/")}/index.html'!=rel]
    current=next((e for e in feed_entries(root,section) if f'{section}/{e["path"].strip("/")}/index.html'==rel),None)
    older=[e for e in entries if current and e['published_at']<=current['published_at']]
    related=(older or entries)[:1]
    footer=f'<footer class="reading-footer"><p class="reading-end">読み終えたら、もうひとつ。</p>'+''.join(entry_link(section,e) for e in related)+f'<a class="arrow-link" href="/{section}/">{SECTIONS[section]}一覧へ <span aria-hidden="true">↗</span></a></footer>'
    shell='<!-- studio:reading:start -->\n<div class="reading-layout container">'+toc+'\n<!-- studio:reading:body -->\n'+article+'\n<!-- studio:reading:tail -->\n'+footer+'</div>\n<!-- studio:reading:end -->'
    return source[:match.start()]+shell+source[match.end():]

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

def load_works(root):
    items=json.loads((root/'content/works.json').read_text(encoding='utf-8'))
    validate_works(items)
    for item in items:
        cover=(root/item['cover']).resolve()
        if not cover.is_relative_to((root/'_partials/covers').resolve()) or not cover.is_file():
            raise ValueError('Cover must exist under _partials/covers: '+item['cover'])
        if item['href'].startswith('/') and not (root/item['href'].strip('/')/'index.html').exists():
            raise ValueError('Work destination does not exist: '+item['href'])
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
    if article:
        def article_body(match):
            tag=match[0];classes=re.search(r'\bclass=(["\'])(.*?)\1',tag)
            required=['studio-site','studio-interior','studio-article']
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
        section='investment' if rel.startswith('investment/') else ('ai-dev' if rel.startswith('ai-dev/') else 'admissions')
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
        if 'studio:make:start' in source:
            specimen=next(item for item in items if item['id']=='koechara')
            e={key:html.escape(str(value),quote=True) for key,value in specimen.items()}
            cover=(root/specimen['cover']).read_text(encoding='utf-8')
            art=re.search(r'<img\b[^>]*>',cover)[0].replace(' loading="lazy"','')
            art=art[:-1]+' fetchpriority="high">'
            source=replace_block(source,'make',f'<a class="make-specimen" href="{e["href"]}"><div class="specimen-image">{art}</div><div class="specimen-caption"><div><h2 id="make-title">{e["title"]}</h2><p>{e["summary"]}</p></div><span aria-hidden="true">↗</span></div></a><p class="specimen-note">{e["status"]} <a href="/works/">すべての作品を見る →</a></p>')
        if 'studio:observe:start' in source:
            latest=[(s,entries[0]) for s in SECTIONS if (entries:=feed_entries(root,s))]
            observe='<h2 class="lens-label">OBSERVE <span>観測する・読む</span></h2>'
            if latest:
                section,item=max(latest,key=lambda pair:pair[1]['published_at'])
                observe+=f'<p class="observe-category">{SECTIONS[section]}</p>'+entry_link(section,item,True)+f'<a class="observe-all" href="/{section}/">この分野の記事一覧へ →</a>'
            else:observe+='<p>公開記事を準備しています。</p><a class="observe-all" href="#journal">読みものの分野を見る →</a>'
            source=replace_block(source,'observe',observe)
        if 'studio:journal:start' in source:
            rows=[]
            for section,label in SECTIONS.items():
                entries=feed_entries(root,section)
                if entries:rows.append(f'<section class="journal-lane"><div class="journal-lane-head"><h3>{label}</h3><a href="{section}/">一覧へ ↗</a></div>'+entry_link(section,entries[0])+'</section>')
            source=replace_block(source,'journal','\n'.join(rows))
        by_url={item['href']:item for item in items}
        def utility(match):
            item=by_url.get('/'+match[1].lstrip('/') if not match[1].startswith('https://') else match[1])
            if not item:raise ValueError('Home utility missing from work registry: '+match[1])
            card=re.sub(r'<h3>.*?</h3>',lambda m:'<h3>'+html.escape(item['title'])+'</h3>',match[0],flags=re.S)
            return re.sub(r'<p>.*?</p>',lambda m:'<p>'+html.escape(item['summary'])+'</p>',card,flags=re.S)
        source=re.sub(r'<a class="utility" href="([^"]+)">.*?</a>',utility,source,flags=re.S)
        spotlight=next(w for w in items if w['id']==config['spotlight_id'])
        source=re.sub(r'(<div class="hero-strip"><div><strong>).*?(</strong>)',lambda m:m[1]+html.escape(spotlight['title'])+m[2],source,count=1)
        source=re.sub(r'(<div class="hero-strip">.*?<span class="mono">).*?(</span><a href=")[^"]+("[^>]*>)',lambda m:m[1]+html.escape(spotlight['status'])+m[2]+html.escape(spotlight['href'],quote=True)+m[3],source,count=1,flags=re.S)
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
