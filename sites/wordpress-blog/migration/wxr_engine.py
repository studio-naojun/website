from __future__ import annotations

import csv
import hashlib
import html
import json
import os
import posixpath
import re
import shutil
import tempfile
import unicodedata
import urllib.parse
import xml.etree.ElementTree as ET
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable


BLOCKED_CONTENT_TAGS = {"script", "style", "template"}
ACTIVE_OR_REVIEW_TAGS = {"iframe", "form", "object", "embed", "svg", "canvas", "video", "audio"}
ALLOWED_TAGS = {
    "a", "abbr", "b", "blockquote", "br", "caption", "code", "col", "colgroup",
    "dd", "del", "details", "div", "dl", "dt", "em", "figcaption", "figure", "h1",
    "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "mark",
    "ol", "p", "pre", "q", "s", "samp", "small", "span", "strong", "sub", "summary",
    "sup", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
}
VOID_TAGS = {"br", "hr", "img", "col"}
GLOBAL_ATTRS = {"class", "id", "title", "lang", "dir"}
TAG_ATTRS = {
    "a": {"href"},
    "img": {"src", "alt", "width", "height", "loading", "decoding"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan", "scope"},
    "col": {"span"},
}
URL_ATTRS = {"href", "src"}
SHORTCODE_RE = re.compile(r"\[(?:/?)[A-Za-z][^\]\n]{0,300}\]")


def local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def find_child(element: ET.Element, name: str, namespace_contains: str | None = None) -> ET.Element | None:
    for child in element:
        if local_name(child.tag) != name:
            continue
        if namespace_contains and namespace_contains not in child.tag:
            continue
        return child
    return None


def child_text(element: ET.Element, name: str, namespace_contains: str | None = None) -> str:
    child = find_child(element, name, namespace_contains)
    return (child.text or "") if child is not None else ""


def safe_int(value: str | None) -> int | None:
    if value is None:
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


class PlainTextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip_depth = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag in BLOCKED_CONTENT_TAGS:
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag in {"br", "p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"}:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in BLOCKED_CONTENT_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.skip_depth:
            return
        if tag in {"p", "div", "li", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"}:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(data)


def normalize_plain_text(markup: str) -> str:
    parser = PlainTextExtractor()
    parser.feed(markup or "")
    parser.close()
    text = html.unescape("".join(parser.parts)).replace("\u00a0", " ")
    text = unicodedata.normalize("NFC", text)
    return re.sub(r"\s+", " ", text).strip()


def sanitize_url(value: str, *, image: bool = False) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    if value.startswith(("#", "/", "./", "../")):
        return value
    parsed = urllib.parse.urlsplit(value)
    scheme = parsed.scheme.lower()
    allowed = {"http", "https"} if image else {"http", "https", "mailto", "tel"}
    if scheme in allowed:
        return value
    return None


class Sanitizer(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=False)
        self.parts: list[str] = []
        self.flags: set[str] = set()
        self.skip_depth = 0

    def _attrs(self, tag: str, attrs) -> str:
        allowed = GLOBAL_ATTRS | TAG_ATTRS.get(tag, set())
        rendered: list[str] = []
        for key, value in attrs:
            key = key.lower()
            if key not in allowed or key.startswith("on"):
                continue
            if value is None:
                continue
            if key in URL_ATTRS:
                safe = sanitize_url(value, image=(tag == "img" and key == "src"))
                if safe is None:
                    self.flags.add(f"blocked_url:{tag}:{key}")
                    continue
                value = safe
            rendered.append(f' {key}="{html.escape(value, quote=True)}"')
        return "".join(rendered)

    def handle_starttag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag in BLOCKED_CONTENT_TAGS:
            self.flags.add(f"blocked_tag:{tag}")
            self.skip_depth += 1
            return
        if self.skip_depth:
            return
        if tag in ACTIVE_OR_REVIEW_TAGS:
            self.flags.add(f"review_tag:{tag}")
            return
        if tag not in ALLOWED_TAGS:
            self.flags.add(f"dropped_tag:{tag}")
            return
        self.parts.append(f"<{tag}{self._attrs(tag, attrs)}>")

    def handle_startendtag(self, tag: str, attrs) -> None:
        tag = tag.lower()
        if tag in BLOCKED_CONTENT_TAGS or tag in ACTIVE_OR_REVIEW_TAGS:
            self.flags.add(f"review_tag:{tag}")
            return
        if tag not in ALLOWED_TAGS:
            self.flags.add(f"dropped_tag:{tag}")
            return
        self.parts.append(f"<{tag}{self._attrs(tag, attrs)}>")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag in BLOCKED_CONTENT_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if self.skip_depth:
            return
        if tag in ACTIVE_OR_REVIEW_TAGS or tag not in ALLOWED_TAGS or tag in VOID_TAGS:
            return
        self.parts.append(f"</{tag}>")

    def handle_data(self, data: str) -> None:
        if not self.skip_depth:
            self.parts.append(html.escape(data, quote=False))

    def handle_entityref(self, name: str) -> None:
        if not self.skip_depth:
            self.parts.append(f"&{name};")

    def handle_charref(self, name: str) -> None:
        if not self.skip_depth:
            self.parts.append(f"&#{name};")


def sanitize_html(markup: str) -> tuple[str, list[str]]:
    parser = Sanitizer()
    parser.feed(markup or "")
    parser.close()
    flags = set(parser.flags)
    if SHORTCODE_RE.search(markup or ""):
        flags.add("review_shortcode")
    return "".join(parser.parts), sorted(flags)


@dataclass
class Comment:
    legacy_comment_id: int | None
    parent_legacy_comment_id: int | None
    author_display_name: str
    comment_body: str
    created_at: str
    created_at_gmt: str
    wordpress_status: str
    comment_type: str

    @property
    def normalized_text(self) -> str:
        return normalize_plain_text(self.comment_body)

    def to_private_record(self, legacy_post_id: int | None, post_slug: str) -> dict:
        normalized = self.normalized_text
        return {
            "legacy_comment_id": self.legacy_comment_id,
            "legacy_post_id": legacy_post_id,
            "post_slug": post_slug,
            "parent_legacy_comment_id": self.parent_legacy_comment_id,
            "author_display_name": self.author_display_name,
            "comment_body": self.comment_body,
            "created_at": self.created_at,
            "created_at_gmt": self.created_at_gmt,
            "wordpress_status": self.wordpress_status,
            "comment_type": self.comment_type,
            "raw_chars": len(self.comment_body),
            "normalized_plain_text_chars": len(normalized),
            "normalized_plain_text_sha256": sha256_text(normalized),
        }


@dataclass
class Item:
    legacy_post_id: int | None
    post_type: str
    status: str
    title: str
    slug: str
    link: str
    guid: str
    pub_date: str
    post_date: str
    post_date_gmt: str
    modified_date: str
    modified_date_gmt: str
    content: str
    excerpt: str
    attachment_url: str
    categories: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)
    comments: list[Comment] = field(default_factory=list)
    postmeta: dict[str, list[str]] = field(default_factory=dict)

    @property
    def normalized_text(self) -> str:
        return normalize_plain_text(self.content)


@dataclass
class WxrDocument:
    source_title: str
    source_link: str
    base_site_url: str
    base_blog_url: str
    wxr_version: str
    items: list[Item]


def _parse_comment(node: ET.Element) -> Comment:
    return Comment(
        legacy_comment_id=safe_int(child_text(node, "comment_id")),
        parent_legacy_comment_id=safe_int(child_text(node, "comment_parent")),
        author_display_name=child_text(node, "comment_author"),
        comment_body=child_text(node, "comment_content"),
        created_at=child_text(node, "comment_date"),
        created_at_gmt=child_text(node, "comment_date_gmt"),
        wordpress_status=child_text(node, "comment_approved"),
        comment_type=child_text(node, "comment_type"),
    )


def _parse_item(node: ET.Element) -> Item:
    categories: list[str] = []
    tags: list[str] = []
    comments: list[Comment] = []
    postmeta: dict[str, list[str]] = {}
    for child in node:
        name = local_name(child.tag)
        if name == "category":
            domain = (child.attrib.get("domain") or "").lower()
            value = child.text or ""
            if domain == "post_tag":
                tags.append(value)
            elif domain == "category":
                categories.append(value)
        elif name == "comment":
            comments.append(_parse_comment(child))
        elif name == "postmeta":
            key = child_text(child, "meta_key")
            value = child_text(child, "meta_value")
            if key:
                postmeta.setdefault(key, []).append(value)

    content = child_text(node, "encoded", "content")
    excerpt = child_text(node, "encoded", "excerpt")
    return Item(
        legacy_post_id=safe_int(child_text(node, "post_id")),
        post_type=child_text(node, "post_type") or "post",
        status=child_text(node, "status"),
        title=child_text(node, "title"),
        slug=child_text(node, "post_name"),
        link=child_text(node, "link"),
        guid=child_text(node, "guid"),
        pub_date=child_text(node, "pubDate"),
        post_date=child_text(node, "post_date"),
        post_date_gmt=child_text(node, "post_date_gmt"),
        modified_date=child_text(node, "post_modified"),
        modified_date_gmt=child_text(node, "post_modified_gmt"),
        content=content,
        excerpt=excerpt,
        attachment_url=child_text(node, "attachment_url"),
        categories=categories,
        tags=tags,
        comments=comments,
        postmeta=postmeta,
    )


def parse_wxr(path: Path) -> WxrDocument:
    tree = ET.parse(path)
    root = tree.getroot()
    channel = next((node for node in root if local_name(node.tag) == "channel"), None)
    if channel is None:
        raise ValueError("WXR/RSS channel was not found")
    items = [_parse_item(node) for node in channel if local_name(node.tag) == "item"]
    return WxrDocument(
        source_title=child_text(channel, "title"),
        source_link=child_text(channel, "link"),
        base_site_url=child_text(channel, "base_site_url"),
        base_blog_url=child_text(channel, "base_blog_url"),
        wxr_version=child_text(channel, "wxr_version"),
        items=items,
    )


def legacy_public_path(item: Item) -> str:
    raw_path = urllib.parse.urlsplit(item.link).path if item.link else ""
    if not raw_path or raw_path == "/":
        slug = item.slug or f"legacy-{item.legacy_post_id or 'unknown'}"
        raw_path = f"/{slug}/"
    decoded = urllib.parse.unquote(raw_path)
    decoded = re.sub(r"[\x00-\x1f\x7f]", "", decoded)
    trailing = decoded.endswith("/")
    normalized = posixpath.normpath("/" + decoded.lstrip("/"))
    if normalized.startswith("/../") or normalized == "/..":
        raise ValueError(f"Unsafe legacy URL path: {raw_path}")
    if trailing and normalized != "/":
        normalized += "/"
    return normalized


def path_to_output_file(public_root: Path, public_path: str) -> Path:
    if public_path.endswith("/"):
        rel = public_path.lstrip("/") + "index.html"
    else:
        rel = public_path.lstrip("/")
        if not Path(rel).suffix:
            rel += "/index.html"
    destination = (public_root / rel).resolve()
    root = public_root.resolve()
    if root not in destination.parents and destination != root:
        raise ValueError(f"Output escaped public root: {public_path}")
    return destination


def _html_page(item: Item, sanitized_content: str, public_path: str) -> str:
    title = html.escape(item.title or item.slug or "Untitled")
    published = html.escape(item.post_date or item.pub_date)
    categories = ", ".join(html.escape(v) for v in item.categories)
    tags = ", ".join(html.escape(v) for v in item.tags)
    meta_bits = [bit for bit in [published, categories, tags] if bit]
    meta = " / ".join(meta_bits)
    return f"""<!doctype html>
<html lang=\"ja\">
<head>
  <meta charset=\"utf-8\">
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">
  <title>{title}</title>
  <meta name=\"robots\" content=\"noindex,nofollow\">
</head>
<body>
  <main>
    <article data-legacy-post-id=\"{item.legacy_post_id or ''}\" data-legacy-path=\"{html.escape(public_path, quote=True)}\">
      <header><h1>{title}</h1><p>{meta}</p></header>
      <!-- LEGACY_CONTENT_START -->{sanitized_content}<!-- LEGACY_CONTENT_END -->
    </article>
  </main>
</body>
</html>
"""


def _index_page(records: list[dict]) -> str:
    ordered = sorted(records, key=lambda row: row.get("post_date") or "", reverse=True)
    items = "\n".join(
        f'<li><a href="{html.escape(row["public_path"], quote=True)}">{html.escape(row["title"] or row["slug"] or "Untitled")}</a></li>'
        for row in ordered
        if row["post_type"] == "post"
    )
    return f"""<!doctype html>
<html lang=\"ja\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Migrated Blog Preview</title><meta name=\"robots\" content=\"noindex,nofollow\"></head>
<body><main><h1>Migrated Blog Preview</h1><ul>{items}</ul></main></body></html>
"""


def _write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _status_counts(items: Iterable[Item]) -> dict[str, int]:
    return dict(sorted(Counter(item.status or "(empty)" for item in items).items()))


def build_bundle(source: Path, output_dir: Path) -> dict:
    doc = parse_wxr(source)
    output_dir = output_dir.resolve()
    if output_dir.exists():
        shutil.rmtree(output_dir)
    (output_dir / "public").mkdir(parents=True)
    (output_dir / "private").mkdir(parents=True)

    public_records: list[dict] = []
    inventory: list[dict] = []
    private_comments: list[dict] = []
    media_manifest: list[dict] = []
    warnings: list[dict] = []
    seen_public_paths: dict[str, int | None] = {}

    content_items = [item for item in doc.items if item.post_type in {"post", "page"}]
    all_comments = [comment for item in doc.items for comment in item.comments]

    for item in doc.items:
        normalized = item.normalized_text
        record = {
            "legacy_post_id": item.legacy_post_id,
            "post_type": item.post_type,
            "status": item.status,
            "title": item.title,
            "slug": item.slug,
            "legacy_url": item.link,
            "guid": item.guid,
            "post_date": item.post_date,
            "post_date_gmt": item.post_date_gmt,
            "modified_date": item.modified_date,
            "modified_date_gmt": item.modified_date_gmt,
            "categories": item.categories,
            "tags": item.tags,
            "raw_content_chars": len(item.content),
            "normalized_plain_text_chars": len(normalized),
            "normalized_plain_text_sha256": sha256_text(normalized),
            "comments_total": len(item.comments),
        }
        inventory.append(record)

        for comment in item.comments:
            private_comments.append(comment.to_private_record(item.legacy_post_id, item.slug))

        if item.post_type == "attachment":
            source_url = item.attachment_url or item.guid or item.link
            media_manifest.append({
                "legacy_post_id": item.legacy_post_id,
                "source_url": source_url,
                "legacy_url": item.link,
                "title": item.title,
                "attached_file": (item.postmeta.get("_wp_attached_file") or [""])[0],
            })
            continue

        if item.post_type not in {"post", "page"}:
            warnings.append({"legacy_post_id": item.legacy_post_id, "code": "unsupported_post_type", "detail": item.post_type})
            continue
        if item.status != "publish":
            continue

        public_path = legacy_public_path(item)
        if public_path in seen_public_paths:
            warnings.append({
                "legacy_post_id": item.legacy_post_id,
                "code": "public_path_collision",
                "detail": public_path,
                "other_legacy_post_id": seen_public_paths[public_path],
            })
            continue
        seen_public_paths[public_path] = item.legacy_post_id

        sanitized, flags = sanitize_html(item.content)
        sanitized_normalized = normalize_plain_text(sanitized)
        if sha256_text(sanitized_normalized) != sha256_text(normalized):
            flags.append("normalized_text_changed_after_sanitize")
        for flag in sorted(set(flags)):
            warnings.append({"legacy_post_id": item.legacy_post_id, "code": flag, "detail": public_path})

        destination = path_to_output_file(output_dir / "public", public_path)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text(_html_page(item, sanitized, public_path), encoding="utf-8")
        public_records.append({**record, "public_path": public_path, "output_file": str(destination.relative_to(output_dir))})

    (output_dir / "public" / "index.html").write_text(_index_page(public_records), encoding="utf-8")

    private_path = output_dir / "private" / "comments.jsonl"
    with private_path.open("w", encoding="utf-8") as handle:
        for row in private_comments:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    redirects_path = output_dir / "redirects.csv"
    with redirects_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["legacy_url", "public_path", "legacy_post_id"])
        writer.writeheader()
        for row in public_records:
            writer.writerow({"legacy_url": row["legacy_url"], "public_path": row["public_path"], "legacy_post_id": row["legacy_post_id"]})

    _write_json(output_dir / "inventory.json", inventory)
    _write_json(output_dir / "public-manifest.json", public_records)
    _write_json(output_dir / "media-manifest.json", media_manifest)

    report = {
        "schema_version": 1,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": {
            "file_name": source.name,
            "title": doc.source_title,
            "source_link": doc.source_link,
            "base_site_url": doc.base_site_url,
            "base_blog_url": doc.base_blog_url,
            "wxr_version": doc.wxr_version,
        },
        "source_counts": {
            "items_total": len(doc.items),
            "posts_total": sum(1 for item in doc.items if item.post_type == "post"),
            "pages_total": sum(1 for item in doc.items if item.post_type == "page"),
            "attachments_total": sum(1 for item in doc.items if item.post_type == "attachment"),
            "other_items_total": sum(1 for item in doc.items if item.post_type not in {"post", "page", "attachment"}),
            "published_posts_total": sum(1 for item in doc.items if item.post_type == "post" and item.status == "publish"),
            "published_pages_total": sum(1 for item in doc.items if item.post_type == "page" and item.status == "publish"),
            "comments_total": len(all_comments),
            "approved_comments_total": sum(1 for c in all_comments if c.wordpress_status == "1"),
            "content_raw_chars": sum(len(item.content) for item in content_items),
            "content_normalized_plain_text_chars": sum(len(item.normalized_text) for item in content_items),
            "comments_raw_chars": sum(len(c.comment_body) for c in all_comments),
            "comments_normalized_plain_text_chars": sum(len(c.normalized_text) for c in all_comments),
        },
        "status_counts": {
            "posts_and_pages": _status_counts(content_items),
            "comments": dict(sorted(Counter(c.wordpress_status or "(empty)" for c in all_comments).items())),
            "comment_types": dict(sorted(Counter(c.comment_type or "comment" for c in all_comments).items())),
        },
        "output_counts": {
            "public_records_total": len(public_records),
            "archived_comments_total": len(private_comments),
            "media_manifest_total": len(media_manifest),
            "redirect_mappings_total": len(public_records),
            "warnings_total": len(warnings),
        },
        "warnings": warnings,
        "privacy": {
            "commenter_email_exported": False,
            "commenter_ip_exported": False,
            "user_agent_exported": False,
            "private_comments_path": "private/comments.jsonl",
        },
    }
    _write_json(output_dir / "migration-report.json", report)
    return report


