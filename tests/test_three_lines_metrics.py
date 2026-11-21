"""Protect first-party traffic coverage on the standalone three-line tool.

The visitor's text must not be captured. These are static contract checks;
they do not claim a real visitor was observed.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL_HTML = ROOT / "tools" / "3lines" / "index.html"
GLOBAL_COLLECTOR = ROOT / "assets" / "js" / "main.js"
TOOL_APP = ROOT / "tools" / "3lines" / "src" / "main.js"


class ThreeLinesMetricsContract(unittest.TestCase):
    def test_standalone_tool_loads_existing_collector_once(self):
        html = TOOL_HTML.read_text(encoding="utf-8")
        self.assertEqual(html.count('src="/assets/js/main.js?v=20261025a"'), 1)
        self.assertEqual(html.count('src="src/main.js?v=1.7.2"'), 1)

    def test_existing_collector_retains_privacy_exclusions(self):
        script = GLOBAL_COLLECTOR.read_text(encoding="utf-8")
        for guard in ("navigator.webdriver", "navigator.doNotTrack",
                      "navigator.globalPrivacyControl", "utm_source",
                      "naojun-analytics-off"):
            with self.subTest(guard=guard):
                self.assertIn(guard, script)
        self.assertIn("daily_visit", script)
        self.assertIn("https://naojun-metrics.pages.dev/e", script)

    def test_no_secondary_collector_in_tool_app(self):
        app = TOOL_APP.read_text(encoding="utf-8")
        self.assertNotIn("naojun-metrics.pages.dev", app)


if __name__ == "__main__":
    unittest.main()
