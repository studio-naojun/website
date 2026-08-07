#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from wxr_engine import atomic_build_bundle
from u2memo_policy import SOURCE_BASE_URL, augment_inline_media, scrub_private_comments, verify_u2memo_bundle


def main() -> int:
    parser = argparse.ArgumentParser(description="Build the pocca.net/u2memo migration bundle from a sensitive WordPress WXR export.")
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    if not args.source.is_file():
        parser.error(f"source file not found: {args.source}")

    report = atomic_build_bundle(args.source, args.output)
    source_base = (report.get("source") or {}).get("base_blog_url", "").rstrip("/")
    if source_base != SOURCE_BASE_URL:
        parser.error(f"unexpected source base URL: {source_base!r}; expected {SOURCE_BASE_URL!r}")

    comment_policy = scrub_private_comments(args.output)
    media_policy = augment_inline_media(args.source, args.output)
    result = verify_u2memo_bundle(args.output)

    policy_path = args.output / "u2memo-policy-report.json"
    policy_path.write_text(json.dumps({
        "source_base_url": SOURCE_BASE_URL,
        "comments": comment_policy,
        "media": media_policy,
        "verified": result["verified"],
        "ignored_warnings": result["counts"]["ignored_warnings"],
        "actionable_warnings": result["counts"]["actionable_warnings"],
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    updated_report = json.loads((args.output / "migration-report.json").read_text(encoding="utf-8"))
    print(json.dumps({
        "source_counts": report["source_counts"],
        "output_counts": updated_report["output_counts"],
        "comment_policy": comment_policy,
        "media_policy": media_policy,
        "verified": result["verified"],
        "errors": result["errors"],
        "actionable_warnings": result["counts"]["actionable_warnings"],
        "ignored_warnings": result["counts"]["ignored_warnings"],
        "output": str(args.output.resolve()),
    }, ensure_ascii=False, indent=2))
    return 0 if result["verified"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