def _extract_legacy_content(page_html: str) -> str:
    start = "<!-- LEGACY_CONTENT_START -->"
    end = "<!-- LEGACY_CONTENT_END -->"
    if start not in page_html or end not in page_html:
        raise ValueError("Legacy content markers missing")
    return page_html.split(start, 1)[1].split(end, 1)[0]


def verify_bundle(output_dir: Path, *, strict_warnings: bool = False) -> dict:
    output_dir = output_dir.resolve()
    report = json.loads((output_dir / "migration-report.json").read_text(encoding="utf-8"))
    manifest = json.loads((output_dir / "public-manifest.json").read_text(encoding="utf-8"))
    inventory = json.loads((output_dir / "inventory.json").read_text(encoding="utf-8"))
    errors: list[str] = []
    warnings = list(report.get("warnings") or [])

    private_rows: list[dict] = []
    private_path = output_dir / "private" / "comments.jsonl"
    if private_path.exists():
        for line in private_path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                private_rows.append(json.loads(line))

    expected_private = report["source_counts"]["comments_total"]
    if len(private_rows) != expected_private:
        errors.append(f"comment count mismatch: expected {expected_private}, got {len(private_rows)}")

    forbidden_private_keys = {"author_email", "comment_author_email", "comment_author_ip", "ip", "user_agent", "comment_agent"}
    for row in private_rows:
        if forbidden_private_keys.intersection(row):
            errors.append(f"private row contains forbidden identifiers: {sorted(forbidden_private_keys.intersection(row))}")
        normalized = normalize_plain_text(row.get("comment_body") or "")
        if row.get("normalized_plain_text_sha256") != sha256_text(normalized):
            errors.append(f"comment hash mismatch: {row.get('legacy_comment_id')}")

    inventory_by_id = {row.get("legacy_post_id"): row for row in inventory}
    seen_paths: set[str] = set()
    for row in manifest:
        public_path = row["public_path"]
        if public_path in seen_paths:
            errors.append(f"duplicate public path: {public_path}")
        seen_paths.add(public_path)
        page = output_dir / row["output_file"]
        if not page.exists():
            errors.append(f"missing public file: {row['output_file']}")
            continue
        rendered = _extract_legacy_content(page.read_text(encoding="utf-8"))
        rendered_hash = sha256_text(normalize_plain_text(rendered))
        source_hash = row["normalized_plain_text_sha256"]
        if rendered_hash != source_hash:
            errors.append(f"rendered normalized text mismatch: legacy_post_id={row.get('legacy_post_id')}")
        source_row = inventory_by_id.get(row.get("legacy_post_id"))
        if not source_row:
            errors.append(f"public row missing from inventory: {row.get('legacy_post_id')}")

    public_root = output_dir / "public"
    forbidden_public_tokens = ["comment_author_email", "comment_author_ip", "wp_legacy_comments", "wordpress_blog_role", '"comment_body"']
    for path in public_root.rglob("*"):
        if not path.is_file() or path.suffix.lower() not in {".html", ".js", ".json", ".css"}:
            continue
        body = path.read_text(encoding="utf-8", errors="replace")
        for token in forbidden_public_tokens:
            if token in body:
                errors.append(f"public output contains private/admin token {token}: {path.relative_to(output_dir)}")

    expected_public = report["source_counts"]["published_posts_total"] + report["source_counts"]["published_pages_total"]
    collisions = [w for w in warnings if w.get("code") == "public_path_collision"]
    if len(manifest) != expected_public - len(collisions):
        errors.append(f"public record count mismatch: expected {expected_public - len(collisions)}, got {len(manifest)}")

    if strict_warnings and warnings:
        errors.append(f"strict verification rejected {len(warnings)} warning(s)")

    result = {
        "verified": not errors,
        "errors": errors,
        "warnings": warnings,
        "counts": {
            "public_records": len(manifest),
            "private_comments": len(private_rows),
            "warnings": len(warnings),
        },
    }
    _write_json(output_dir / "verification-result.json", result)
    return result


def atomic_build_bundle(source: Path, output_dir: Path) -> dict:
    output_dir = output_dir.resolve()
    parent = output_dir.parent
    parent.mkdir(parents=True, exist_ok=True)
    temp = Path(tempfile.mkdtemp(prefix="wp-migration-", dir=parent))
    try:
        report = build_bundle(source, temp)
        if output_dir.exists():
            shutil.rmtree(output_dir)
        temp.rename(output_dir)
        return report
    except Exception:
        shutil.rmtree(temp, ignore_errors=True)
        raise
