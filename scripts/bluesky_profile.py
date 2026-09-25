from __future__ import annotations

import json
import os
import urllib.error
import urllib.parse
import urllib.request


PDS = "https://bsky.social"
DISPLAY_NAME = "Studio NaoJun"
DESCRIPTION = "中学受験レポート / Investment Observatory / 制作物の更新通知。\nhttps://naojun.jp/"


def post_json(url: str, payload: dict[str, object], token: str | None = None) -> dict[str, object]:
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


def get_json(url: str, token: str) -> dict[str, object]:
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {token}", "User-Agent": "NaoJun-Publisher/1.0"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    handle = os.environ["BSKY_HANDLE"].strip()
    password = os.environ["BSKY_APP_PASSWORD"].strip()
    session = post_json(
        f"{PDS}/xrpc/com.atproto.server.createSession",
        {"identifier": handle, "password": password},
    )
    token = str(session["accessJwt"])
    did = str(session["did"])

    params = urllib.parse.urlencode(
        {"repo": did, "collection": "app.bsky.actor.profile", "rkey": "self"}
    )
    try:
        current = get_json(f"{PDS}/xrpc/com.atproto.repo.getRecord?{params}", token)
        record = dict(current.get("value") or {})
    except urllib.error.HTTPError as exc:
        if exc.code != 400:
            raise
        payload = json.loads(exc.read().decode("utf-8"))
        if payload.get("error") != "RecordNotFound":
            raise
        record = {}
    record["$type"] = "app.bsky.actor.profile"
    record["displayName"] = DISPLAY_NAME
    record["description"] = DESCRIPTION

    result = post_json(
        f"{PDS}/xrpc/com.atproto.repo.putRecord",
        {
            "repo": did,
            "collection": "app.bsky.actor.profile",
            "rkey": "self",
            "record": record,
        },
        token,
    )
    print(json.dumps({"handle": handle, "uri": result.get("uri")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
