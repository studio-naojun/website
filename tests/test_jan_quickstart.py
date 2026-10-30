"""Regression: JAN quick-start links must prefill the existing same-site search UI."""
import re
import unittest
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, unquote

ROOT = Path(__file__).resolve().parents[1]


class JanQuickstartTests(unittest.TestCase):
    def test_examples_are_distinct_safe_prefill_links(self):
        html = (ROOT / "tools/jan/index.html").read_text(encoding="utf-8")
        rows = re.findall(
            r'<a href="([^"]+)" data-jan-example="([1-9][0-9]*)">([^<]+)</a>',
            html,
        )
        self.assertEqual(len(rows), 3)
        self.assertEqual([int(number) for _, number, _ in rows], [1, 2, 3])
        self.assertEqual(len({href for href, _, _ in rows}), 3)
        for href, _, label in rows:
            url = urlsplit(href)
            self.assertEqual(url.path, "/tools/jan/")
            self.assertEqual(url.netloc, "")
            self.assertEqual(parse_qs(url.query).get("q"), [unquote(label)])

    def test_prefill_is_handled_and_keyboard_focus_visible(self):
        js = (ROOT / "assets/js/jan-search.js").read_text(encoding="utf-8")
        css = (ROOT / "assets/css/jan-search.css").read_text(encoding="utf-8")
        self.assertIn("params.get('q')", js)
        self.assertIn("submitQuery(initialValue, false)", js)
        self.assertIn(".jan-examples a:focus-visible", css)


if __name__ == "__main__":
    unittest.main()
