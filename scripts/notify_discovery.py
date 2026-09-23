from __future__ import annotations

import json
from pathlib import Path
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from build_discovery import INDEXNOW_KEY, ROOT, SITE_URL


def post_json(url: str, payload: dict[str, object]) -> int:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8", "User-Agent": "NaoJun-Discovery/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        response.read()
        return int(response.status)


def post_form(url: str, payload: dict[str, str]) -> int:
    req = urllib.request.Request(
        url,
        data=urllib.parse.urlencode(payload).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded", "User-Agent": "NaoJun-Discovery/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        response.read()
        return int(response.status)


def sitemap_urls() -> list[str]:
    root = ET.fromstring((ROOT / "sitemap.xml").read_text(encoding="utf-8"))
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    return [node.text for node in root.findall("s:url/s:loc", namespace) if node.text]


def main() -> int:
    urls = sitemap_urls()
    urls.extend([f"{SITE_URL}/feed.xml", f"{SITE_URL}/sitemap.xml"])
    indexnow_status = post_json(
        "https://api.indexnow.org/indexnow",
        {
            "host": "naojun.jp",
            "key": INDEXNOW_KEY,
            "keyLocation": f"{SITE_URL}/{INDEXNOW_KEY}.txt",
            "urlList": urls,
        },
    )
    websub_status = post_form(
        "https://pubsubhubbub.appspot.com/",
        {"hub.mode": "publish", "hub.url": f"{SITE_URL}/feed.xml"},
    )
    print(json.dumps({"indexnow": indexnow_status, "websub": websub_status, "urls": len(urls)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
