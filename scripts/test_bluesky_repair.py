"""Offline safety checks for the Bluesky Unicode restoration."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bluesky_publish
import bluesky_repair


class BlueskyRepairTests(unittest.TestCase):
    def test_historical_targets_have_restored_utf8(self):
        for key, record in bluesky_repair.load_expected().items():
            self.assertIn(key, bluesky_repair.TARGETS)
            self.assertFalse("????" in record["text"])
            self.assertIn("中学受験レポート", record["text"])
            self.assertIn("https://naojun.jp/admissions/weekly/", record["text"])
            self.assertLessEqual(len(record["text"]), 300)
            text_bytes = record["text"].encode("utf-8")
            for facet in record["facets"]:
                item = text_bytes[facet["index"]["byteStart"]:facet["index"]["byteEnd"]]
                self.assertTrue(item.decode("utf-8").startswith(("#", "https://")))

    def test_corrupt_unicode_does_not_publish(self):
        for broken in ("10????????????", "正しい見出し\ufffd", ""):
            with self.assertRaises(ValueError):
                bluesky_publish.validate_post_source(broken, "通常の日本語")
            with self.assertRaises(ValueError):
                bluesky_publish.validate_post_source("正しい見出し", broken)

    def test_avatar_is_small_square_png(self):
        from PIL import Image
        with Image.open(bluesky_repair.AVATAR) as im:
            self.assertEqual(im.format, "PNG")
            self.assertEqual(im.size, (512, 512))
            self.assertEqual(im.getpixel((0, 0)), (36, 69, 219))
        self.assertLess(bluesky_repair.AVATAR.stat().st_size, 1_000_000)


if __name__ == "__main__":
    unittest.main()
