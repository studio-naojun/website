#!/usr/bin/env python3
"""Build the public, evidence-first FUTURECAST research page (no forecast issuance)."""
import html
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
import studio_chrome as chrome  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "futurecast/data-disagrees/candidates.json"
OUTPUT = ROOT / "futurecast/data-disagrees/index.html"


def esc(value):
    return html.escape(str(value), quote=True)


def source_url(url):
    if not isinstance(url, str) or len(url) > 800:
        return False
    u = urlparse(url)
    return u.scheme == "https" and bool(u.hostname) and not u.username and not u.password and not u.fragment


def validate(data):
    assert data["schema_version"] == 1 and data["kind"] == "research_only"
    assert data["as_of"] == "2026-11-03" and data["qualified_count"] == 0
    assert data["data_probability_status"] == "unestimated"
    assert data["opinion_status"] == "same_question_survey_missing"
    assert len(data["criteria"]) == 3 and all(isinstance(x, str) and x for x in data["criteria"])
    assert 1 <= len(data["candidates"]) <= 6
    ids = set()
    for c in data["candidates"]:
        assert re.fullmatch(r"[a-z][a-z0-9-]{3,60}", c["id"]) and c["id"] not in ids
        ids.add(c["id"])
        assert c["probability"] is None and c["human_forecast"] is None
        for k in ("number", "domain", "title", "question", "deadline", "resolution", "signal", "support", "falsifier", "missing", "status"):
            assert isinstance(c[k], str) and 1 <= len(c[k]) <= 1200, (c["id"], k)
        assert c["status"].endswith("未検証")
        assert 1 <= len(c["metric"]) <= 3
        assert all(set(x) == {"label", "value"} and all(isinstance(v, str) and v for v in x.values()) for x in c["metric"])
        assert 1 <= len(c["sources"]) <= 4
        assert all(isinstance(s["label"], str) and source_url(s["url"]) for s in c["sources"])
    assert len(data["excluded"]) == 2
    for item in data["excluded"]:
        assert set(item) == {"title", "reason"} and all(isinstance(v, str) and v for v in item.values())
    return data


def sources(items):
    return "".join(f'<li><a href="{esc(s["url"])}" rel="noopener noreferrer" target="_blank">{esc(s["label"])} <span aria-hidden="true">↗</span></a></li>' for s in items)


def card(c):
    metrics = "".join(
        f'<div class="d-metric"><span>{esc(m["label"])}</span><strong>{esc(m["value"])}</strong></div>'
        for m in c["metric"]
    )
    return f"""<article class="d-card" id="{esc(c['id'])}" aria-labelledby="title-{esc(c['id'])}">
      <div class="d-card-head"><span class="d-index">{esc(c['number'])}</span><span class="d-domain">{esc(c['domain'])}</span><span class="d-status">調査段階</span></div>
      <h3 id="title-{esc(c['id'])}">{esc(c['title'])}</h3>
      <p class="d-question">{esc(c['question'])}</p>
      <div class="d-metrics" aria-label="実績と予測の観測データ">{metrics}</div>
      <p class="d-signal">{esc(c['signal'])}</p>
      <div class="d-gate-grid"><section><h4>01 / データ側の見通し</h4><p>{esc(c['support'])}</p><p class="d-missing">発生確率：<strong>未算出</strong></p></section>
      <section><h4>02 / 人々の予想</h4><p>同じ出来事・期限を問う代表性ある調査は未取得です。</p><p class="d-missing">人々の予想：<strong>未検証</strong></p></section></div>
      <details class="d-detail"><summary>判定条件・外れる場合・根拠を見る <span aria-hidden="true">＋</span></summary>
      <div class="d-detail-body"><div><h4>YESの定義・期限</h4><p>{esc(c['question'])}</p><p>期限：{esc(c['deadline'])}</p><p>{esc(c['resolution'])}</p></div>
      <div><h4>外れる条件</h4><p>{esc(c['falsifier'])}</p><h4>採択に不足するデータ</h4><p>{esc(c['missing'])}</p></div>
      <div class="d-source-list"><h4>確認した一次資料と予測資料</h4><ul>{sources(c['sources'])}</ul></div></div></details>
    </article>"""


