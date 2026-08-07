#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from u2memo_policy import verify_u2memo_bundle

COMMENT_FIELDS = [
    "legacy_comment_id", "legacy_post_id", "post_slug", "parent_legacy_comment_id",
    "author_display_name", "comment_body", "legacy_secret", "created_at", "created_at_gmt",
    "wordpress_status", "comment_type", "raw_chars", "normalized_plain_text_chars",
    "normalized_plain_text_sha256",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare private u2memo CSV/metadata files for trusted Supabase import.")
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    verification = verify_u2memo_bundle(args.bundle)
    if not verification["verified"]:
        print(json.dumps(verification, ensure_ascii=False, indent=2))
        return 2

    args.output.mkdir(parents=True, exist_ok=True)
    comments = [json.loads(line) for line in (args.bundle / "private" / "comments.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    csv_path = args.output / "u2memo_legacy_comments.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COMMENT_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in comments:
            writer.writerow({field: row.get(field, "") if row.get(field) is not None else "" for field in COMMENT_FIELDS})

    report = json.loads((args.bundle / "migration-report.json").read_text(encoding="utf-8"))
    manifest = json.loads((args.bundle / "public-manifest.json").read_text(encoding="utf-8"))
    counts = report["source_counts"]
    run = {
        "source_name": report["source"]["file_name"],
        "source_posts_total": counts["posts_total"],
        "source_pages_total": counts["pages_total"],
        "source_attachments_total": counts["attachments_total"],
        "source_comments_total": counts["comments_total"],
        "source_approved_comments_total": counts["approved_comments_total"],
        "imported_posts_total": sum(1 for row in manifest if row.get("post_type") == "post"),
        "imported_pages_total": sum(1 for row in manifest if row.get("post_type") == "page"),
        "imported_comments_total": len(comments),
        "source_content_raw_chars": counts["content_raw_chars"],
        "source_content_normalized_plain_text_chars": counts["content_normalized_plain_text_chars"],
        "source_comments_raw_chars": counts["comments_raw_chars"],
        "source_comments_normalized_plain_text_chars": counts["comments_normalized_plain_text_chars"],
        "warning_count": verification["counts"]["actionable_warnings"],
        "verified": True,
        "verification_note": "u2memo site-specific verification passed before DB import preparation.",
    }
    run_path = args.output / "u2memo_migration_run.json"
    run_path.write_text(json.dumps(run, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    (args.output / "README_PRIVATE.txt").write_text(
        "Private u2memo DB import package. Do not commit or publish.\n"
        "Apply sites/wordpress-blog/db/schema.sql to the selected existing Supabase project, then import "
        "u2memo_legacy_comments.csv into public.u2memo_legacy_comments from a trusted admin/server-side path. "
        "Record u2memo_migration_run.json in public.u2memo_migration_runs after recounting. Browser writes are unsupported.\n",
        encoding="utf-8",
    )
    print(json.dumps({"verified": True, "comments": len(comments), "comments_csv": str(csv_path), "migration_run": str(run_path)}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
