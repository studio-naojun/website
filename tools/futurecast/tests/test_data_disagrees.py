"""FUTURECAST DATA DISAGREES: tests without network or paid services."""
import copy
import importlib.util
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

TOOLS = Path(__file__).resolve().parents[1]
ROOT = TOOLS.parents[1]
sys.path.insert(0, str(TOOLS))
import build_data_disagrees as page
import monthly_evidence as monthly


class ReversalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(page.DATA.read_text(encoding="utf-8"))

    def test_current_no_qualified_forecasts(self):
        self.assertEqual(self.data["qualified_count"], 0)
        self.assertEqual(self.data["kind"], "research_only")
        page.validate(self.data)

    def test_no_unverified_probabilities_or_opinion_estimates(self):
        for c in self.data["candidates"]:
            self.assertIsNone(c["probability"])
            self.assertIsNone(c["human_forecast"])
            self.assertIn("未検証", c["status"])

    def test_data_invalid_probability_rejected(self):
        changed = copy.deepcopy(self.data)
        changed["candidates"][0]["probability"] = 0.93
        with self.assertRaises(AssertionError):
            page.validate(changed)

    def test_duplicate_research_id_rejected(self):
        changed = copy.deepcopy(self.data)
        changed["candidates"][1]["id"] = changed["candidates"][0]["id"]
        with self.assertRaises(AssertionError):
            page.validate(changed)

    def test_url_restricted_to_https(self):
        changed = copy.deepcopy(self.data)
        changed["candidates"][0]["sources"][0]["url"] = "http://example.com/unsafe"
        with self.assertRaises(AssertionError):
            page.validate(changed)

    def test_data_escaped_not_interpreted_as_markup(self):
        changed = copy.deepcopy(self.data)
        changed["candidates"][0]["title"] = '<img src=x onerror="alert(1)">'
        output = page.render(changed)
        self.assertNotIn('<img src=x onerror="alert(1)">', output)
        self.assertIn("&lt;img src=x", output)

    def test_checked_in_html_equals_deterministic_render(self):
        self.assertEqual(page.OUTPUT.read_text(encoding="utf-8"), page.render(self.data))
        self.assertIn("DATA DISAGREES", page.OUTPUT.read_text(encoding="utf-8"))

    def test_source_host_allowlist(self):
        self.assertGreaterEqual(len(monthly.get_sources(self.data)), 4)
        changed = copy.deepcopy(self.data)
        changed["candidates"][1]["sources"][0]["url"] = "https://malicious.invalid/a"
        with self.assertRaises(ValueError):
            monthly.get_sources(changed)

    def test_offline_config_check(self):
        self.assertEqual(monthly.main(["--check"]), 0)

    def test_report_does_not_infer_new_probability(self):
        sources = monthly.get_sources(self.data)
        checks = [{**s, "http_status": 200, "checked_at": "2026-11-03T00:00:00Z",
                   "etag": None, "last_modified": None, "sample_sha256": "abcd", "error": None}
                  for s in sources]
        report = monthly.report_md(self.data, checks)
        self.assertIn("新規のAI数値予測", report)
        self.assertIn("未採択", report)
        self.assertNotIn("発生確率90%", report)

    def test_scan_is_testable_without_network(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            fake = lambda item: {**item, "checked_at": "2026-11-03T00:00:00Z",
                                "http_status": 200, "etag": None,
                                "last_modified": None, "sample_sha256": "abc", "error": None}
            with patch.object(monthly, "check_one", side_effect=fake):
                self.assertEqual(monthly.main(["--scan", "--output", str(folder / "report.json"),
                                               "--markdown", str(folder / "review.md")]), 0)
            result = json.loads((folder / "report.json").read_text(encoding="utf-8"))
            self.assertEqual(result["purpose"], "metadata_only_not_probability_update")
            self.assertEqual(result["qualified_count"], 0)
            self.assertTrue((folder / "review.md").exists())

    def test_monthly_workflow_existing_platform(self):
        text = (ROOT / ".github/workflows/futurecast-monthly-evidence.yml").read_text(encoding="utf-8")
        self.assertIn("0 23 1 * *", text)
        self.assertIn("workflow_dispatch:", text)
        self.assertIn("issues: write", text)
        self.assertIn("gh issue create", text)
        self.assertNotIn("OPENAI_API_KEY", text)

    def test_site_root_links_to_reversal_and_legacy(self):
        text = (ROOT / "futurecast/index.html").read_text(encoding="utf-8")
        self.assertIn('/futurecast/data-disagrees/', text)
        self.assertIn('/futurecast/era-shifts/', text)
        self.assertIn("採択0件", text)

    def test_history_files_not_relabelled_as_real_50percent(self):
        text = (ROOT / "futurecast/data-disagrees/index.html").read_text(encoding="utf-8")
        self.assertIn("採択条件を満たした予測", text)
        self.assertIn("発生確率：<strong>未算出</strong>", text)


if __name__ == "__main__":
    unittest.main()
