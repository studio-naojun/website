"""Repair exactly two historical mojibake posts, and provision official avatar.

Runs on GitHub Actions only on an explicit manual dispatch. Never logs secrets,
never publishes a third post, and never deletes existing content.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import bluesky_publish as publisher

ROOT = Path(__file__).resolve().parents[1]
PDS = "https://bsky.social"
DID = "did:plc:i7bmtrkfyadjjakfdsqdjwqv"
TARGETS = {
    "weekly-2026-10-12": {
        "rkey": "3my5jvrwvn72u",
        "cid": "bafyreiddzhzsard4i3pomvu2hc6iwyqpialel2nutpxwgp2b25wxcp7ef4",
    },
    "weekly-2026-10-05": {
        "rkey": "3my5jt5gqrx24",
        "cid": "bafyreihj6hjwvttyyev4i2q5gxovnywai6jdj2yfnt4vzqor5kyr7jgobq",
    },
}
AVATAR = ROOT / "assets" / "brand" / "bluesky-avatar.png"


def get_record(collection: str, rkey: str, token: str | None = None) -> dict:
    qs = urllib.parse.urlencode({"repo": DID, "collection": collection, "rkey": rkey})
    headers = {"User-Agent": "NaoJun-Repair/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    with urllib.request.urlopen(
        urllib.request.Request(f"{PDS}/xrpc/com.atproto.repo.getRecord?{qs}", headers=headers),
        timeout=25,
    ) as response:
        return json.load(response)


def load_expected() -> dict[str, dict]:
    entries = {str(e["id"]): e for e in publisher.load_feed("admissions/feed.json") or []}
    result = {}
    for article_id, target in TARGETS.items():
        if article_id not in entries:
            raise RuntimeError("Expected feed entry not present: " + article_id)
        record = publisher.post_record("admissions", entries[article_id])
        if "????" in record["text"] or "\ufffd" in record["text"] or len(record["text"]) > 300:
            raise RuntimeError("Unsafe or oversized source content")
        if not record["text"].endswith(publisher.article_url("admissions", entries[article_id])):
            raise RuntimeError("Canonical URL missing")
        result[article_id] = record
    return result


def plan_posts(expected: dict, token: str | None) -> list[tuple[str, str, dict, dict]]:
    planned = []
    for article_id, target in TARGETS.items():
        old = get_record("app.bsky.feed.post", target["rkey"], token)
        value = old["value"]
        expected_url = expected[article_id]["embed"]["external"]["uri"]
        if value.get("$type") != "app.bsky.feed.post" or expected_url not in str(value.get("text", "")):
            raise RuntimeError(f"Unexpected original record identity: {article_id}")
        if value["text"] == expected[article_id]["text"]:
            print(json.dumps({"article": article_id, "status": "already_correct"}, ensure_ascii=False))
            continue
        if old["cid"] != target["cid"]:
            raise RuntimeError(f"Record has changed since initial inspection: {article_id}")
        if value["text"].count("?") < 20:
            raise RuntimeError(f"Original does not meet known mojibake signature: {article_id}")
        if value.get("embed", {}).get("external", {}).get("uri") != expected_url:
            raise RuntimeError(f"Original embedded link changed: {article_id}")
        updated = dict(value)
        for key in ("text", "langs", "facets", "embed"):
            updated[key] = expected[article_id][key]
        # Keep original timestamp so the correction is not republished as new.
        if updated.get("createdAt") != value.get("createdAt"):
            raise RuntimeError("Original post timestamp not preserved")
        planned.append((article_id, target["rkey"], old, updated))
    return planned


def put_record(collection: str, rkey: str, cid: str, record: dict, token: str):
    return publisher.request_json(
        f"{PDS}/xrpc/com.atproto.repo.putRecord",
        {"repo": DID, "collection": collection, "rkey": rkey,
         "swapRecord": cid, "record": record},
        token,
    )


def set_avatar(token: str, profile: dict) -> str:
    value = profile["value"]
    if value.get("avatar"):
        return "already_set"
    if not AVATAR.is_file():
        raise RuntimeError("The reviewed avatar image is missing")
    image = AVATAR.read_bytes()
    if not image.startswith(b"\x89PNG\r\n\x1a\n") or len(image) >= 1_000_000:
        raise RuntimeError("Avatar PNG invalid or too large")
    request = urllib.request.Request(
        f"{PDS}/xrpc/com.atproto.repo.uploadBlob", data=image, method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": "image/png",
                 "User-Agent": "NaoJun-Repair/1.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as resp:
        blob = json.load(resp)["blob"]
    new_value = dict(value)
    new_value["avatar"] = blob
    put_record("app.bsky.actor.profile", "self", profile["cid"], new_value, token)
    check = get_record("app.bsky.actor.profile", "self", token)["value"].get("avatar")
    if check != blob:
        raise RuntimeError("Avatar PDS readback mismatch")
    return "updated"


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--fix-posts", action="store_true")
    p.add_argument("--set-avatar", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    args = p.parse_args()
    if not args.dry_run and not args.fix_posts and not args.set_avatar:
        p.error("No requested action; specify --dry-run, --fix-posts or --set-avatar")
    expected = load_expected()
    print(json.dumps({"expected_post_urls": [
        record["embed"]["external"]["uri"] for record in expected.values()],
        "avatar_file_sha256": hashlib.sha256(AVATAR.read_bytes()).hexdigest() if AVATAR.is_file() else None,
        "dry_run": args.dry_run}, ensure_ascii=False))
    if args.dry_run:
        return 0
    handle = os.environ.get("BSKY_HANDLE", "").strip()
    password = os.environ.get("BSKY_APP_PASSWORD", "").strip()
    if not handle or not password:
        raise RuntimeError("Existing GitHub Actions Bluesky credentials unavailable")
    token, did = publisher.create_session(handle, password)
    if did != DID:
        raise RuntimeError("Refusing to modify a different Bluesky account")
    planned = plan_posts(expected, token) if args.fix_posts else []
    profile = get_record("app.bsky.actor.profile", "self", token) if args.set_avatar else None
    for article_id, rkey, old, updated in planned:
        put_record("app.bsky.feed.post", rkey, old["cid"], updated, token)
        got = get_record("app.bsky.feed.post", rkey, token)
        if got["value"].get("text") != updated["text"] or got["value"].get("embed") != updated["embed"]:
            raise RuntimeError("Post readback mismatch: " + article_id)
        print(json.dumps({"article": article_id, "status": "repaired",
                          "post_url": f"https://bsky.app/profile/naojun.jp/post/{rkey}"}, ensure_ascii=False))
    if profile is not None:
        state = set_avatar(token, profile)
        print(json.dumps({"avatar_status": state}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(json.dumps({"status": "blocked", "type": type(e).__name__,
                          "reason": str(e)[:180]}, ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
