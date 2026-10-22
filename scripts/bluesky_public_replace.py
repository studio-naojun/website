"""Restore two visibly corrupted Bluesky posts with verified public replacements.

Bluesky AppView ignores text updates via putRecord. This script creates a
corrected, transparently labelled replacement and independently verifies it is
public BEFORE removing the corresponding old mojibake post. Re-runs reuse any
existing replacement. The two old posts had zero social interactions.
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

import bluesky_publish as publisher
import bluesky_repair as original

DID = original.DID
MARK = "【文字化け訂正・再掲】"
API = "https://public.api.bsky.app"
POST_COLLECTION = "app.bsky.feed.post"


def json_get(url: str) -> dict:
    with urllib.request.urlopen(
        urllib.request.Request(url, headers={"User-Agent": "NaoJun-Publisher/1.0"}),
        timeout=15,
    ) as r:
        return json.load(r)


def public_post(uri: str) -> dict | None:
    params = urllib.parse.urlencode({"uris": uri})
    posts = json_get(f"{API}/xrpc/app.bsky.feed.getPosts?{params}").get("posts", [])
    return posts[0] if posts else None


def repo_posts() -> list[dict]:
    # ATProto may return a cursor even when the first page is the last page.
    # Follow it safely rather than interpreting cursor presence as overflow.
    result = []
    cursor = None
    seen = set()
    for _ in range(10):
        query = {"repo": DID, "collection": POST_COLLECTION, "limit": 100}
        if cursor:
            query["cursor"] = cursor
        args = urllib.parse.urlencode(query)
        data = json_get(f"{original.PDS}/xrpc/com.atproto.repo.listRecords?{args}")
        page = data.get("records", [])
        result.extend(page)
        next_cursor = data.get("cursor")
        if not page or not next_cursor:
            return result
        if next_cursor in seen:
            raise RuntimeError("Repeated post-record cursor; refuse ambiguous scan")
        seen.add(next_cursor)
        cursor = next_cursor
    raise RuntimeError("Post-record listing exceeded bounded pagination")


def replacement_record(entry: dict) -> dict:
    labelled = dict(entry)
    labelled["title"] = MARK + entry["title"]
    record = publisher.post_record("admissions", labelled)
    if MARK not in record["text"] or len(record["text"]) > 300:
        raise RuntimeError("Invalid correction label or record length")
    return record


def existing_replacement(records: list[dict], desired: dict) -> dict | None:
    matching = [
        r for r in records
        if r["value"].get("text") == desired["text"]
        and r["value"].get("embed", {}).get("external", {}).get("uri")
        == desired["embed"]["external"]["uri"]
    ]
    if len(matching) > 1:
        raise RuntimeError("Multiple historical correction records; do not duplicate")
    return matching[0] if matching else None


def wait_public(uri: str, desired: str) -> bool:
    for i in range(9):
        value = public_post(uri)
        if value and value.get("record", {}).get("text") == desired:
            return True
        if i < 8:
            time.sleep(4)
    return False


def missing_old_record(rkey: str) -> bool:
    try:
        original.get_record(POST_COLLECTION, rkey)
        return False
    except urllib.error.HTTPError as e:
        if e.code not in (400, 404):
            raise
        body = json.loads(e.read().decode("utf-8", "replace"))
        if body.get("error") != "RecordNotFound":
            raise RuntimeError("Unexpected old record readback error")
        return True


def main():
    handle = os.environ.get("BSKY_HANDLE", "").strip()
    password = os.environ.get("BSKY_APP_PASSWORD", "").strip()
    if not handle or not password:
        raise RuntimeError("Bluesky publishing secrets unavailable")
    access_token, did = publisher.create_session(handle, password)
    if did != DID:
        raise RuntimeError("Unexpected acting account")
    profile = json_get(f"{API}/xrpc/app.bsky.actor.getProfile?actor=naojun.jp")
    if profile.get("did") != DID or profile.get("handle") != "naojun.jp":
        raise RuntimeError("NAOJUN handle is not verified in public AppView")
    entries = {str(e["id"]): e for e in publisher.load_feed("admissions/feed.json") or []}
    expected = original.load_expected()
    records = repo_posts()

    # No changes until both source records and public engagement are checked.
    for article_id, old in original.TARGETS.items():
        if article_id not in entries:
            raise RuntimeError("Missing canonical feed article")
        legacy_uri = f"at://{DID}/{POST_COLLECTION}/{old['rkey']}"
        visible = public_post(legacy_uri)
        if visible and visible.get("record", {}).get("text") != expected[article_id]["text"]:
            if visible["record"]["text"].count("?") < 20:
                raise RuntimeError("Unexpected change in old public post: " + article_id)
            for key in ("likeCount", "replyCount", "repostCount", "quoteCount"):
                if visible.get(key, 0) > 0:
                    raise RuntimeError("Old post now has interactions; do not delete: " + article_id)
        if not missing_old_record(old["rkey"]):
            pds = original.get_record(POST_COLLECTION, old["rkey"])
            if pds["value"].get("text") != expected[article_id]["text"]:
                raise RuntimeError("Old PDS content changed unexpectedly: " + article_id)

    for article_id, old in original.TARGETS.items():
        desired = replacement_record(entries[article_id])
        old_uri = f"at://{DID}/{POST_COLLECTION}/{old['rkey']}"
        records = repo_posts()
        existing = existing_replacement(records, desired)
        if existing:
            new_uri = existing["uri"]
            status = "existing_replacement"
        else:
            made = publisher.request_json(
                f"{original.PDS}/xrpc/com.atproto.repo.createRecord",
                {"repo": DID, "collection": POST_COLLECTION, "record": desired},
                access_token,
            )
            new_uri = made["uri"]
            status = "created_replacement"
        if not new_uri.startswith(f"at://{DID}/{POST_COLLECTION}/") or new_uri == old_uri:
            raise RuntimeError("Unacceptable replacement URI")
        rkey = new_uri.rsplit("/", 1)[-1]
        stored = original.get_record(POST_COLLECTION, rkey, access_token)
        if stored["value"].get("text") != desired["text"]:
            raise RuntimeError("Replacement PDS readback mismatch")
        if not wait_public(new_uri, desired["text"]):
            raise RuntimeError("Replacement not yet visible in public Bluesky; original preserved")
        print(json.dumps({"article": article_id, "status": status,
                          "public_url": f"https://bsky.app/profile/naojun.jp/post/{rkey}",
                          "public_verified": True}, ensure_ascii=False))

        if missing_old_record(old["rkey"]):
            print(json.dumps({"article": article_id, "old_status": "already_removed"}))
            continue
        pds_old = original.get_record(POST_COLLECTION, old["rkey"], access_token)
        if pds_old["value"].get("text") != expected[article_id]["text"]:
            raise RuntimeError("Old PDS changed after preflight; will not delete")
        publisher.request_json(
            f"{original.PDS}/xrpc/com.atproto.repo.deleteRecord",
            {"repo": DID, "collection": POST_COLLECTION,
             "rkey": old["rkey"], "swapRecord": pds_old["cid"]},
            access_token,
        )
        if not missing_old_record(old["rkey"]):
            raise RuntimeError("Old record not removed from PDS")
        print(json.dumps({"article": article_id, "old_status": "pds_removed"}))
        for i in range(9):
            if public_post(old_uri) is None:
                print(json.dumps({"article": article_id, "old_status": "public_removed"}))
                break
            if i < 8:
                time.sleep(4)
        else:
            raise RuntimeError("Public AppView still shows old deleted post; index pending")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"status": "blocked", "type": type(e).__name__,
                          "reason": str(e)[:180]}, ensure_ascii=False), file=sys.stderr)
        sys.exit(2)
