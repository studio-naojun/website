"""Focused, offline, fail-closed checks for AI Developer Watch public artifacts."""
from __future__ import annotations

from datetime import date
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
AREA = ROOT / "ai-dev"


class Links(HTMLParser):
    def __init__(self, source: str):
        super().__init__()
        self.links: list[dict[str, str | None]] = []
        self.feed(source)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            self.links.append(dict(attrs))


def validate() -> None:
    feed = json.loads((AREA / "feed.json").read_text(encoding="utf-8"))
    entries = feed["entries"]
    assert isinstance(entries, list)
    assert (AREA / "index.html").is_file()
    assert (AREA / "PUBLISHER.md").is_file()
    assert "href=\"ai-dev/\"" in (ROOT / "index.html").read_text(encoding="utf-8")
    seen: set[str] = set()
    for entry in entries:
        day = date.fromisoformat(entry["published_at"]).isoformat()
        assert re.fullmatch(r"20\d{2}-\d{2}-\d{2}", day)
        assert entry["id"] == f"daily-{day}"
        assert entry["type"] == "daily"
        assert entry["path"] == f"daily/{day}/"
        assert entry["source_cycle"] == f"ai-dev-daily-{day}"
        assert entry["priority"] in {"P0", "P1", "P2", "P3"}
        assert entry["id"] not in seen
        seen.add(entry["id"])
        assert len(entry["title"].strip()) >= 8
        assert len(entry["summary"].strip()) >= 20
        article_file = AREA / entry["path"] / "index.html"
        assert article_file.is_file(), article_file
        article = article_file.read_text(encoding="utf-8")
        assert not re.search(r"\{\{[A-Z_]+\}\}", article)
        assert re.search(r"<h1(?:\s|>)", article)
        assert "https://" in article and "source-note" in article
        assert "更新履歴" in article
        for link in Links(article).links:
            url = (link.get("href") or "").strip()
            parsed = urlsplit(url)
            if parsed.scheme in {"http", "https"}:
                assert parsed.scheme == "https", url
                if parsed.netloc not in {"naojun.jp"}:
                    rel = (link.get("rel") or "")
                    assert link.get("target") == "_blank" and "noopener" in rel and "noreferrer" in rel
    assert len(seen) == len(entries)
    rendered_index = (AREA / "index.html").read_text(encoding="utf-8")
    for entry in entries:
        assert f'href="{entry["path"]}"' in rendered_index
    if not entries:
        assert "初回の記事は未公開" in rendered_index


if __name__ == "__main__":
    validate()
    print("AI Developer Watch smoke: PASS")
