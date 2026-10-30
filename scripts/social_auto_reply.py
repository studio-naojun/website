"""Opt-in-only NAOJUN Bluesky replies: publish first, notify owner afterwards.

Routine responses do not wait for a human approval. Post a reply only to an
explicit DID-verified @naojun.jp mention with a concrete answer supported by
first-party facts or a Muse-produced, owner-controlled outbox entry.
Unknown, promotional, disputed and high-stakes topics are skipped automatically.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from muse_reply_lab import OWN_DID, AT_URI, ThreadUnavailable, draft_flags, fetch_public_thread
from social_publish import Client, COLLECTION, JST, PDS, RecordMissing, PublicationUncertain, dt, request_json

ROOT = Path(__file__).resolve().parents[1]
REPO = "studio-naojun/website"
APPVIEW_HOST = "https://public.api.bsky.app"
GITHUB_API = "https://api.github.com/repos/" + REPO + "/issues"
OUTBOX = ROOT / "content" / "muse-reply-outbox.json"
ACTIVATED = datetime(2026, 10, 30, 9, 15, tzinfo=timezone.utc)
MAX_REPLY_DAILY = 4
MIN_REPLY_GAP = timedelta(minutes=45)
MAX_AGE = timedelta(hours=24)
STOP_WORDS = ("返信しないで", "返信不要", "返事不要", "もう返さないで", "通知しないで",
              "連絡しないで", "stop replying", "do not reply", "don't reply",
              "opt out", "unsubscribe", "no bots")
BLOCKED_LABELS = {"spam", "porn", "sexual", "graphic-media", "nudity", "gore"}


def now_utc():
    return datetime.now(timezone.utc)


def tagged_did(record, did=OWN_DID):
    for facet in record.get("facets", []):
        if not isinstance(facet, dict):
            continue
        for feature in facet.get("features", []):
            if (isinstance(feature, dict) and
                    feature.get("$type") == "app.bsky.richtext.facet#mention" and
                    feature.get("did") == did):
                return True
    return False


def eligible(n, now):
    if n.get("reason") not in ("mention", "reply"):
        return False
    uri, author, record = n.get("uri"), n.get("author"), n.get("record")
    if not isinstance(uri, str) or not AT_URI.fullmatch(uri):
        return False
    if not isinstance(author, dict) or author.get("did") == OWN_DID:
        return False
    if not isinstance(record, dict) or not tagged_did(record):
        return False
    text = record.get("text")
    if not isinstance(text, str) or len(text) > 1000:
        return False
    if any(word in text.casefold() for word in STOP_WORDS):
        return False
    if n.get("isRead") and not n.get("reason") == "mention":
        # A read flag alone is not proof of being answered; we still check
        # actual replies below. For non-mention interactions prefer not to act.
        return False
    if any(isinstance(l, dict) and l.get("val") in BLOCKED_LABELS for l in n.get("labels", [])):
        return False
    if any(isinstance(l, dict) and l.get("val") == "bot"
           for l in author.get("labels", [])):
        return False
    try:
        when = dt(n.get("indexedAt") or record.get("createdAt") or "")
    except (ValueError, TypeError):
        return False
    return ACTIVATED <= when <= now and now - when <= MAX_AGE


def relevant_subject(context, inquiry):
    """Use words in the customer's question or the studio's own ancestor post."""
    text = inquiry.get("record", {}).get("text", "")
    studio_text = " ".join(
        item["text"] for item in context["thread"] if item.get("author_did") == OWN_DID
    )
    joint = (text + " " + studio_text).casefold()
    if any(x in joint for x in ("アメツタ", "ツタ", "ametsuta")):
        return "ametsuta"
    if any(x in joint for x in ("商品横断検索", "janコード", "jan コード", "jan検索", "型番")):
        return "jan"
    if any(x in joint for x in ("究極の3行", "究極の３行", "3行", "３行", "3lines")):
        return "3lines"
    return None


def queued_reply(context, notice, queue):
    item = queue.get(context["target_uri"]) if isinstance(queue, dict) else None
    if not isinstance(item, dict):
        return None
    if item.get("target_uri") != context["target_uri"]:
        return None
    if item.get("author_did") != notice.get("author", {}).get("did"):
        return None
    text = item.get("text")
    if not isinstance(text, str) or draft_flags(text):
        return None
    return text.strip()


def choose_reply(context, notice, queue):
    """No generic engagement bait: known answers only, with strict skips."""
    inquiry = str(notice.get("record", {}).get("text", ""))
    lower = inquiry.casefold()
    if any(x in lower for x in ("政治", "株価", "おすすめ銘柄", "投資信託", "法律", "医療", "病気",
                                "診断", "儲かる", "個人情報", "パスワード", "犯罪", "争い", "炎上")):
        return None
    # A drafted Muse reply can be put in this owner-controlled file. It is
    # verified again against the real notification; no human approval gate.
    muse = queued_reply(context, notice, queue)
    if muse:
        return muse
    subject = relevant_subject(context, notice)
    if not subject:
        return None
    if re.search(r"(不具合|バグ|動かない|止まる|起動しない|エラー)", inquiry):
        if subject == "ametsuta":
            return "動かない場面を確認したいです。使っている端末とブラウザ、どの操作のときに止まるか教えてもらえますか。"
        if subject == "jan":
            return "検索がうまくいかない状況ですね。入力したのが商品名・型番・JANコードのどれかと、使ったブラウザを教えてもらえますか。"
        return "どの操作で止まるかを確認したいです。使っているブラウザと、入力した文章の長さを教えてもらえますか。"
    if re.search(r"(料金|無料|有料|課金|お金|値段|費用)", inquiry):
        return {
            "ametsuta": "アメツタは無料のブラウザゲームです。インストールしなくても遊べます。",
            "jan": "商品横断検索は無料で使えるブラウザツールです。商品名・型番・JANコードから探せます。",
            "3lines": "究極の3行は無料のブラウザツールです。長い文章を3つの要点に整理できます。",
        }[subject]
    if re.search(r"(使い方|操作|遊び方|どうや|やり方|何をすれば|どう使|使える|何ができる)", inquiry):
        return {
            "ametsuta": "押している間にツタが伸びて、離すと倒れます。短めに倒すところから試すと、操作の感覚がつかみやすいです。",
            "jan": "商品名・型番・JANコードを入力すると、複数のお店を探せます。商品のバーコードから調べる方法にも対応しています。",
            "3lines": "整理したい文章を入力すると、内容を3つの要点にまとめられます。まずは『架空の例文で試す』から触ってみることもできます。",
        }[subject]
    if re.search(r"(リンク|URL|どこ|サイト|試せる場所)", inquiry):
        return {
            "ametsuta": "こちらから遊べます。https://naojun.jp/works/ametsuta/",
            "jan": "こちらにあります。https://naojun.jp/tools/jan/",
            "3lines": "こちらで試せます。https://naojun.jp/tools/3lines/",
        }[subject]
    return None


def load_queue(path=OUTBOX):
    if not path.exists():
        return {}
    raw = json.loads(path.read_text(encoding="utf-8"))
    items = raw.get("items", [])
    if not isinstance(items, list) or len(items) > 40:
        raise ValueError("invalid Muse reply queue")
    result = {}
    for row in items:
        if isinstance(row, dict) and isinstance(row.get("target_uri"), str) and AT_URI.fullmatch(row["target_uri"]):
            result[row["target_uri"]] = row
    return result


def reply_key(target_uri):
    """Stable lexicon TID based solely on target; never changes on retry."""
    seed = hashlib.sha256(("naojun-reply-v1:" + target_uri).encode()).digest()
    alph = "234567abcdefghijklmnopqrstuvwxyz"
    # Use target's own TID timestamp as anchor, while hashing its unique URI.
    leaf = target_uri.rsplit("/", 1)[-1]
    if len(leaf) == 13 and all(c in alph for c in leaf):
        raw = 0
        for c in leaf:
            raw = (raw << 5) | alph.index(c)
        micros = raw >> 10
    else:
        micros = int(datetime(2026, 10, 30, tzinfo=timezone.utc).timestamp() * 1_000_000)
    value = ((micros + 1_000_000 + int.from_bytes(seed[:2], "big")) << 10) | (seed[2] << 2 | (seed[3] & 3))
    return "".join(alph[(value >> shift) & 31] for shift in range(60, -1, -5))


def compose_reply(context, text, now):
    root, target = context["root_uri"], context["target_uri"]
    if not AT_URI.fullmatch(root) or not AT_URI.fullmatch(target):
        raise ValueError("invalid reply references")
    return {
        "$type": COLLECTION, "text": text, "langs": ["ja"],
        "reply": {"root": {"uri": root, "cid": context["root_cid"]},
                  "parent": {"uri": target, "cid": context["target_cid"]}},
        "createdAt": now.isoformat().replace("+00:00", "Z"),
    }


def already_replied(records, target_uri):
    return any(
        row.get("value", {}).get("reply", {}).get("parent", {}).get("uri") == target_uri
        for row in records if isinstance(row, dict)
    )


def within_quota(records, now):
    times = []
    for row in records:
        value = row.get("value", {})
        if not value.get("reply"):
            continue
        try:
            times.append(dt(value["createdAt"]))
        except (ValueError, KeyError, TypeError):
            continue
    today = now.astimezone(JST).date()
    if sum(t.astimezone(JST).date() == today for t in times) >= MAX_REPLY_DAILY:
        return False
    return not times or now - max(times) >= MIN_REPLY_GAP


def publish_once(client, token, ctx, text, now, sleeper=time.sleep):
    key = reply_key(ctx["target_uri"])
    try:
        existing = client.get_record(OWN_DID, key, token)
        return {"status": "already_published", "uri": existing["uri"],
                "post_url": "https://bsky.app/profile/naojun.jp/post/" + key}
    except RecordMissing:
        pass
    record = compose_reply(ctx, text, now)
    payload = {"repo": OWN_DID, "collection": COLLECTION, "rkey": key, "record": record}
    ambiguous = False
    try:
        client.request(PDS + "/xrpc/com.atproto.repo.createRecord", payload, token)
    except urllib.error.HTTPError as exc:
        if 400 <= exc.code < 500 and exc.code != 409:
            raise
        ambiguous = True
    except (urllib.error.URLError, TimeoutError, ConnectionError):
        ambiguous = True
    for delay in (0, 2, 5):
        sleeper(delay)
        try:
            row = client.get_record(OWN_DID, key, token)
            saved = row.get("value", {})
            # If a retry regenerated a different text, the stored original wins.
            if saved.get("reply", {}).get("parent", {}).get("uri") != ctx["target_uri"]:
                raise PublicationUncertain("stored reply has different recipient")
            return {"status": "reconciled" if ambiguous else "published",
                    "uri": row["uri"],
                    "post_url": "https://bsky.app/profile/naojun.jp/post/" + key}
        except (RecordMissing, urllib.error.URLError, TimeoutError, ConnectionError):
            continue
    raise PublicationUncertain("write status uncertain; next run reconciles same TID")


def _github(url, payload=None, token=None):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "NAOJUN-ReplyNotice/1.0"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request, timeout=18) as response:
        return json.loads(response.read(90000).decode("utf-8"))


def _issue_title(post):
    return "【NaoJun Bluesky自動返信】" + post["uri"].rsplit("/", 1)[-1]


def notification_exists(post, token):
    entries = _github(GITHUB_API + "?state=all&per_page=100&sort=created&direction=desc",
                      token=token)
    return next((x for x in entries if x.get("title") == _issue_title(post)), None)


def notify_after_post(post, original_uri, reply_text, token, sender=_github):
    """Create a normal assigned GitHub issue, which delivers GitHub notifications."""
    if not token:
        raise RuntimeError("notification credential missing")
    if not post["uri"].startswith("at://" + OWN_DID + "/app.bsky.feed.post/"):
        raise ValueError("not our post")
    body = (
        "NAOJUN公式Blueskyから、本人が明示的にメンションした会話へ自動返信しました。"
        "\n\n**公開返信:** " + post["post_url"] +
        "\n\n**相手の元投稿:** " + original_uri +
        "\n\n**送信した文面:**\n\n> " + reply_text.replace("\n", "\n> ") +
        "\n\n問題がある場合はBlueskyの公式アカウントからこの投稿を削除してください。"
        "\n再開・権限承認を求めるチケットではありません。"
        "\n\n[@ffz2bpjyj4](https://github.com/ffz2bpjyj4)"
    )
    issue = sender(GITHUB_API, {"title": _issue_title(post),
                                "body": body, "assignees": ["ffz2bpjyj4"]}, token)
    return {"issue": issue["number"], "issue_url": issue["html_url"]}


def previous_auto_reply(client, token, ctx):
    """Find the deterministic reply if an earlier run lost its post/alert ACK."""
    key = reply_key(ctx["target_uri"])
    try:
        row = client.get_record(OWN_DID, key, token)
    except RecordMissing:
        return None
    value = row.get("value", {})
    if value.get("reply", {}).get("parent", {}).get("uri") != ctx["target_uri"]:
        raise PublicationUncertain("existing record belongs to another target")
    return {
        "status": "already_published", "uri": row["uri"],
        "post_url": "https://bsky.app/profile/naojun.jp/post/" + key,
        "text": value.get("text", ""),
    }


def ensure_notification(post, original_uri, text, token, finder=notification_exists,
                        sender=notify_after_post):
    """Idempotent after-post GitHub notification, never a pre-post gate."""
    if not token:
        raise RuntimeError("notification credential missing after publishing")
    old = finder(post, token)
    if old:
        return {"issue": old["number"], "issue_url": old["html_url"],
                "status": "already_notified"}
    return {**sender(post, original_uri, text, token), "status": "notified"}


def _notifications(token, requester=request_json):
    url = PDS + "/xrpc/app.bsky.notification.listNotifications?limit=100"
    result = requester(url, token=token)
    return result.get("notifications", [])


def write_result(result, env):
    path = Path(env.get("NAOJUN_REPLY_RECEIPT", "/tmp/naojun-reply-result.json"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary = env.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as handle:
            handle.write("## NAOJUN autonomous opt-in replies\n\n```json\n" +
                         json.dumps(result, ensure_ascii=False, indent=2) + "\n```\n")
    print(json.dumps(result, ensure_ascii=False))


def main(argv=None, environ=None):
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true",
                        help="Offline no-auth self-check; never posts or alerts")
    parser.add_argument("--scan-only", action="store_true",
                        help="Check current opt-in notifications and facts; never posts or alerts")
    args = parser.parse_args(argv)
    env = os.environ if environ is None else environ
    now = now_utc()
    out = {"observed_at": now.isoformat(), "status": "pending", "published": [], "notified": []}
    if args.dry_run:
        out["status"] = "dry_run"
        write_result(out, env)
        return 0
    try:
        if not env.get("BSKY_HANDLE") or not env.get("BSKY_APP_PASSWORD"):
            raise RuntimeError("existing account credentials unavailable")
        client = Client()
        session = client.request(PDS + "/xrpc/com.atproto.server.createSession",
                                 {"identifier": env["BSKY_HANDLE"],
                                  "password": env["BSKY_APP_PASSWORD"]})
        if session["did"] != OWN_DID:
            raise RuntimeError("account did mismatch")
        token = session["accessJwt"]
        notices = sorted(
            (n for n in _notifications(token) if eligible(n, now)),
            key=lambda x: x.get("indexedAt", ""),
        )
        out["eligible"] = len(notices)
        if not notices:
            out["status"] = "no_opt_in_requests"
            write_result(out, env)
            return 0
        # Existing manual/automatic replies must not be repeated.
        records = client.history(OWN_DID, token)
        queue = load_queue()
        for n in notices:
            try:
                ctx = fetch_public_thread(n["uri"])
            except (ThreadUnavailable, ValueError, urllib.error.URLError, TimeoutError):
                out["skipped_unavailable"] = out.get("skipped_unavailable", 0) + 1
                continue
            if ctx["target_uri"] != n["uri"] or ctx["target_cid"] != n["cid"]:
                continue
            if not ctx.get("thread") or ctx["thread"][-1]["author_did"] != n["author"]["did"]:
                continue
            if ctx["invocation"] != "explicit_mention":
                continue
            # Resume the *notification* even if a previous run sent successfully
            # and then failed to notify. Never wait for the daily post quota.
            earlier = previous_auto_reply(client, token, ctx)
            if earlier:
                if args.scan_only:
                    out["status"] = "scan_only_existing_reply"
                    out["qualified"] = n["uri"]
                    break
                out["published"].append({
                    k: earlier[k] for k in ("status", "uri", "post_url")
                })
                notice = ensure_notification(earlier, n["uri"], earlier["text"],
                                             env.get("GITHUB_TOKEN", ""))
                out["notified"].append(notice)
                out["status"] = "published_and_notified"
                break
            # Catch other manual answers. Never send a second notification
            # for a manually written post.
            if already_replied(records, n["uri"]):
                out["skipped_existing"] = out.get("skipped_existing", 0) + 1
                continue
            if not within_quota(records, now) and not args.scan_only:
                out["status"] = "quota_wait"
                break
            text = choose_reply(ctx, n, queue)
            if text is None:
                out["skipped_unknown"] = out.get("skipped_unknown", 0) + 1
                continue
            requested_link = bool(re.search(
                r"(リンク|URL|どこ|サイト|試せる場所)", n["record"]["text"]
            ))
            if draft_flags(text, allow_url=requested_link and "https://" in text):
                out["skipped_quality"] = out.get("skipped_quality", 0) + 1
                continue
            # Validate both target and root CID from the fetched thread first.
            ctx["root_cid"] = ctx.get("root_cid") or next(
                (p.get("cid") for p in ctx["thread"] if p["uri"] == ctx["root_uri"]), None,
            )
            if not ctx["root_cid"]:
                # This draft-only extractor's normalized posts do not carry
                # root CID; the caller must fetch it before posting.
                root = urllib.parse.quote(ctx["root_uri"], safe="")
                payload = request_json(APPVIEW_HOST +
                    "/xrpc/app.bsky.feed.getPostThread?uri=" + root + "&depth=0")
                ctx["root_cid"] = payload["thread"]["post"]["cid"]
            if not ctx["root_cid"]:
                raise ThreadUnavailable("root CID unavailable")
            if args.scan_only:
                out["status"] = "scan_only_qualified"
                out["qualified"] = n["uri"]
                break
            reply = publish_once(client, token, ctx, text, now)
            out["published"].append(reply)
            out["target_uri"] = n["uri"]
            out["status"] = "posted_needs_notice"
            write_result(out, env)
            notice = ensure_notification(reply, n["uri"], text,
                                         env.get("GITHUB_TOKEN", ""))
            out["notified"].append(notice)
            out["status"] = "published_and_notified"
            break
        else:
            out["status"] = "scan_only_no_answer" if args.scan_only else "no_answerable_requests"
        write_result(out, env)
        return 0 if out["status"] != "posted_needs_notice" else 1
    except (ThreadUnavailable, urllib.error.URLError, RuntimeError, ValueError, KeyError) as exc:
        out["status"] = "recovery_required"
        out["reason"] = type(exc).__name__
        if isinstance(exc, urllib.error.HTTPError):
            out["http_status"] = exc.code
        write_result(out, env)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
