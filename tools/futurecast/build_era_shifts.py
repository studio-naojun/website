#!/usr/bin/env python3
"""Deterministic static renderer for Astra's unscored scenario atlas.

Run: python tools/futurecast/build_era_shifts.py
Check: python tools/futurecast/build_era_shifts.py --check
Only the editorial /era-shifts page is generated. This does not create or alter
forecast NDJSON, forecast scores, receipts, or the original three forecasts.
"""
import html
import json
import re
import sys
import uuid
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "futurecast/era-shifts/scenarios.json"
OUTPUT = ROOT / "futurecast/era-shifts/index.html"


def esc(value):
    return html.escape(str(value), quote=True)


def check_url(value):
    if not isinstance(value, str):
        return False
    parsed = urlparse(value)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password and len(value) <= 800


def validate(data):
    assert data["schema_version"] == 1 and data["status"] == "candidate_unscored"
    assert data["model"] == "Codex gpt-6-astra / medium"
    assert data["calibration"] == "uncalibrated subjective estimates"
    assert data["as_of"] == "2026-11-03"
    assert len(data["scenarios"]) == 8
    assert data["publication_note"] and data["disclaimer"]
    ids = set()
    positives = 0
    for scenario in data["scenarios"]:
        sid = scenario["id"]
        assert re.fullmatch(r"[a-z][a-z0-9-]{3,45}", sid) and sid not in ids, sid
        ids.add(sid)
        for field in ("title", "short", "domain", "consequence", "yes", "reason", "counter", "attribution", "resolution"):
            assert isinstance(scenario[field], str) and 0 < len(scenario[field]) < 1800, (sid, field)
        assert scenario["window"] == "2027年11月3日 23:59 JST"
        assert scenario["kind"] in ("disruption", "breakthrough")
        positives += scenario["kind"] == "breakthrough"
        if scenario["probability"] is None:
            assert scenario["probabilityLabel"] == "1%未満"
        else:
            p = scenario["probability"]
            assert isinstance(p, int) and 1 <= p <= 99 and scenario["probabilityLabel"] == str(p) + "%"
        assert 1 <= len(scenario["sources"]) <= 3
        for source in scenario["sources"]:
            assert source["label"] and check_url(source["url"]), (sid, source)
    assert positives >= 2
    return data


def sources(s):
    return "".join(f'<li><a href="{esc(x["url"])}" rel="noopener noreferrer">{esc(x["label"])} <span aria-hidden="true">↗</span></a></li>' for x in s["sources"])


def card(s):
    positive = s["kind"] == "breakthrough"
    return f"""<a href="#{esc(s['id'])}" class="era-card {'breakthrough' if positive else 'disruption'}">
      <span class="era-card-top"><span>{esc(s['number'])} / {esc(s['domain'])}</span><span>{'POSITIVE SHIFT' if positive else 'SYSTEMIC SHIFT'}</span></span>
      <strong class="era-card-title">{esc(s['title'])}</strong>
      <span class="era-card-detail">{esc(s['short'])}</span>
      <span class="era-card-bottom"><span class="era-prob" aria-label="主観的発生確率 {esc(s['probabilityLabel'])}">{esc(s['probabilityLabel'])}</span><span>判定期限<br>2027.11.03</span><span class="era-card-arrow" aria-hidden="true">↗</span></span>
    </a>"""


def detail(s):
    return f"""<article class="era-detail" id="{esc(s['id'])}" aria-labelledby="{esc(s['id'])}-title">
    <header class="era-detail-head"><span class="era-number">{esc(s['number'])}</span><div><span class="era-category">{esc(s['domain'])} / {'可能性の突破' if s['kind']=='breakthrough' else '制度・システムの転換'}</span><h3 id="{esc(s['id'])}-title">{esc(s['title'])}</h3></div><div class="era-detail-prob"><span>ASTRA / SUBJECTIVE</span><strong>{esc(s['probabilityLabel'])}</strong></div></header>
    <p class="era-impact">{esc(s['consequence'])}</p>
    <div class="era-detail-grid">
      <section><h4>YESと判定する条件</h4><p>{esc(s['yes'])}</p><p class="era-due"><strong>期限</strong> {esc(s['window'])}</p></section>
      <section><h4>なぜ起こり得るか</h4><p>{esc(s['reason'])}</p><h4>最大の反証</h4><p>{esc(s['counter'])}</p></section>
      <section><h4>原因・解釈上の留保</h4><p>{esc(s['attribution'])}</p><h4>結果の判定主体</h4><p>{esc(s['resolution'])}</p></section>
      <section><h4>背景資料と参照先</h4><ul class="era-links">{sources(s)}</ul><p class="era-context">出典は研究・リスクの背景を示すもので、{esc(s['probabilityLabel'])}という数値自体の統計的証明ではありません。</p></section>
    </div></article>"""


