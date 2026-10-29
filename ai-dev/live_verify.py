"""Read-only GitHub Pages acceptance: actual HTTPS origin must match canonical source.
Never treat a successful commit, PR, or Pages deployment as an HTTP acceptance.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

BASE_URL = "https://naojun.jp"
ROOT = Path(__file__).resolve().parents[1]
MAX_BYTES = 2_000_000


class LiveVerificationError(RuntimeError):
    """Origin or published content did not satisfy the release contract."""


def expected_files(root: Path) -> dict[str, bytes]:
    area = root / "ai-dev"
    feed_bytes = (area / "feed.json").read_bytes()
    data = json.loads(feed_bytes.decode("utf-8"))
    entries = data["entries"]
    if not isinstance(entries, list):
        raise LiveVerificationError("ai-dev feed entries must be a list")
    expected = {f"{BASE_URL}/ai-dev/feed.json": feed_bytes,
                f"{BASE_URL}/ai-dev/": (area / "index.html").read_bytes()}
    seen = set()
    for entry in entries:
        day = entry["published_at"]
        path = entry["path"]
        if not re.fullmatch(r"20\d{2}-\d{2}-\d{2}", day):
            raise LiveVerificationError("invalid day")
        if entry["id"] != f"daily-{day}" or path != f"daily/{day}/":
            raise LiveVerificationError("invalid or unsafe daily stable ID/path")
        if entry["id"] in seen:
            raise LiveVerificationError("duplicate feed ID")
        seen.add(entry["id"])
        html_path = area / "daily" / day / "index.html"
        page = html_path.read_bytes()
        if b"<h1" not in page or b"https://" not in page or b"source-note" not in page:
            raise LiveVerificationError(f"{day}: missing public article features")
        expected[f"{BASE_URL}/ai-dev/{path}"] = page
    return expected


def fetch_https(url: str) -> bytes:
    request = Request(url, headers={
        "User-Agent": "NAOJUN-Pages-Acceptance/1.0",
        "Accept-Encoding": "identity",
        "Cache-Control": "no-cache",
    })
    with urlopen(request, timeout=15) as response:
        if response.status != 200:
            raise LiveVerificationError(f"unexpected HTTP {response.status}: {url}")
        actual_url = response.geturl()
        given = urlsplit(url)
        actual = urlsplit(actual_url)
        if actual.scheme != "https" or actual.hostname != given.hostname or actual.path != given.path:
            raise LiveVerificationError(f"unexpected redirect {actual_url}: expected {url}")
        payload = response.read(MAX_BYTES + 1)
        if len(payload) > MAX_BYTES:
            raise LiveVerificationError(f"large public payload {url}")
        return payload


def check_once(root: Path, fetch=fetch_https) -> list[dict[str, str]]:
    checked = []
    for url, expected in expected_files(root).items():
        actual = fetch(url)
        if actual != expected:
            raise LiveVerificationError(
                f"content mismatch {url}: origin sha256={hashlib.sha256(actual).hexdigest()}"
                f" repository sha256={hashlib.sha256(expected).hexdigest()}"
            )
        checked.append({"url": url, "http": "200",
                        "sha256": hashlib.sha256(actual).hexdigest()})
    return checked


def retry_check(check, sleep=time.sleep, delays=(30, 60)):
    """Initial attempt plus exactly two bounded retries for Pages propagation."""
    for attempt in range(len(delays) + 1):
        try:
            return check()
        except Exception:
            if attempt == len(delays):
                raise
            sleep(delays[attempt])
    raise AssertionError("unreachable")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--receipt", type=Path, default=Path("recovery-artifacts/ai-dev-live-proof.json"))
    args = parser.parse_args()
    try:
        result = retry_check(lambda: check_once(args.root))
    except Exception as exc:
        print(f"AI-dev LIVE VERIFICATION FAIL: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1
    proof = {"status": "live-http200-exact-content-verified",
             "checked_at_utc": datetime.now(timezone.utc).isoformat(),
             "github_sha": __import__("os").environ.get("GITHUB_SHA", "local"),
             "urls": result}
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(proof, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
