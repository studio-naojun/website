"""Static integrity checks for the redesigned public entry points."""
from html.parser import HTMLParser
import re
from pathlib import Path
from urllib.parse import urlsplit, unquote
from sync_studio import pages
ROOT=Path(__file__).resolve().parents[1]
PAGES=[p.relative_to(ROOT).as_posix() for p in pages(ROOT) if '_templates' not in p.parts]
class Page(HTMLParser):
    def __init__(self,text):
        super().__init__();self.refs=[];self.ids=[];self.h1=0;self.images=[];self.feed(text)
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a:self.ids.append(a['id'])
        if tag=='h1':self.h1+=1
        if tag=='img':self.images.append(a)
        for key in ['href','src']:
            if key in a:self.refs.append((tag,a[key]))
errors=[];links=0
for rel in PAGES:
    path=ROOT/rel;source=path.read_text(encoding='utf-8');p=Page(source)
    if re.search(r'\{\{[A-Z][A-Z0-9_]*\}\}',source):errors.append(f'{rel}: unfilled template placeholder')
    if p.h1!=1:errors.append(f'{rel}: expected one h1, got {p.h1}')
    if len(p.ids)!=len(set(p.ids)):errors.append(f'{rel}: duplicate ids')
    for im in p.images:
        if not all(k in im for k in ['alt','width','height']):errors.append(f'{rel}: image missing dimensions or alternative text: {im.get("src")}')
    for tag,ref in p.refs:
        u=urlsplit(ref)
        if u.scheme or u.netloc:continue
        target=(ROOT/unquote(u.path).lstrip('/')) if u.path.startswith('/') else (path.parent/unquote(u.path)) if u.path else path
        if target.is_dir():target=target/'index.html'
        if not target.exists():errors.append(f'{rel}: missing {ref}');continue
        links+=1
        if u.fragment and target.suffix=='.html':
            destination=Page(target.read_text(encoding='utf-8'))
            if unquote(u.fragment) not in destination.ids:errors.append(f'{rel}: missing anchor {ref}')
if errors:raise SystemExit('\n'.join(errors))
print(f'PASS {len(PAGES)} pages: {links} internal references, unique IDs, heading landmarks, image alt/dimensions.')
