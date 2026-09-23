from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SITE_URL = "https://naojun.jp"
INDEXNOW_KEY = "6d6cf95c8e504bc9a92b2b73283c9d65"
MARKER_START = "<!-- naojun-discovery:start -->"
MARKER_END = "<!-- naojun-discovery:end -->"
EXCLUDED_PARTS = {
    ".git",
    ".github",
    "_templates",
    "feedback-gas",
    "node_modules",
    "tests",
}


def extract(pattern: str, source: str) -> str:
    match = re.search(pattern, source, flags=re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return html.unescape(re.sub(r"\s+", " ", match.group(1)).strip())


def page_url(path: Path) -> str:
    rel = path.relative_to(ROOT).parent.as_posix()
    return SITE_URL + ("/" if rel == "." else f"/{rel}/")


def load_article_entries() -> tuple[dict[str, dict[str, str]], list[dict[str, str]], str]:
    by_url: dict[str, dict[str, str]] = {}
    entries: list[dict[str, str]] = []
    updated_values: list[str] = []

    for section in ("admissions", "investment"):
        feed_path = ROOT / section / "feed.json"
        if not feed_path.exists():
            continue
        payload = json.loads(feed_path.read_text(encoding="utf-8"))
        updated = str(payload.get("updated_at", ""))
        if updated:
            updated_values.append(updated)
        for raw in payload.get("entries", []):
            if not isinstance(raw, dict):
                continue
            path = str(raw.get("path", "")).strip("/")
            if not path:
                continue
            item = {
                "section": section,
                "id": str(raw.get("id", "")),
                "type": str(raw.get("type", "article")),
                "published_at": str(raw.get("published_at", "")),
                "title": str(raw.get("title", "")),
                "summary": str(raw.get("summary", "")),
                "url": f"{SITE_URL}/{section}/{path}/",
            }
            by_url[item["url"]] = item
            entries.append(item)

    entries.sort(key=lambda item: (item["published_at"], item["url"]), reverse=True)
    updated_at = max(updated_values) if updated_values else ""
    return by_url, entries, updated_at


def iter_index_pages() -> list[Path]:
    pages: list[Path] = []
    for path in ROOT.rglob("index.html"):
        rel = path.relative_to(ROOT)
        if any(part in EXCLUDED_PARTS for part in rel.parts):
            continue
        source = path.read_text(encoding="utf-8")
        robots = extract(r'<meta\s+name=["\']robots["\'][^>]+content=["\']([^"\']+)["\']', source)
        if "noindex" in robots.lower():
            continue
        pages.append(path)
    return sorted(pages)


def discovery_block(url: str, title: str, description: str, article: dict[str, str] | None) -> str:
    page_type = "article" if article else "website"
    structured: dict[str, object]
    if article:
        structured = {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": article["title"] or title,
            "description": article["summary"] or description,
            "datePublished": article["published_at"],
            "mainEntityOfPage": url,
            "publisher": {"@type": "Organization", "name": "Studio NaoJun", "url": SITE_URL + "/"},
        }
    elif url == SITE_URL + "/":
        structured = {
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Studio NaoJun",
            "url": SITE_URL + "/",
            "inLanguage": "ja",
        }
    else:
        structured = {
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "description": description,
            "url": url,
            "isPartOf": {"@type": "WebSite", "name": "Studio NaoJun", "url": SITE_URL + "/"},
            "inLanguage": "ja",
        }

    json_ld = json.dumps(structured, ensure_ascii=False, separators=(",", ":"))
    esc_title = html.escape(title, quote=True)
    esc_description = html.escape(description, quote=True)
    esc_url = html.escape(url, quote=True)
    return "\n".join(
        [
            MARKER_START,
            f'  <link rel="canonical" href="{esc_url}">',
            '  <link rel="alternate" type="application/atom+xml" title="Studio NaoJun updates" href="https://naojun.jp/feed.xml">',
            f'  <meta property="og:type" content="{page_type}">',
            '  <meta property="og:site_name" content="Studio NaoJun">',
            f'  <meta property="og:title" content="{esc_title}">',
            f'  <meta property="og:description" content="{esc_description}">',
            f'  <meta property="og:url" content="{esc_url}">',
            '  <meta name="twitter:card" content="summary">',
            f'  <script type="application/ld+json">{json_ld}</script>',
            MARKER_END,
        ]
    )


def with_discovery_metadata(source: str, url: str, article: dict[str, str] | None) -> str:
    title = extract(r"<title>(.*?)</title>", source) or "Studio NaoJun"
    description = extract(
        r'<meta\s+name=["\']description["\'][^>]+content=["\']([^"\']*)["\']',
        source,
    )
    if article:
        title = article["title"] or title
        description = article["summary"] or description

    block = discovery_block(url, title, description, article)
    if MARKER_START in source and MARKER_END in source:
        source = re.sub(
            re.escape(MARKER_START) + r".*?" + re.escape(MARKER_END),
            block,
            source,
            count=1,
            flags=re.DOTALL,
        )
    else:
        source = source.replace("</head>", block + "\n</head>", 1)
    return source


def build_sitemap(pages: list[tuple[str, dict[str, str] | None]]) -> str:
    rows = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ]
    for url, article in pages:
        rows.append("  <url>")
        rows.append(f"    <loc>{html.escape(url)}</loc>")
        if article and article.get("published_at"):
            rows.append(f"    <lastmod>{html.escape(article['published_at'])}</lastmod>")
        rows.append("  </url>")
    rows.append("</urlset>")
    return "\n".join(rows) + "\n"


