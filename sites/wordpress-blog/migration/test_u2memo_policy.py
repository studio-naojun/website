from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from u2memo_policy import (
    augment_inline_media,
    scrub_legacy_comment_prefix,
    scrub_private_comments,
    verify_u2memo_bundle,
)
from wxr_engine import atomic_build_bundle


HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "u2memo-sample.xml"


class U2MemoPolicyTest(unittest.TestCase):
    def test_scrub_legacy_comment_prefix(self):
        body, secret, password_removed = scrub_legacy_comment_prefix(
            "SECRET: 1\nPASS: TEST_ONLY\n保持する本文です。"
        )
        self.assertEqual(body, "保持する本文です。")
        self.assertTrue(secret)
        self.assertTrue(password_removed)

    def test_u2memo_fixture_end_to_end(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "u2memo-bundle"
            report = atomic_build_bundle(FIXTURE, output)
            comment_policy = scrub_private_comments(output)
            media_policy = augment_inline_media(FIXTURE, output)
            result = verify_u2memo_bundle(output)

            self.assertTrue(result["verified"], result)
            self.assertEqual(report["source_counts"]["posts_total"], 1)
            self.assertEqual(report["source_counts"]["comments_total"], 1)
            self.assertEqual(comment_policy["legacy_secret_true"], 1)
            self.assertEqual(comment_policy["password_markers_removed"], 1)
            self.assertEqual(media_policy["media_manifest_unique"], 2)
            self.assertEqual(media_policy["tracking_likely_total"], 1)
            self.assertEqual(result["counts"]["actionable_warnings"], 0)
            self.assertEqual(result["counts"]["ignored_warnings"], 3)

            comments = (output / "private" / "comments.jsonl").read_text(encoding="utf-8")
            self.assertNotIn("SECRET:", comments)
            self.assertNotIn("PASS:", comments)
            self.assertNotIn("synthetic@example.net", comments)
            self.assertNotIn("192.0.2.50", comments)
            row = json.loads(comments.splitlines()[0])
            self.assertTrue(row["legacy_secret"])
            self.assertEqual(row["comment_body"], "保持するコメント本文です。")

            media = json.loads((output / "media-manifest.json").read_text(encoding="utf-8"))
            tracking = [row for row in media if row.get("tracking_likely")]
            self.assertEqual(len(tracking), 1)


if __name__ == "__main__":
    unittest.main()
