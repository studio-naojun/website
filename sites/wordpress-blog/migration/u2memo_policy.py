from __future__ import annotations

import html
import json
import re
import urllib.parse
import xml.etree.ElementTree as ET
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path

from wxr_engine import local_name, child_text, normalize_plain_text, sha256_text, verify_bundle

SOURCE_BASE_URL = "https://pocca.net/u2memo"
IGNORED_UNSUPPORTED_POST_TYPES = {"nav_menu_item", "wp_global_styles"}


class InlineImageCollector(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.images: list[dict[str, str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag.lower() != "img":
            return
        values = {str(k).lower(): str(v or "") for k, v in attrs}
        src = html.unescape(values.get("src", "")).strip()
        if not src:
            return
        self.images.append({
            "source_url": src,
            "width": values.get("width", ""),
            "height": values.get("height", ""),
            "alt": values.get("alt", ""),
        })


def scrub_legacy_comment_prefix(body: str) -> tuple[str, bool | None, bool]:
    lines = (body or "").splitlines()
    secret: bool | None = None
    password_marker_removed = False
    kept: list[str] = []
    consuming_prefix = True

    for line in lines:
        if consuming_prefix:
            secret_match = re.fullmatch(r"\s*SECRET:\s*([01])\s*", line, re.IGNORECASE)
            if secret_match:
                secret = secret_match.group(1) == "1"
                continue
            pass_match = re.fullmatch(r"\s*PASS:\s*(.*?)\s*", line, re.IGNORECASE)
            if pass_match:
                password_marker_removed = True
                continue
            if not line.strip():
                continue
            consuming_prefix = False
        kept.append(line)

    return "\n".join(kept).strip(), secret, password_marker_removed


def scrub_private_comments(bundle: Path) -> dict:
    path = bundle / "private" / "comments.jsonl"
    rows: list[dict] = []
    secret_true = 0
    secret_false = 0
    pass_markers_removed = 0

    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        body, secret, pass_removed = scrub_legacy_comment_prefix(row.get("comment_body") or "")
        row["comment_body"] = body
        row["legacy_secret"] = secret
        normalized = normalize_plain_text(body)
        row["raw_chars"] = len(body)
        row["normalized_plain_text_chars"] = len(normalized)
        row["normalized_plain_text_sha256"] = sha256_text(normalized)
        if secret is True:
            secret_true += 1
        elif secret is False:
            secret_false += 1
        if pass_removed:
            pass_markers_removed += 1
        rows.append(row)

    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    return {
        "comments": len(rows),
        "legacy_secret_true": secret_true,
        "legacy_secret_false": secret_false,
        "password_markers_removed": pass_markers_removed,
    }


def _tracking_likely(url: str, width: str, height: str) -> bool:
    parsed = urllib.parse.urlsplit(url)
    host = (parsed.hostname or "").lower()
    if width.strip() == "1" or height.strip() == "1":
        return True
    return host.endswith("a8.net") and parsed.path.endswith("0.gif")


def augment_inline_media(source: Path, bundle: Path) -> dict:
    root = ET.parse(source).getroot()
    channel = next(node for node in root if local_name(node.tag) == "channel")
    existing_path = bundle / "media-manifest.json"
    existing = json.loads(existing_path.read_text(encoding="utf-8"))
    by_url: OrderedDict[str, dict] = OrderedDict()

    for row in existing:
        url = (row.get("source_url") or "").strip()
        if url:
            by_url[url] = {**row, "source_kind": row.get("source_kind") or "attachment"}

    inline_occurrences = 0
    for node in channel:
        if local_name(node.tag) != "item":
            continue
        post_type = child_text(node, "post_type") or "post"
        status = child_text(node, "status")
        if post_type not in {"post", "page"} or status != "publish":
            continue
        content = child_text(node, "encoded", "content")
        collector = InlineImageCollector()
        collector.feed(content or "")
        collector.close()
        post_id = int(child_text(node, "post_id") or 0)
        title = child_text(node, "title")
        legacy_url = child_text(node, "link")
        for image in collector.images:
            url = image["source_url"]
            parsed = urllib.parse.urlsplit(url)
            if parsed.scheme not in {"http", "https"} or not parsed.hostname:
                continue
            inline_occurrences += 1
            if url not in by_url:
                by_url[url] = {
                    "legacy_post_id": post_id,
                    "source_url": url,
                    "legacy_url": legacy_url,
                    "title": title,
                    "source_kind": "inline_image",
                    "width": image["width"],
                    "height": image["height"],
                    "alt": image["alt"],
                    "occurrences": 1,
                    "tracking_likely": _tracking_likely(url, image["width"], image["height"]),
                }
            else:
                by_url[url]["occurrences"] = int(by_url[url].get("occurrences") or 1) + 1

    rows = list(by_url.values())
    existing_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    report_path = bundle / "migration-report.json"
    report = json.loads(report_path.read_text(encoding="utf-8"))
    report["output_counts"]["media_manifest_total"] = len(rows)
    report.setdefault("u2memo_policy", {})["inline_media_occurrences"] = inline_occurrences
    report["u2memo_policy"]["media_manifest_unique"] = len(rows)
    report["u2memo_policy"]["tracking_likely_total"] = sum(1 for row in rows if row.get("tracking_likely"))
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report["u2memo_policy"]


def verify_u2memo_bundle(bundle: Path) -> dict:
    base = verify_bundle(bundle, strict_warnings=False)
    report = json.loads((bundle / "migration-report.json").read_text(encoding="utf-8"))
    actionable = []
    ignored = []
    for warning in base.get("warnings") or []:
        if warning.get("code") == "unsupported_post_type" and warning.get("detail") in IGNORED_UNSUPPORTED_POST_TYPES:
            ignored.append(warning)
        else:
            actionable.append(warning)

    errors = list(base.get("errors") or [])
    if actionable:
        errors.append(f"u2memo verification rejected {len(actionable)} actionable warning(s)")

    private_path = bundle / "private" / "comments.jsonl"
    for line in private_path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        body = row.get("comment_body") or ""
        first_lines = body.splitlines()[:3]
        if any(re.fullmatch(r"\s*(?:SECRET|PASS):.*", value, re.IGNORECASE) for value in first_lines):
            errors.append(f"legacy secret/password marker remains in comment {row.get('legacy_comment_id')}")

    media = json.loads((bundle / "media-manifest.json").read_text(encoding="utf-8"))
    if report["output_counts"].get("media_manifest_total") != len(media):
        errors.append("media manifest count mismatch after u2memo policy")

    result = {
        "verified": not errors,
        "errors": errors,
        "warnings": actionable,
        "ignored_warnings": ignored,
        "counts": {
            **(base.get("counts") or {}),
            "media_manifest": len(media),
            "ignored_warnings": len(ignored),
            "actionable_warnings": len(actionable),
        },
    }
    (bundle / "u2memo-verification-result.json").write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    return result
