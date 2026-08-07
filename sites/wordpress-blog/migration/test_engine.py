from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from wxr_engine import (
    atomic_build_bundle,
    normalize_plain_text,
    sanitize_html,
    verify_bundle,
)


HERE = Path(__file__).resolve().parent
FIXTURE = HERE / "fixtures" / "sample.xml"


class MigrationEngineTest(unittest.TestCase):
    def test_sanitizer_drops_active_content_and_unsafe_urls(self):
        markup = '<p>Hello<script>alert(1)</script><a href="javascript:alert(2)">link</a></p>'
        sanitized, flags = sanitize_html(markup)
        self.assertNotIn("script", sanitized)
        self.assertNotIn("javascript:", sanitized)
        self.assertIn("Hello", normalize_plain_text(sanitized))
        self.assertIn("link", normalize_plain_text(sanitized))
        self.assertIn("blocked_tag:script", flags)
        self.assertIn("blocked_url:a:href", flags)

    def test_fixture_build_and_verify(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "bundle"
            report = atomic_build_bundle(FIXTURE, output)
            result = verify_bundle(output, strict_warnings=True)

            self.assertTrue(result["verified"], result)
            self.assertEqual(report["source_counts"]["posts_total"], 1)
            self.assertEqual(report["source_counts"]["pages_total"], 1)
            self.assertEqual(report["source_counts"]["attachments_total"], 1)
            self.assertEqual(report["source_counts"]["comments_total"], 2)
            self.assertEqual(report["source_counts"]["approved_comments_total"], 1)
            self.assertEqual(report["output_counts"]["public_records_total"], 2)
            self.assertEqual(report["output_counts"]["archived_comments_total"], 2)
            self.assertEqual(report["output_counts"]["media_manifest_total"], 1)
            self.assertEqual(report["output_counts"]["warnings_total"], 0)

            self.assertTrue((output / "public" / "2024" / "01" / "sample-post" / "index.html").exists())
            self.assertTrue((output / "public" / "about" / "index.html").exists())

            comments_text = (output / "private" / "comments.jsonl").read_text(encoding="utf-8")
            self.assertNotIn("reader@example.net", comments_text)
            self.assertNotIn("spam@example.net", comments_text)
            self.assertNotIn("192.0.2.1", comments_text)
            self.assertNotIn("192.0.2.2", comments_text)

            public_text = "\n".join(
                path.read_text(encoding="utf-8")
                for path in (output / "public").rglob("*.html")
            )
            self.assertNotIn("Sample Reader", public_text)
            self.assertNotIn("Spam Example", public_text)
            self.assertNotIn("参考になりました。", public_text)
            self.assertNotIn("非公開Archive保持確認用。", public_text)

            media = json.loads((output / "media-manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(media[0]["source_url"], "https://old.example.com/wp-content/uploads/2024/01/sample.jpg")


if __name__ == "__main__":
    unittest.main()