def build_feed(entries: list[dict[str, str]], updated_at: str) -> str:
    if not updated_at and entries:
        updated_at = entries[0]["published_at"] + "T00:00:00+09:00"
    rows = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="ja">',
        "  <title>Studio NaoJun updates</title>",
        f"  <id>{SITE_URL}/feed.xml</id>",
        f'  <link rel="self" href="{SITE_URL}/feed.xml"/>',
        f'  <link rel="alternate" href="{SITE_URL}/"/>',
        '  <link rel="hub" href="https://pubsubhubbub.appspot.com/"/>',
        f"  <updated>{html.escape(updated_at)}</updated>",
    ]
    for item in entries[:50]:
        published = item["published_at"]
        updated = published + "T00:00:00+09:00" if published else updated_at
        rows.extend(
            [
                "  <entry>",
                f"    <title>{html.escape(item['title'])}</title>",
                f"    <id>{html.escape(item['url'])}</id>",
                f'    <link href="{html.escape(item["url"], quote=True)}"/>',
                f"    <updated>{html.escape(updated)}</updated>",
                f"    <published>{html.escape(updated)}</published>",
                f'    <category term="{html.escape(item["section"])}"/>',
                f"    <summary>{html.escape(item['summary'])}</summary>",
                "  </entry>",
            ]
        )
    rows.append("</feed>")
    return "\n".join(rows) + "\n"


def desired_files() -> dict[Path, str]:
    article_by_url, entries, updated_at = load_article_entries()
    outputs: dict[Path, str] = {}
    sitemap_pages: list[tuple[str, dict[str, str] | None]] = []

    for page in iter_index_pages():
        url = page_url(page)
        article = article_by_url.get(url)
        source = page.read_text(encoding="utf-8")
        outputs[page] = with_discovery_metadata(source, url, article)
        sitemap_pages.append((url, article))

    sitemap_pages.sort(key=lambda row: row[0])
    outputs[ROOT / "sitemap.xml"] = build_sitemap(sitemap_pages)
    outputs[ROOT / "feed.xml"] = build_feed(entries, updated_at)
    outputs[ROOT / "robots.txt"] = (
        "User-agent: *\n"
        "Allow: /\n\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n"
    )
    outputs[ROOT / f"{INDEXNOW_KEY}.txt"] = INDEXNOW_KEY + "\n"
    return outputs


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="fail if generated discovery files are stale")
    args = parser.parse_args()

    changed: list[str] = []
    for path, desired in desired_files().items():
        current = path.read_text(encoding="utf-8") if path.exists() else None
        if current == desired:
            continue
        changed.append(path.relative_to(ROOT).as_posix())
        if not args.check:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(desired, encoding="utf-8", newline="\n")

    if args.check and changed:
        print("Discovery artifacts are stale:", file=sys.stderr)
        for item in changed:
            print(f"  {item}", file=sys.stderr)
        return 1

    print(json.dumps({"changed": changed, "count": len(changed)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
