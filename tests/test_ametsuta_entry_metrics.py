"""Contract for first-party metrics on Ametsuta's standalone game entry.

Static checks: real visits, reach, and campaign attribution require later observation.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
GAME = ROOT / "works" / "ametsuta" / "play" / "index.html"
PARENT = ROOT / "works" / "ametsuta" / "index.html"
COLLECTOR = ROOT / "assets" / "js" / "main.js"
GAME_APP = ROOT / "works" / "ametsuta" / "play" / "main.mjs"


class AmetsutaEntryMetricsContract(unittest.TestCase):
    def test_direct_game_entry_loads_existing_collector_once(self):
        html = GAME.read_text(encoding="utf-8-sig")
        self.assertEqual(html.count('src="/assets/js/main.js?v=20261120-game-entry"'), 1)
        self.assertEqual(html.count('src="./main.mjs?v=20261102-resultshare-a"'), 1)

    def test_iframe_cannot_double_count_parent_page(self):
        script = COLLECTOR.read_text(encoding="utf-8")
        self.assertIn("if (window.self !== window.top) return;", script)
        self.assertLess(script.index("if (window.self !== window.top) return;"),
                        script.index("const payload = new URLSearchParams({"))
        self.assertIn('src="./play/?v=20261102-resultshare-a"', PARENT.read_text(encoding="utf-8"))

    def test_privacy_filters_and_campaign_attribution_remain(self):
        script = COLLECTOR.read_text(encoding="utf-8")
        for guard in ("navigator.webdriver", "navigator.doNotTrack",
                      "navigator.globalPrivacyControl", "naojun-analytics-off",
                      "requestedSource === 'qa'", "requestedSource === 'internal_test'"):
            with self.subTest(guard=guard):
                self.assertIn(guard, script)
        for token in ("utm_source", "utm_campaign", "daily_visit", "landing",
                      "https://naojun-metrics.pages.dev/e"):
            self.assertIn(token, script)

    def test_gameplay_does_not_send_analytics_independently(self):
        app = GAME_APP.read_text(encoding="utf-8")
        self.assertNotIn("naojun-metrics.pages.dev", app)


if __name__ == "__main__":
    unittest.main()
