#!/usr/bin/env python3
"""Monthly FUTURECAST source-availability check. This does NOT generate forecasts."""
import argparse
import datetime as dt
import hashlib
import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from build_data_disagrees import DATA, validate

MAX_SAMPLE = 128 * 1024
ACCEPTED_HOSTS = {"www.iea.org", "ember-energy.org", "waymo.com"}


def utc_now():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def get_sources(data):
    out = []
    seen = set()
    for candidate in data["candidates"]:
        for src in candidate["sources"]:
            url = src["url"]
            p = urlparse(url)
            if p.scheme != "https" or p.hostname not in ACCEPTED_HOSTS or p.username or p.password:
                raise ValueError("Unapproved source host: " + url)
            if url not in seen:
                seen.add(url)
                out.append({"candidate": candidate["id"], "title": src["label"], "url": url})
    return out


def check_one(source):
    """Only verify HTTP availability and an optional short response fingerprint.

    HTTP metadata and short response hashes do not prove that the factual
    conclusions changed. Never feed remote content to instructions or a shell.
    """
    result = {**source, "checked_at": utc_now(), "http_status": None,
              "etag": None, "last_modified": None, "sample_sha256": None, "error": None}
    req = Request(source["url"], headers={"User-Agent": "NAOJUN-FUTURECAST-EvidenceCheck/1.0",
                                           "Accept": "text/html,application/xhtml+xml,*/*;q=0.5"})
    try:
        with urlopen(req, timeout=15) as response:
            final = urlparse(response.url)
            if final.scheme != "https" or final.hostname not in ACCEPTED_HOSTS:
                raise ValueError("Redirected outside approved HTTPS sources")
            result["http_status"] = response.status
            result["etag"] = response.headers.get("ETag")
            result["last_modified"] = response.headers.get("Last-Modified")
            result["sample_sha256"] = hashlib.sha256(response.read(MAX_SAMPLE)).hexdigest()
    except HTTPError as exc:
        result["http_status"] = exc.code
        result["error"] = "HTTP response " + str(exc.code)
    except (URLError, OSError, TimeoutError, ValueError) as exc:
        result["error"] = type(exc).__name__ + ": " + str(exc)[:180]
    return result


def report_md(data, checks):
    checked = sum(r["http_status"] == 200 and not r["error"] for r in checks)
    timestamp = utc_now()
    lines = [
        "# FUTURECAST 50+ — 月次根拠チェック",
        "",
        "確認日時（UTC）: " + timestamp,
        "資料アクセス成功: " + str(checked) + "/" + str(len(checks)),
        "",
        "**このレポートは一次資料URLの応答検査です。本文の新しい事実、世論、発生確率を自動認定したものではありません。**",
        "",
        "## 次に検討する事象",
    ]
    for c in data["candidates"]:
        lines.append("- **" + c["title"] + "** — 未採択：発生確率の推定分布と同一命題の世論が不足")
    lines += ["", "## 公式情報源の疎通状態",
              "| 資料 | HTTP | 備考 |",
              "| --- | --- | --- |"]
    for r in checks:
        status = str(r["http_status"]) if r["http_status"] is not None else "取得失敗"
        note = "HTTP応答確認のみ" if r["http_status"] == 200 and not r["error"] else (r["error"] or "要確認")
        lines.append("| [" + r["title"].replace("|", "/") + "](" + r["url"] + ") | " + status + " | " + note.replace("|", "/") + " |")
    lines += [
        "", "## 採択・公開の条件",
        "1. 判定可能な1年以内の命題・判定期限を事前固定。",
        "2. 同じ出来事・期限を尋ねる代表性ある調査で、過半数が発生確率50%未満と予想。",
        "3. 予測側は誤差分布・方法・データ出典を明示して発生確率50%超と示す。",
        "4. 独立検証後、既存の追記型台帳へ候補を登録し、PR/CI/Pages読み戻しで公開を確定。",
        "5. 条件が不足する場合は新しい確率を公表しない。毎月の新規採択ノルマなし。",
        "", "### 実行境界",
        "GitHub Actionsが自動化するのは資料疎通確認とレビューIssueの作成まで。"
        " 新規のAI数値予測、代表性ある世論調査の実施、予測台帳への自動発行は未実装です。",
        ""
    ]
    return "\n".join(lines)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--check", action="store_true")
    group.add_argument("--scan", action="store_true")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--markdown", type=Path)
    args = parser.parse_args(argv)
    data = validate(json.loads(DATA.read_text(encoding="utf-8")))
    sources = get_sources(data)
    if args.check:
        if args.output or args.markdown:
            parser.error("--check cannot write output")
        print("FUTURECAST: offline source config valid, URLs " + str(len(sources)) + ", adopted 0")
        return 0
    if not args.output or not args.markdown:
        parser.error("--scan requires --output and --markdown")
    checks = [check_one(item) for item in sources]
    report = {"schema_version": 1, "purpose": "metadata_only_not_probability_update",
              "checked_at": utc_now(), "as_of": data["as_of"],
              "qualified_count": 0, "checks": checks}
    for p, text in ((args.output, json.dumps(report, ensure_ascii=False, indent=2) + "\n"),
                    (args.markdown, report_md(data, checks))):
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")
    print("FUTURECAST: scanned " + str(len(checks)) + " source URLs; checks with HTTP 200: "
          + str(sum(c["http_status"] == 200 for c in checks)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
