from __future__ import annotations

import json
import os
import urllib.parse
import urllib.request


PDS = "https://bsky.social"
PUBLIC = "https://public.api.bsky.app"
KEEP_URLS = {
    "https://naojun.jp/admissions/weekly/2026-09-14/",
    "https://naojun.jp/investment/weekly/2026-09-19/",
}


def get_json(url: str) -> dict[str, object]:
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json(url: str, payload: dict[str, object], token: str | None = None) -> dict[str, object]:
    headers = {"Content-Type": "application/json", "User-Agent": "NaoJun-Cleanup/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        raw = response.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def main() -> int:
    handle = os.environ["BSKY_HANDLE"]
    password = os.environ["BSKY_APP_PASSWORD"]
    profile = get_json(
        f"{PUBLIC}/xrpc/app.bsky.feed.getAuthorFeed?"
        + urllib.parse.urlencode({"actor": handle, "limit": 100})
    )
    feed = profile.get("feed", [])
    if not isinstance(feed, list):
        raise RuntimeError("unexpected Bluesky feed response")

    keep_seen: set[str] = set()
    delete_rkeys: list[str] = []
    for item in feed:
        if not isinstance(item, dict):
            continue
        post = item.get("post", {})
        if not isinstance(post, dict):
            continue
        uri = str(post.get("uri", ""))
        embed = post.get("embed", {})
        external = embed.get("external", {}) if isinstance(embed, dict) else {}
        url = str(external.get("uri", "")) if isinstance(external, dict) else ""
        if url in KEEP_URLS and url not in keep_seen:
            keep_seen.add(url)
            continue
        if uri:
            delete_rkeys.append(uri.rsplit("/", 1)[-1])

    if keep_seen != KEEP_URLS:
        raise RuntimeError(f"keep set mismatch: {sorted(keep_seen)}")
    if len(delete_rkeys) != 12:
        raise RuntimeError(f"expected 12 deletions, found {len(delete_rkeys)}")

    session = post_json(
        f"{PDS}/xrpc/com.atproto.server.createSession",
        {"identifier": handle, "password": password},
    )
    token = str(session["accessJwt"])
    did = str(session["did"])
    for rkey in delete_rkeys:
        post_json(
            f"{PDS}/xrpc/com.atproto.repo.deleteRecord",
            {"repo": did, "collection": "app.bsky.feed.post", "rkey": rkey},
            token,
        )
    print(json.dumps({"deleted": len(delete_rkeys), "kept": len(keep_seen)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