def render(data):
    items = data["scenarios"]
    cards = "\n".join(card(s) for s in items)
    details = "\n".join(detail(s) for s in items)
    return f"""<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; object-src 'none'; base-uri 'self';">
<meta name="naojun-discovery" content="manual"><meta name="description" content="銀行網の停止から核融合の正味送電まで。歴史を変え得る8つの出来事を、主観的確率と判定基準・反証付きで検討する。">
<link rel="canonical" href="https://naojun.jp/futurecast/era-shifts/">
<meta property="og:title" content="ERA SHIFTS｜まさかが歴史になる。NAOJUN FUTURECAST">
<meta property="og:description" content="歴史的転換の8つの可能性。期限と判定条件を明示した未校正の予測候補。">
<meta property="og:url" content="https://naojun.jp/futurecast/era-shifts/">
<link rel="stylesheet" href="/futurecast/assets/css/futurecast.css">
<link rel="stylesheet" href="/futurecast/era-shifts/era-shifts.css">
<title>ERA SHIFTS｜歴史を変える8つの「まさか」｜NAOJUN STUDIOS</title></head><body>
<a class="skip" href="#main">本文へ移動</a>
<header class="site"><a class="brand" href="/">NAOJUN STUDIOS <span aria-hidden="true">↗</span></a><nav aria-label="メインナビゲーション"><a href="/works/">Works</a><a href="/#journal">Journal</a><a href="/about/">About</a><a href="/contact/">Contact</a><a href="https://naojun-studios.stores.jp/" rel="noopener noreferrer">Store</a></nav></header>
<div class="mast"><a href="/futurecast/">FUTURECAST <small>未来予想台帳</small></a><nav aria-label="FUTURECAST"><a href="/futurecast/data-disagrees/">DATA DISAGREES</a><a href="/futurecast/">予測台帳</a><a href="/futurecast/era-shifts/" aria-current="page">低確率研究</a><a href="/futurecast/scoreboard/">成績</a><a href="/futurecast/methodology/">方法論</a></nav></div>
<main id="main" class="era-main">
<aside class="era-manifesto" aria-label="旧研究の取り扱い"><p class="era-overline">ARCHIVE / LOW-PROBABILITY RESEARCH</p><h2>低確率シナリオの記録。</h2><p>こちらは旧企画として公開した8件の文明規模シナリオ研究です。発生確率は未校正の主観推定で、現在の「発生50%超かつ人々の予想と逆転」という主力企画には採択していません。過去の数値・判定条件は記録として維持しています。</p><p><a href="/futurecast/data-disagrees/">新しいDATA DISAGREESの調査候補を見る →</a></p></aside>
<section class="era-hero"><div class="era-hero-main"><p class="era-overline">NAOJUN FUTURECAST / ERA SHIFTS / VOL. 01</p>
<h1>「まさか」が、<br><em>歴史になる。</em></h1>
<p class="era-subtitle">2027年11月までに、人類の常識を揺さぶる出来事は起きるのか。衝撃の大きさと発生確率を混同せず、8つの問いを明文化する。</p>
<div class="era-hero-actions"><a href="#scenario-list" class="era-primary">8つの分岐を見る <span aria-hidden="true">↘</span></a><a href="#method" class="era-secondary">確率の読み方</a></div>
</div><aside class="era-hero-aside" aria-label="予測候補の概要"><p>ERA SHIFT / 2026—27</p><span class="era-big-number">08</span><span class="era-small">未校正の候補予測</span><p>03 NOV 2026<br>→ 03 NOV 2027</p><span class="era-grid-art" aria-hidden="true"></span></aside></section>
<section class="era-manifesto" id="method"><span class="era-overline">THE PURPOSE / 予測の考え方</span>
<h2>予言ではなく、<br>未来を検証するための問い。</h2>
<div class="era-manifesto-cols"><p>これらは、まだ採点台帳に採択されていない予測候補です。確率はCodex Astraが示した主観的な判断であり、検証済みの統計値ではありません。背景資料から、その出来事の発生確率を直接計算したものでもありません。</p>
<p>社会を変える出来事でも、起こらない可能性は高い。だからこそ成立条件と反証・期限を先に明確にします。{esc(data['publication_note'])}</p></div></section>
<section class="era-index-section" id="scenario-list" aria-labelledby="index-title"><div class="era-section-heading"><span class="era-overline">08 POSSIBLE WORLDS</span>
<h2 id="index-title">未来の分岐点。</h2><p>確率は「衝撃の大きさ」ではありません。8件は互いに排他的ではなく、合計100%にはなりません。</p></div>
<div class="era-card-grid">{cards}</div></section>
<section class="era-questions-section" aria-labelledby="details-title"><div class="era-section-heading"><span class="era-overline">CRITERIA / EVIDENCE / DISCONFIRMATION</span>
<h2 id="details-title">条件がなければ、予測ではない。</h2><p>各候補には判定条件・期限・反証を付けています。公式台帳に採択するときは初回確率を固定し、その後の変更は追記型の履歴で公開します。</p></div>{details}</section>
<section class="era-operation" aria-labelledby="operation-title"><div><p class="era-overline">A SLOW FORECAST / 未来を見る頻度</p>
<h2 id="operation-title">毎日ではなく、<br>変化したときに。</h2><p>速報の量ではなく、重要な前提が変わったかを追う。</p></div>
<div class="era-operation-list"><p><strong>月に1度</strong> 現在の主力候補の一次資料について、URLと応答の更新状況を確認します。</p><p><strong>重要な新証拠が出たとき</strong> 数値推定と同一設問の世論が揃うかを検証して、初めて主力へ採択します。</p><p><strong>四半期に1度</strong> シナリオ候補を棚卸しし、採択済みの公開予測を消去・改ざんしません。</p><p class="era-notice">このページは旧ERA SHIFTSの記録です。新しい更新基準は <a href="/futurecast/data-disagrees/">DATA DISAGREES</a> を確認してください。</p></div></section>
<section class="era-legacy" aria-labelledby="legacy-title"><span class="era-overline">OPEN LEGACY OUTLOOK / 継続中の従来予測</span>
<h2 id="legacy-title">以前の予測も、消さない。</h2><p>既に公開済みの3件は結果待ちです。確率・判定条件・初回公開時刻を変更せず、従来の予測台帳で継続して追跡します。</p>
<ul><li><a href="/futurecast/p/fc-2026-0001/">Artemis IIIの有人Orion打ち上げ ↗</a></li>
<li><a href="/futurecast/p/fc-2026-0002/">ESAのPLATO衛星打ち上げ ↗</a></li>
<li><a href="/futurecast/p/fc-2026-0003/">米FOMCの政策金利予測 ↗</a></li></ul>
<div class="era-legacy-actions"><a href="/futurecast/">既存の予測台帳へ</a><a href="/futurecast/scoreboard/">採点状況を見る</a><a href="/futurecast/methodology/">方法論を見る</a></div></section>
</main>
<footer><a href="/">NAOJUN STUDIOS</a><p>日々に、小さな発明を。</p><a href="/futurecast/methodology/">この台帳について</a></footer>
</body></html>
"""


def main():
    data = validate(json.loads(DATA.read_text(encoding="utf-8")))
    result = render(data)
    if sys.argv[1:] == ["--check"]:
        assert OUTPUT.exists() and OUTPUT.read_text(encoding="utf-8") == result, "ERA SHIFTS static HTML needs regeneration"
        print("ERA SHIFTS: checked static page, 8 unscored candidate events")
    elif len(sys.argv) == 1:
        temp = OUTPUT.with_name(OUTPUT.name + "." + uuid.uuid4().hex + ".tmp")
        try:
            temp.write_text(result, encoding="utf-8")
            temp.replace(OUTPUT)
        finally:
            temp.unlink(missing_ok=True)
        print("ERA SHIFTS: generated 8 unscored editorial candidate events; original three untouched")
    else:
        raise SystemExit("Usage: python tools/futurecast/build_era_shifts.py [--check]")


if __name__ == "__main__":
    main()
