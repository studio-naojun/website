"""Regression contract for the fictional travel example's one-click 3lines journey.

Static checks do not claim that browser interaction, traffic, or summary accuracy
was independently observed.
"""
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
TOOL_HTML = ROOT / "tools/3lines/index.html"
TOOL_JS = ROOT / "tools/3lines/src/main.js"
TRAVEL = ROOT / "tools/3lines/travel-booking/index.html"
GUIDE = ROOT / "tools/3lines/guide/index.html"


class TravelPresetContract(unittest.TestCase):
    def test_preset_key_is_wired_once(self):
        html = TOOL_HTML.read_text(encoding="utf-8")
        script = TOOL_JS.read_text(encoding="utf-8")
        self.assertEqual(html.count('data-sample="travel"'), 1)
        self.assertIn("  travel: {", script)
        self.assertIn("架空の旅行予約メール", script)
        self.assertIn("new URLSearchParams(window.location.search).get('sample')", script)
        self.assertIn("Object.prototype.hasOwnProperty.call(SAMPLE_TEXTS, requestedSample)", script)
        self.assertIn("sampleButtons.find((button) => button.dataset.sample === requestedSample)?.click()", script)

    def test_relevant_conditions_are_present_in_fictional_input(self):
        source = TOOL_JS.read_text(encoding="utf-8")
        for value in ("2026年12月12日", "12月9日", "18時", "現地払い", "20時", "21時以降", "架空"):
            with self.subTest(value=value):
                self.assertIn(value, source)

    def test_article_and_guide_connect_to_tool(self):
        travel = TRAVEL.read_text(encoding="utf-8")
        guide = GUIDE.read_text(encoding="utf-8")
        self.assertEqual(travel.count('href="/tools/3lines/?sample=travel"'), 3)
        self.assertIn("旅行予約を整理", guide)
        self.assertIn('href="/tools/3lines/travel-booking/"', TOOL_HTML.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
