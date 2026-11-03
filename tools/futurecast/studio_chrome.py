"""Shared NAOJUN STUDIOS chrome for the Python-built FUTURECAST pages.

Reads the same partials, official URLs and asset version as scripts/sync_studio.py so the
generated pages already match the synchronizer (its --check stays a no-op). Mirrors the
FUTURECAST publication subnav emitted by tools/futurecast/fc.mjs.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAV = [
    ("/futurecast/", "トップ"),
    ("/futurecast/high-conviction/", "HISTORY 50+"),
    ("/futurecast/data-disagrees/", "DATA DISAGREES"),
    ("/futurecast/era-shifts/", "低確率研究"),
    ("/futurecast/scoreboard/", "成績"),
    ("/futurecast/methodology/", "方法論"),
    ("/futurecast/archive/", "アーカイブ"),
]


def version():
    found = re.search(r"^VERSION='([^']+)'", (ROOT / "scripts/sync_studio.py").read_text(encoding="utf-8"), re.M)
    if not found:
        raise ValueError("studio VERSION not found")
    return found[1]


def _partial(name, key, value):
    return (ROOT / "_partials" / name).read_text(encoding="utf-8").strip().replace(key, html.escape(value, quote=True))


def styles(page_css):
    return ('<link rel="stylesheet" href="/assets/css/style.css">\n'
            '<link rel="stylesheet" href="/futurecast/assets/css/futurecast.css">\n'
            f'<link rel="stylesheet" href="{html.escape(page_css, quote=True)}">\n'
            f'<link rel="stylesheet" href="/assets/css/studio.css?v={version()}">')


def header(current):
    config = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))
    current_attr = ' aria-current="page"'
    links = "".join(f'<a href="{href}"{current_attr if href == current else ""}>{label}</a>' for href, label in NAV)
    return ('<a class="skip-link" href="#main">本文へスキップ</a>\n'
            + _partial("header.html", "{{STORE_URL}}", config["store_url"]) + "\n"
            + f'<div class="mast"><a class="mast-brand" href="/futurecast/">FUTURECAST <small>未来予想台帳</small></a><nav class="mast-nav" aria-label="FUTURECAST">{links}</nav></div>')


def footer(script=True):
    """script=False keeps a page entirely JavaScript-free (ERA SHIFTS guarantees no <script>).
    Such pages use body class "fc-site fc-static" instead of "studio-site", stay outside
    sync_studio's scope, and show the studio navigation in its no-JS (always visible) form."""
    config = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))
    markup = _partial("footer.html", "{{YOUTUBE_URL}}", config["youtube_url"])
    return markup + (f'\n<script src="/assets/js/studio.js?v={version()}" defer></script>' if script else "")
