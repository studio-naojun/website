"""Offline TDD cases for the origin verification gate; no real network in tests."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

SOURCE = Path(__file__).with_name("live_verify.py")
spec = importlib.util.spec_from_file_location("live_verify", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LiveVerifyTests(unittest.TestCase):
    def fixture(self, directory):
        root = Path(directory)
        area = root / "ai-dev"
        (area / "daily/2026-10-30").mkdir(parents=True)
        (area / "index.html").write_text("<h1>Index</h1>", encoding="utf-8")
        (area / "daily/2026-10-30/index.html").write_text(
            '<h1>Daily</h1><div class="source-note">https://example.org</div>',
            encoding="utf-8",
        )
        (area / "feed.json").write_text(json.dumps(
            {"entries": [{"id": "daily-2026-10-30", "path": "daily/2026-10-30/",
                          "published_at": "2026-10-30", "title": "Daily"}]}), encoding="utf-8")
        return root

    def test_live_http_requires_identical_bytes(self):
        with TemporaryDirectory() as tmp:
            root = self.fixture(tmp)
            expected = module.expected_files(root)
            observed = module.check_once(root, fetch=lambda url: expected[url])
            self.assertEqual(len(observed), 3)
            self.assertTrue(all(x["http"] == "200" for x in observed))

    def test_stale_origin_is_not_published(self):
        with TemporaryDirectory() as tmp:
            root = self.fixture(tmp)
            with self.assertRaisesRegex(module.LiveVerificationError, "content mismatch"):
                module.check_once(root, fetch=lambda _: b"<html>stale</html>")

    def test_duplicate_cycle_never_passes(self):
        with TemporaryDirectory() as tmp:
            root = self.fixture(tmp)
            file = root / "ai-dev/feed.json"
            payload = json.loads(file.read_text(encoding="utf-8"))
            payload["entries"].append(dict(payload["entries"][0]))
            file.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(module.LiveVerificationError, "duplicate"):
                module.expected_files(root)

    def test_traversal_or_other_path_cannot_pass(self):
        with TemporaryDirectory() as tmp:
            root = self.fixture(tmp)
            file = root / "ai-dev/feed.json"
            payload = json.loads(file.read_text(encoding="utf-8"))
            payload["entries"][0]["path"] = "../private/"
            file.write_text(json.dumps(payload), encoding="utf-8")
            with self.assertRaisesRegex(module.LiveVerificationError, "unsafe"):
                module.expected_files(root)

    def test_two_retry_bound_then_success(self):
        attempts, delays = [], []
        def check():
            attempts.append(1)
            if len(attempts) < 3:
                raise module.LiveVerificationError("Pages still updating")
            return "pass"
        result = module.retry_check(check, sleep=delays.append, delays=(30, 60))
        self.assertEqual(result, "pass")
        self.assertEqual(len(attempts), 3)
        self.assertEqual(delays, [30, 60])

    def test_two_retry_bound_then_failure(self):
        attempts, delays = [], []
        def check():
            attempts.append(1)
            raise module.LiveVerificationError("still stale")
        with self.assertRaisesRegex(module.LiveVerificationError, "still stale"):
            module.retry_check(check, sleep=delays.append, delays=(30, 60))
        self.assertEqual(len(attempts), 3)
        self.assertEqual(delays, [30, 60])


if __name__ == "__main__":
    unittest.main()
