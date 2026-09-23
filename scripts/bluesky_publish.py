from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PDS = "https://bsky.social"


def request_json(url: str, payload: dict[str, object], token: str | None = None) -> dict[str, object]:
    headers = {"Content-Type": "application/json", "User-Agent": "NaoJun-Publisher/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def load_feed(path: str, ref: str | None = None) -> list[dict[str, str]]:
    if ref:
        try:
            raw = subprocess.check_output(
                ["git", "show", f"{ref}:{path}"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
            )
        except subprocess.CalledProcessError:
            return []
        payload = json.loads(raw)
    else:
        payload = json.loads((ROOT / path).read_text(encoding="utf-8"))
    return [entry for entry in payload.get("entries", []) if isinstance(entry, dict)]


def new_entries(path: str, before: str) -> list[dict[str, str]]:
    current = load_feed(path)
    previous = load_feed(path, before) if before and set(before) != {"0"} else []
    old_ids = {str(entry.get("id", "")) for entry in previous}
    return [entry for entry in current if str(entry.get("id", "")) not in old_ids]


def article_url(section: str, entry: dict[str, str]) -> str:
    path = str(entry.get("path", "")).strip("/")
    return f"https://naojun.jp/{section}/{path}/"


def post_text(section: str, entry: dict[str, str]) -> str:
    title = str(entry.get("title", "")).strip()
    summary = str(entry.get("summary", "")).strip()
    url = article_url(section, entry)
    prefix = "中学受験レポート" if section == "admissions" else "Investment Observatory"
    text = f"{prefix}を更新しました。\n\n{title}\n\n{summary}\n\n{url}"
    if len(text) <= 300:
        return text
    room = max(0, 300 - len(f"{prefix}を更新しました。\n\n{title}\n\n\n\n{url}") - 1)
    short = summary[:room].rstrip() + ("…" if room and len(summary) > room else "")
    return f"{prefix}を更新しました。\n\n{title}\n\n{short}\n\n{url}"


def create_session(handle: str, password: str) -> tuple[str, str]:
    response = request_json(
        f"{PDS}/xrpc/com.atproto.server.createSession",
        {"identifier": handle, "password": password},
    )
    return str(response["accessJwt"]), str(response["did"])


def create_post(access_jwt: str, did: str, text: str) -> dict[str, object]:
    from datetime import datetime, timezone

    record = {
        "$type": "app.bsky.feed.post",
        "text": text,
        "createdAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    return request_json(
        f"{PDS}/xrpc/com.atproto.repo.createRecord",
        {"repo": did, "collection": "app.bsky.feed.post", "record": record},
        access_jwt,
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--before", default="")
    parser.add_argument("--latest", action="store_true", help="publish newest entry from each feed")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    handle = os.environ.get("BSKY_HANDLE", "").strip()
    password = os.environ.get("BSKY_APP_PASSWORD", "").strip()
    if not args.dry_run and (not handle or not password):
        print("Bluesky credentials are not configured; skipping.")
        return 0

    pending: list[tuple[str, dict[str, str]]] = []
    for section in ("admissions", "investment"):
        feed_path = f"{section}/feed.json"
        if args.latest:
            entries = load_feed(feed_path)[:1]
        else:
            entries = new_entries(feed_path, args.before)
        pending.extend((section, entry) for entry in reversed(entries))

    if not pending:
        print("No new feed entries to publish.")
        return 0

    if args.dry_run:
        for section, entry in pending:
            print(json.dumps({"section": section, "text": post_text(section, entry)}, ensure_ascii=False))
        return 0

    access_jwt, did = create_session(handle, password)
    results = []
    for section, entry in pending:
        result = create_post(access_jwt, did, post_text(section, entry))
        results.append({"section": section, "id": entry.get("id"), "uri": result.get("uri")})
    print(json.dumps(results, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
