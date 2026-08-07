#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from wxr_engine import verify_bundle


COMMENT_FIELDS = [
    "legacy_comment_id",
    "legacy_post_id",
    "post_slug",
    "parent_legacy_comment_id",
    "author_display_name",
    "comment_body",
    "created_at",
    "created_at_gmt",
    "wordpress_status",
    "comment_type",
    "raw_chars",
    "normalized_plain_text_chars",
    "normalized_plain_text_sha256",
]


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare private CSV/metadata files for trusted Supabase import.")
    parser.add_argument("bundle", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    verification = verify_bundle(args.bundle, strict_warnings=True)
    if not verification["verified"]:
        print(json.dumps(verification, ensure_ascii=False, indent=2))
        return 2

    args.output.mkdir(parents=True, exist_ok=True)
    comments = []
    for line in (args.bundle / "private" / "comments.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            comments.append(json.loads(line))

    csv_path = args.output / "wp_legacy_comments.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=COMMENT_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for row in comments:
            writer.writerow({field: row.get(field, "") for field in COMMENT_FIELDS})

    report = json.loads((args.bundle / "migration-report.json").read_text(encoding="utf-8"))
    counts = report["source_counts"]
    run = {
        "source_name": report["source"]["file_name"],
        "source_posts_total": counts["posts_total"],
        "source_pages_total": counts["pages_total"],
        "source_attachments_total": counts["attachments_total"],
        "source_comments_total": counts["comments_total"],
        "source_approved_comments_total": counts["approved_comments_total"],
        "imported_posts_total": report["output_counts"]["public_records_total"],
        "imported_pages_total": 0,
        "imported_comments_total": report["output_counts"]["archived_comments_total"],
        "source_content_raw_chars": counts["content_raw_chars"],
        "source_content_normalized_plain_text_chars": counts["content_normalized_plain_text_chars"],
        "source_comments_raw_chars": counts["comments_raw_chars"],
        "source_comments_normalized_plain_text_chars": counts["comments_normalized_plain_text_chars"],
        "warning_count": report["output_counts"]["warnings_total"],
        "verified": True,
        "verification_note": "Bundle strict verification passed before DB import preparation."
    }
    (args.output / "wp_migration_run.json").write_text(
        json.dumps(run, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )

    instructions = """# Private DB import package\n\nThis directory contains private migration data. Do not commit or publish it.\n\n1. Apply `sites/wordpress-blog/db/schema.sql` to the explicitly selected Supabase project.\n2. Import `wp_legacy_comments.csv` into `public.wp_legacy_comments` from a trusted admin/server-side path.\n3. Record `wp_migration_run.json` in `public.wp_migration_runs` after actual imported counts are rechecked.\n4. Run `sites/wordpress-blog/db/verification.sql`.\n5. Do not enable `admin/supabase-config.js` until RLS and the Admin role have been tested.\n\nBrowser-side import is intentionally unsupported.\n"""
    (args.output / "README_PRIVATE.txt").write_text(instructions, encoding="utf-8")

    print(json.dumps({
        "verified": True,
        "comments_csv": str(csv_path),
        "comments": len(comments),
        "migration_run": str(args.output / "wp_migration_run.json")
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
