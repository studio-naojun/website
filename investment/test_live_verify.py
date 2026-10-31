"""Offline TDD of the Investment Observatory independent origin verifier."""
import json
from pathlib import Path
import tempfile
import unittest

from live_verify import LiveVerificationError, check_once, expected_files, retry_check


class InvestmentLiveVerifierTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        for target in ["investment/weekly/2026-10-31", "investment/monthly/2026-10"]:
            (self.root / target).mkdir(parents=True, exist_ok=True)
        self.w = {"id": "weekly-2026-10-31", "type": "weekly", "path": "weekly/2026-10-31/",
                  "source_cycle": "investment-weekly-2026-10-31", "published_at": "2026-10-31", "title": "週報"}
        self.m = {"id": "monthly-2026-10", "type": "monthly", "path": "monthly/2026-10/",
                  "source_cycle": "investment-monthly-2026-10-31", "published_at": "2026-10-31", "title": "月報",
                  "first_published_at": "2026-10-04", "previous_source_cycle": "investment-monthly-2026-10-04",
                  "updated_at": "2026-10-31T10:03:00+09:00"}
        self.write()
    def tearDown(self):
        self.temp.cleanup()
    def write(self):
        for e in (self.w, self.m):
            (self.root / "investment" / e["path"] / "index.html").write_text(
                "<html><title>"+e["title"]+"</title><h1>"+e["title"]+"</h1><p>重要本文と投資助言の免責</p></html>", encoding="utf-8")
        (self.root / "investment" / "feed.json").write_text(json.dumps({"entries":[self.w, self.m]}), encoding="utf-8")
        (self.root / "investment" / "state.json").write_text(
            json.dumps({"source_cycle": self.m["source_cycle"], "scenarios":[{"probability":35},{"probability":65}]}), encoding="utf-8")
    def test_exact_live_bytes_and_feed(self):
        expected,_=expected_files(self.root)
        proof=check_once(self.root, lambda url: expected[url])
        self.assertEqual(len(proof["urls"]), 3)
        self.assertEqual(proof["monthly_rollover"]["previous_source_cycle"], "investment-monthly-2026-10-04")
    def test_changed_origin_bytes_are_rejected(self):
        with self.assertRaises(LiveVerificationError):
            check_once(self.root, lambda url: b"stale origin")
    def test_missing_rollover_history_rejected(self):
        self.m.pop("first_published_at")
        self.write()
        with self.assertRaises(LiveVerificationError):
            expected_files(self.root)
    def test_source_cycle_mismatch_rejected(self):
        self.w["source_cycle"]="investment-weekly-2026-10-24"
        self.write()
        with self.assertRaises(LiveVerificationError):
            expected_files(self.root)
    def test_retry_is_bounded(self):
        calls=[]
        def flaky():
            calls.append(1)
            if len(calls)<3:raise ConnectionError("temporary")
            return "ok"
        self.assertEqual(retry_check(flaky,lambda t: None), "ok")
        self.assertEqual(len(calls),3)
    def test_permanent_failure_keeps_blocker(self):
        attempts=[]
        def blocked():
            attempts.append(1)
            raise PermissionError("403")
        with self.assertRaises(PermissionError):
            retry_check(blocked, lambda t: None)
        self.assertEqual(len(attempts),3)


if __name__ == "__main__":
    unittest.main()
