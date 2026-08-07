#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import os
import re
import urllib.parse
import urllib.request
from pathlib import Path


SAFE_CONTENT_PREFIXES = ("image/", "audio/", "video/")
SAFE_CONTENT_TYPES = {"application/pdf", "application/zip", "text/plain"}


def safe_name(value: str, fallback: str) -> str:
    value = urllib.parse.unquote(value)
    value = os.path.basename(value).strip()
    value = re.sub(r"[^A-Za-z0-9._()\-\u0080-\uffff]+", "-", value)
    return value or fallback


def main() -> int:
    parser = argparse.ArgumentParser(description="Download WordPress media from a generated media manifest.")
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--allow-host", action="append", default=[], help="Allowed source hostname. Repeat for multiple hosts.")
    parser.add_argument("--max-bytes", type=int, default=25 * 1024 * 1024)
    parser.add_argument("--dry-run", action="store_true", help="Validate URLs without making network requests.")
    parser.add_argument(
        "--include-tracking-likely",
        action="store_true",
        help="Also process manifest rows marked tracking_likely. Default is to skip legacy tracking pixels.",
    )
    args = parser.parse_args()

    rows = json.loads(args.manifest.read_text(encoding="utf-8"))
    allowed_hosts = {host.lower().strip(".") for host in args.allow_host}
    if not args.dry_run and not allowed_hosts:
        parser.error("at least one --allow-host is required for real downloads")

    args.output.mkdir(parents=True, exist_ok=True)
    report = []
    failures = 0
    skipped_tracking = 0

    for index, row in enumerate(rows, start=1):
        url = (row.get("source_url") or "").strip()
        result = {"legacy_post_id": row.get("legacy_post_id"), "source_url": url, "status": "pending"}
        if row.get("tracking_likely") is True and not args.include_tracking_likely:
            skipped_tracking += 1
            result.update(status="skipped", reason="tracking_likely")
            report.append(result)
            continue

        parsed = urllib.parse.urlsplit(url)
        host = (parsed.hostname or "").lower().strip(".")
        if parsed.scheme not in {"http", "https"} or not host:
            result.update(status="rejected", reason="invalid_url")
            failures += 1
            report.append(result)
            continue
        if allowed_hosts and host not in allowed_hosts:
            result.update(status="rejected", reason="host_not_allowed")
            failures += 1
            report.append(result)
            continue
        if args.dry_run:
            result.update(status="validated", host=host)
            report.append(result)
            continue

        filename = safe_name(parsed.path, f"attachment-{row.get('legacy_post_id') or index}")
        destination = args.output / filename
        if destination.exists():
            stem, suffix = destination.stem, destination.suffix
            destination = args.output / f"{stem}-{row.get('legacy_post_id') or index}{suffix}"

        request = urllib.request.Request(url, headers={"User-Agent": "Studio-NaoJun-WordPress-Migration/1.0"})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                content_type = (response.headers.get_content_type() or "").lower()
                if not (content_type.startswith(SAFE_CONTENT_PREFIXES) or content_type in SAFE_CONTENT_TYPES):
                    raise ValueError(f"content type not allowed: {content_type}")
                digest = hashlib.sha256()
                size = 0
                with destination.open("wb") as handle:
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        size += len(chunk)
                        if size > args.max_bytes:
                            raise ValueError(f"file exceeds max bytes: {args.max_bytes}")
                        digest.update(chunk)
                        handle.write(chunk)
            result.update(
                status="downloaded",
                file=str(destination.name),
                bytes=size,
                sha256=digest.hexdigest(),
                content_type=content_type,
            )
        except Exception as exc:
            destination.unlink(missing_ok=True)
            failures += 1
            result.update(status="failed", reason=str(exc))
        report.append(result)

    report_path = args.output / "media-download-report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "items": len(rows),
        "failures": failures,
        "skipped_tracking": skipped_tracking,
        "dry_run": args.dry_run,
        "report": str(report_path),
    }, ensure_ascii=False, indent=2))
    return 0 if failures == 0 else 2


if __name__ == "__main__":
    raise SystemExit(main())