def render(data):
    cards = "\n".join(card(c) for c in data["candidates"])
    excluded = "\n".join(
        f'<li><strong>{esc(c["title"])}</strong><p>{esc(c["reason"])}</p></li>'
        for c in data["excluded"]
    )
    rules = "\n".join(f"<li><span>0{i}</span><p>{esc(rule)}</p></li>" for i, rule in enumerate(data["criteria"], 1))
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; base-uri 'self'">
<meta name="naojun-discovery" content="manual">
<meta name="description" content="多くの人は起きないと思うのに、データでは起こる方が有力な未来はあるか。FUTURECASTが太陽光・EV・自動運転の根拠と、まだ不足している世論データを検証する。">
<link rel="canonical" href="https://naojun.jp/futurecast/data-disagrees/">
<meta property="og:title" content="DATA DISAGREES — 逆転する未来を、証拠で探す | NAOJUN STUDIOS">
<meta property="og:description" content="数値を盛らず、人々の予想とデータの見通しが本当に逆転する未来だけを選ぶ。">
<meta property="og:url" content="https://naojun.jp/futurecast/data-disagrees/">
{chrome.styles("/futurecast/data-disagrees/data-disagrees.css")}
<title>DATA DISAGREES｜逆転する未来を、証拠で探す｜NAOJUN STUDIOS</title></head>
<body class="studio-site fc-site">
{chrome.header("/futurecast/data-disagrees/")}
<main id="main" class="d-main">
<section class="d-hero" aria-labelledby="d-title">
<div class="d-hero-content"><p class="d-overline">FUTURECAST / DATA DISAGREES / 2026—2027</p>
<h1 id="d-title">信じられない未来を、<em>数字で覆せるか。</em></h1>
<p class="d-hero-lead">多くの人が「起きない」と考える。それでもデータが示す発生確率は50%を超える。そんな歴史の転換点だけを探す、新しいFUTURECASTです。</p>
<p class="d-hero-sub">予測を採用するには、事象の期限・数値モデル・人々の予想がすべて一致していなければなりません。現時点でこの条件を完全に立証できた予測はありません。</p>
<a class="d-action" href="#research">調査中の3件を読む <span aria-hidden="true">↘</span></a></div>
<div class="d-hero-tally" aria-label="条件を満たして公開採択した予測は0件"><span>VERIFIED REVERSALS</span><strong>00</strong><p>採択条件を満たした予測</p><small>調査時点 / {esc(data['as_of'])} JST</small></div>
</section>
<section class="d-thesis" aria-labelledby="d-rule-heading"><div class="d-heading"><p class="d-overline">THE TEST / 公開条件</p><h2 id="d-rule-heading">驚きだけでは、<br>予測にしない。</h2></div><ol>{rules}</ol></section>
<section class="d-research" id="research" aria-labelledby="d-research-title"><div class="d-research-head"><div><p class="d-overline">ON THE RADAR / 根拠のある調査候補</p><h2 id="d-research-title">歴史の分岐点は、<br>すでに近いかもしれない。</h2></div><p>この3件は「採択済みの50%超予測」ではありません。公的機関の見通しと実績から、有力な調査対象として選びました。発生確率・世論の予想値は、裏付けが得られるまで表示しません。</p></div>
<div class="d-cards">{cards}</div></section>
<section class="d-excluded"><div><p class="d-overline">NOT YET / 採択しない理由</p><h2>数字のすり替えをしない。</h2></div><ul>{excluded}</ul></section>
<section class="d-method" aria-labelledby="d-updates"><p class="d-overline">SLOW FORECAST / 予測の更新</p><h2 id="d-updates">毎日ではなく、<br>証拠が変わったときに。</h2><p>月に一度、一次資料の更新有無を確認します。新しい数値推定と人々の予想が厳密に揃ったときだけ新規採択を検討します。採択済みの予測を変更する場合も、過去の数字は消さず履歴に追記します。</p>
<div class="d-method-links"><a href="/futurecast/methodology/">選定・採点方法 ↗</a><a href="/futurecast/">公開済みの予測台帳 ↗</a><a href="/futurecast/era-shifts/">旧・低確率シナリオ研究 ↗</a></div>
<p class="d-disclaimer">現在の3件は調査候補であり、未校正のAI確率を新たに公表していません。人々の予想を測定する代表性ある調査も未取得です。サイト読者の自己選択アンケートは社会全体の世論とは見なしません。</p></section>
</main>
{chrome.footer()}
</body></html>
"""


def main():
    data = validate(json.loads(DATA.read_text(encoding="utf-8")))
    rendered = render(data)
    if sys.argv[1:] == ["--check"]:
        assert OUTPUT.exists() and OUTPUT.read_text(encoding="utf-8") == rendered, "Data Disagrees HTML stale"
        print("DATA DISAGREES: validated 0 qualified, 3 research candidates; HTML in sync")
    elif len(sys.argv) == 1:
        OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        OUTPUT.write_text(rendered, encoding="utf-8")
        print("DATA DISAGREES: generated static evidence-first research page")
    else:
        raise SystemExit("Usage: python tools/futurecast/build_data_disagrees.py [--check]")


if __name__ == "__main__":
    main()
