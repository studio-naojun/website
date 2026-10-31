"""Cloud-native live acceptance for the existing Investment Observatory CI.
The published origin must return HTTP 200 and exact bytes from the merged source.
Do not confuse a successful PR/Pages deployment with independent live acceptance.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://naojun.jp"
MAX_BYTES = 2_000_000


class LiveVerificationError(RuntimeError):
    pass


def latest_entries(root: Path) -> tuple[bytes, dict[str, dict]]:
    source = (root / "investment" / "feed.json").read_bytes()
    payload = json.loads(source.decode("utf-8"))
    items = payload.get("entries")
    if not isinstance(items, list):
        raise LiveVerificationError("investment feed.entries must be an array")
    chosen = {}
    seen = set()
    for item in items:
        if not isinstance(item, dict):
            raise LiveVerificationError("invalid investment feed entry")
        key = item.get("id")
        if key in seen:
            raise LiveVerificationError("duplicate investment feed id")
        seen.add(key)
        kind = item.get("type")
        if kind == "weekly":
            date = str(item.get("id", ""))[7:]
            if not re.fullmatch(r"20\d{2}-\d{2}-\d{2}", date):
                raise LiveVerificationError("invalid weekly id")
            if item.get("path") != f"weekly/{date}/" or item.get("source_cycle") != f"investment-weekly-{date}":
                raise LiveVerificationError("weekly source-cycle mismatch")
        elif kind == "monthly":
            month = str(item.get("id", ""))[8:]
            if not re.fullmatch(r"20\d{2}-\d{2}", month):
                raise LiveVerificationError("invalid monthly id")
            if item.get("path") != f"monthly/{month}/" or not str(item.get("source_cycle", "")).startswith(f"investment-monthly-{month}-"):
                raise LiveVerificationError("monthly source-cycle mismatch")
            if item.get("previous_source_cycle") and not all(item.get(k) for k in ("first_published_at", "updated_at")):
                raise LiveVerificationError("monthly rollover provenance missing")
        else:
            continue
        if kind not in chosen or str(item.get("published_at", "")) > str(chosen[kind].get("published_at", "")):
            chosen[kind] = item
    if set(chosen) != {"weekly", "monthly"}:
        raise LiveVerificationError("latest weekly/monthly not found")
    return source, chosen


def expected_files(root: Path) -> tuple[dict[str, bytes], dict[str, dict]]:
    feed, selected = latest_entries(root)
    result = {f"{BASE_URL}/investment/feed.json": feed}
    for kind, item in selected.items():
        rel = str(item["path"])
        page = root / "investment" / rel / "index.html"
        content = page.read_bytes()
        html = content.decode("utf-8")
        if "<title>" not in html or "<h1>" not in html or "投資助言" not in html:
            raise LiveVerificationError(f"{kind} article lacks title/body/disclaimer")
        if str(item["title"]) not in html:
            raise LiveVerificationError(f"{kind} HTML title and feed differ")
        result[f"{BASE_URL}/investment/{rel}"] = content
    state = json.loads((root / "investment" / "state.json").read_text(encoding="utf-8"))
    if state.get("source_cycle") != selected["monthly"].get("source_cycle"):
        raise LiveVerificationError("monthly state and feed source-cycle mismatch")
    if sum(int(s["probability"]) for s in state.get("scenarios", [])) != 100:
        raise LiveVerificationError("monthly scenario probabilities do not total 100")
    return result, selected


def fetch_https(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": "NAOJUN-Investment-Pages-Acceptance/1.0",
                                "Accept-Encoding": "identity", "Cache-Control": "no-cache"})
    with urlopen(req, timeout=15) as resp:
        if resp.status != 200:
            raise LiveVerificationError(f"HTTP {resp.status}: {url}")
        orig, actual = urlsplit(url), urlsplit(resp.geturl())
        if actual.scheme != "https" or actual.hostname != orig.hostname or actual.path != orig.path:
            raise LiveVerificationError(f"unexpected redirect: {resp.geturl()}")
        content = resp.read(MAX_BYTES + 1)
        if len(content) > MAX_BYTES:
            raise LiveVerificationError(f"excessive live payload: {url}")
        return content


def check_once(root: Path, fetch=fetch_https) -> dict:
    expected, selected = expected_files(root)
    checked = []
    for url, data in expected.items():
        content = fetch(url)
        digest = hashlib.sha256(content).hexdigest()
        if content != data:
            raise LiveVerificationError(f"live mismatch: {url}: live_sha256={digest} expected_sha256={hashlib.sha256(data).hexdigest()}")
        checked.append({"url": url, "http_status": 200, "sha256": digest,
                        "title_body_feed_exact_match": True})
    return {"cycles": {kind: item["source_cycle"] for kind, item in selected.items()},
            "monthly_rollover": {k: selected["monthly"].get(k) for k in
                                 ("first_published_at", "previous_source_cycle", "source_cycle", "published_at", "updated_at")},
            "urls": checked}


def retry_check(fn, sleep=time.sleep, delays=(30, 60)):
    for attempt in range(len(delays) + 1):
        try:
            return fn()
        except Exception:
            if attempt == len(delays):
                raise
            sleep(delays[attempt])
    raise AssertionError("unreachable")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--receipt", type=Path, default=Path("recovery-artifacts/investment-live-proof.json"))
    args = parser.parse_args()
    proof = {"checked_at_utc": datetime.now(timezone.utc).isoformat(),
             "github_sha": os.environ.get("GITHUB_SHA", "local"),
             "verification": "direct origin HTTPS status200 and exact staged article/feed bytes"}
    try:
        proof.update(retry_check(lambda: check_once(args.root)))
        proof["status"] = "live-http200-exact-content-verified"
        code = 0
    except Exception as exc:
        proof["status"] = "live-verification-failed"
        proof["error_type"] = type(exc).__name__
        proof["error"] = str(exc)[:350]
        code = 1
    args.receipt.parent.mkdir(parents=True, exist_ok=True)
    args.receipt.write_text(json.dumps(proof, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(proof, ensure_ascii=False))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
