# NAOJUN STUDIOS / three legacy surfaces — creative preflight

Date: 2026-11-03; scope: three public URLs only, plus the one FUTURECAST
generator/template needed to keep its generated homepage from regressing.
Original screenshot/creative baseline: `origin/main` at `59a3f0179ddc2e42dd6ed388dad2e6ce746b08ae`.
Final code comparison after rebasing this candidate: `origin/main` at `e2f22b945b41225ba83615d9ebc59a1e3df39d51`.
Screenshots: `Z:/AI/Temp/Jobs/naojun-three-pages-20261103/before/`
at 320/390/430/768/1024/1440 for all three routes.

## Observed, not inferred

**Markets** `/investment/markets/`: old warm-grey slogan above 4 huge ticker
abbreviations, below that four `価格データ未接続` cells, and only then a hidden
TradingView chart requiring a user click. Real Chromium 390/1440 click
evidence: `JS: Invalid or unexpected token`, no `tv-advanced-chart`, no
iframe, **zero TradingView requests**. The committed `markets.js` has
damaged string expressions and duplicated fetch blocks around lines 266–287.
This is a real defect independent of styling. There are NO licensable own
history data/quotes present; never fabricate numerical prices or imply a
private graph is live.

**FUTURECAST** `/futurecast/`: whole legacy dark-green microsite with a separate
header and CSS. Its authoritative generated homepage lives in
`tools/futurecast/fc.mjs`, not only `futurecast/index.html`. Current
publication: **0 newly adopted majority-reversal predictions**, three prior
uncalibrated historical records with different probabilities, separate
`/futurecast/data-disagrees/`, `/futurecast/era-shifts/`, methodology,
scoreboard, archive. The key reason to visit is to inspect admissibility,
evidence, uncertainty, outcome and correction history, not an inflated claim
that a future outcome is certain.

**K.A.N.A.D.E.** `/kanade/`: live Studio Editions site header/footer but a
plain old text hero and two generic feature cards. Real content is an
AI editorial partner's *process* — first-source research, separation of fact
and inference, publication, correction. Actual reports: Investment and
Admissions. Do not invent an AI face, client testimonials, results, operational
automation or published ownership of unrelated projects.

All three pages need immediate visual consistency with the newly deployed
Studio Editions (violet mast, 4-color ribbon, actual product or evidence
content). Do not re-colour old layouts and claim redesigned.

## Three structurally different concepts

**A / Three Studios, Three Instruments — SELECTED.**
The first screen is the content-specific instrument, not another slogan:
markets = a large ultramarine **instrument reader** with prominent real
TradingView loader and selectable four symbols; FUTURECAST = a distinctive
violet **evidence board** where `0 accepted` is truthfully and prominently
explained, leading directly to DATA DISAGREES, while legacy forecast records
appear below as separate archival ledger; KANADE = a light-mint/mango
**editor's colophon** that demonstrates the chain source → fact → inference →
publication → correction alongside two real authored report series. Deliberate
contrast among the three, common navigation and typographic grammar.
Mobile: chart selection can wrap, charts stay fully within viewport; evidence
board becomes one readable column; editing process is a vertical proof path.
Trade-off: external widget performance and no-data states need careful design.

**B / All Three as Identical Magazine Covers — rejected.**
Apply the new INVESTMENT/ADMISSIONS/AI-DEV issue-cover page template to each
first screen, with dramatic headline and decorative diagrams, then content.
Visually consistent, but hides actual chart behind a cover, conflates
FUTURECAST's not-yet-adopted work with published forecasts, and leaves KANADE
as decorative biography instead of workflow. Identity without usefulness.

**C / Consolidated Research Dashboard — rejected.**
One dense portal with a four-way grid of quote cards, prediction scores and
editor stats, smart tabs and identical modules. Fast scan but honest live
quotes are not available; faux stats and unreadable phone tiles would be the
wrong outcome. Would also create a second dashboard when Operations is the
one operational destination.

## Identity and material

Use the existing NAOJUN STUDIO Editions variable vocabulary from
`assets/css/studio.css`: violet `#302447`, chalk `#fdfaf4`,
ultramarine `#3d47da`, mint `#9bd9d0`, mango `#f5b85b`,
raspberry `#f26966`. Do not import a new font; use `--jp-display` and
`--condensed`. Not all colors on every page. Keep the shared header/footer,
4-color strip, skip link, high-contrast focus and accessible mobile menu.
No generic outlined SaaS cards or uniform three-column sections.

Two non-interchangeable anchors:
1. **TradingView-supplied actual rendered chart** with explicit opt-in,
   a genuine symbol selector for SP:SPX, NASDAQ:NDX, DJ:DJI and
   BITSTAMP:BTCUSD, verified network/custom-element state, honest delays and
   provider attribution. Own price/history remains visibly unavailable.
2. **FUTURECAST's actual adoption gate and ledger**, not decorative made-up
   probability: `0` accepted after the majority-reversal test and the three
   prior sealed forecast questions as clearly separated history; links lead
   to real detail pages and methodology.
3. **KANADE's own editorial loop** with truthful process labels and two real
   journal destinations, not an AI portrait or a generic about-card trio.

## Information architecture / editorial composition

MARKETS first fold: studio header → narrow breadcrumb → ultramarine editorial
heading + **large black-on-light TradingView stage / loading control**. One
actual interactive chart and symbol switch, with honest "external provider,
third-party communication begins on click" nearby. Below: clear own-data
unavailable notice (not 4 fake-looking quote cards), official symbol links,
existing publications, and future licensed-history controls only when valid
data really exists.

FUTURECAST first fold: studio header → independent dark-violet publication
subnav → bold split cover "常識が、書き換わる前に" vs an **honest 0-adopted board**.
Then a punchy evidence/criteria explainer with DATA DISAGREES link. Historic
3 prediction records are visibly headed "過去の記録・未校正" and separated from
new majority-reversal work. Keep all numbers/links generated by `fc.mjs`;
do not edit generated HTML alone.

KANADE first fold: shared mast → editorial colophon with very large but
legible wordmark and meaningful "調べる・照合する・編む" flow, two-column uneven
composition on desktop; a true vertical process on phone. Below: authored
source-quality philosophy and exactly two published report families with
direct links. No invented capability or unsupported achievements.

Desktop sketches:

```
MARKETS    [BREADCRUMB]  [BLUE IMPACT HEADER / REAL SELECTOR]
           [ LARGE REAL CHART VIEWPORT ─────────────────── ]
           [TRADINGVIEW ATTRIBUTION / PROVIDER OPEN LINKS]
           [OWN DATA UNAVAILABLE (honest)] [REAL JOURNAL]

FUTURECAST [STUDIO HEADER] [SUBNAV]
           [HUGE EDITION TITLE] [0 ACCEPTED / WHAT COUNTS]
           [DATA DISAGREES / EVIDENCE REQUIREMENTS]
           [LEGACY RECORDS LIST / 3 ACTUAL FORECASTS]

KANADE     [STUDIO HEADER] [LARGE WORDMARK + EDITORIAL THESIS]
           [1 SOURCE → 2 FACT → 3 INTERPRETATION → 4 REVISE]
           [TWO REAL JOURNAL PUBLICATIONS]
```

Phone sketches:

```
MARKETS    [headline] [four 44px symbol buttons wrap]
           [open real chart / status] [responsive chart full width]
           [provider links] [unavailable own-data note] [journal]
FUTURECAST [brand/menu] [large title] [0 accepted explainer]
           [primary study CTA] [separate historic forecast rows]
KANADE     [brand/menu] [KANADE] [concise copy]
           [stacked editorial path] [two distinct report links]
```

## Source lessons (retrieved live by GitHub connector, pinned)

- Anthropic `anthropics/skills/skills/frontend-design/SKILL.md` at
  `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`: actual subject matter
  must drive structure, not a paper-look or identical cards; user-triggered
  motion only, no gratuitous counters or market-like generated images.
- Vercel `vercel-labs/web-interface-guidelines/command.md` at
  `4ecfb9fb8d1d3b7009674869b3aaee2f904042e1`: meaningful semantic
  buttons and links; accessible focus, visible async loading/error/status,
  reduced motion, responsive 320px and no document overflow.
- TradingView official `widget-docs/widget-formats/` (checked 2026-11-03)
  recommends a Web Component with an ES module for a modern site, while the
  iframe form is an alternate for isolation; widget values cannot be
  silently republished as our own licensed quote dataset.

Rejected motif: changing the colors of three existing slogans and placing
another row of four static empty quote cards ahead of the actual chart.

## Acceptance

The three first screens must be clearly different from the BEFORE screenshots
at desktop and mobile, while visually recognizably NAOJUN STUDIOS. The **real
Markets chart must load** after a user click with a TradingView resource
request and a visually populated chart at 390/1440 for all four symbols.
If the outside provider blocks some symbols or this environment, report
exactly which with error/fallback, not claim success based solely on
`customElements.get`. The pre-click path must cause NO TradingView network
requests. Never invent own history/prices.

FUTURECAST generated page must remain generator-idempotent and preserve
ledger/receipt integrity and new-majority zero-adopted truth. KANADE report
links and text remain real. Test six widths, long/empty/error content, local
and externally hosted network, JS exceptions, key focus/menu, link targets,
canonical/SEO, existing smoke. Independent reviewer must assess screenshots.
Use one isolated candidate worktree and unchanged existing deployment policy.

## Implementation and verification record — 2026-11-03

Actual implementing route: `CLAUDE_CODE` / `opus` on the isolated feature
worktree. The single model run reached its configured execution deadline
after writing the implementation and browser evidence, without an end-of-task
report. This is **not** treated as a successful completion certification;
remaining review, release and production readback are performed separately.

**Markets:** `investment/markets/index.html`, `markets.css`,
`markets.js` and `markets.test.mjs` change the first fold to a blue
instrument reader and correct the malformed JavaScript that blocked all
third-party requests. TradingView's own embed restricted the original
`SP:SPX`, `NASDAQ:NDX`, `DJ:DJI` and `TVC:*` indices in real
Chromium probes, so the UI correctly opens the actual index's official
TradingView page as the primary action and offers a separate, explicit
user opt-in to view tracking ETFs instead: `AMEX:SPY` for S&P 500,
`NASDAQ:QQQ` for NASDAQ 100 and `AMEX:DIA` for the Dow; these are
not the index itself. `BITSTAMP:BTCUSD` embeds directly. Each ETF/spot
chart was seen with real provider-supplied candles and market information,
not merely a custom-element shell. Actual 390/1440 browser evidence at
`Z:/AI/Temp/Jobs/naojun-three-pages-20261103/after/markets-e2e/`
(`markets-e2e.json`, 4 symbols, pre-click, clicks, offline, no-JS and
screenshots): zero third-party requests on initial load, real TradingView
requests and matched provider symbol after opt-in, close/reset, focused
keyboard selection, no page errors or document horizontal overflow.
The unlicensed own price and history feed correctly remains unavailable,
visually secondary to the actual chart.

**FUTURECAST:** Canonical generator `tools/futurecast/fc.mjs` and
source renderers `build_data_disagrees.py` /
`build_era_shifts.py`, plus one shared `studio_chrome.py` helper,
produce new consistent NAOJUN STUDIO Editions navigation and designed
evidence-board covers throughout the FUTURECAST subsite. Source
`futurecast/assets/css/futurecast.css` is replaced with a purpose-built
violet/mango publication system. Existing three historical uncalibrated
records and their probability/body/evidence/receipts remain intact,
and new majority-reversal adopted forecasts stay **zero**.
Independent generator reproduction in
`Z:/AI/Temp/Jobs/naojun-three-pages-20261103/gen-compare/` matched the
exact bytes of all **10** authoritative homepage/individual record,
scoreboard, archive, methodology, public data and CSS targets (0 diffs).
The public-ledger verification and complete FUTURECAST Node/Python checks
all returned success; logs under
`Z:/AI/Temp/Jobs/naojun-three-pages-20261103/checks/`.

**K.A.N.A.D.E.:** `kanade/index.html` and new `kanade/kanade.css`
provide a real editorial colophon: a legible large wordmark, an authentic
research/editing/correction workflow, and direct links to the two real
report families (Investment and Admissions), without an invented AI face,
achievements, additional authored genres or independent agent claims.

**Browser and regression:** `after/qa/qa-all.json` reports 34 route,
width and state inspections with **zero failures** covering the three
primary pages and scoped FUTURECAST subpages, 320/390/430/768/1024/1440
widths, menu/escape/focus, intentionally long mobile text, offline/no-JS
and zero source JS page errors or horizontal overflow. `node --test
investment/markets/markets.test.mjs` passes all 9 tests, including a
true JavaScript ES-module syntax regression that catches the original
2026-11 corruption. `python scripts/sync_studio.py --check`:
60 pages, 0 changes. `python scripts/design-integrity.py`:
60 pages / 1,893 internal links/anchors PASS. `python
scripts/build_discovery.py --check`: no changes. Futurecast
tests/builders/receipt verification as above pass. These are candidate
results; they do **not** establish production deployment.

**Known boundaries:** No independent paid, redistribution-licensed
history or real-time quote feed is present. Real index-price charts
must open on TradingView itself; ETF charts are an alternate tracking
series rather than exact index charts. Full automatic axe and physical
iPhone Safari QA have not been performed. Browser results do not prove
future provider availability. Independent screenshot/code review,
CI, release and production readback remain separate gates.

### Independent review, correction and provider availability caveat

Independent read-only Codex review
`naojun-three-pages-independent-review-20261103-01` gave
**REVISE**, principally because the application announced 「表示中」 as soon
as the TradingView web component **registered**, even though provider data
may not yet have loaded. The external component is cross-origin; registration
does not prove that chart candles exist. It also identified a keyboard-focus
concern when the clicked Load button is replaced. Browser screenshot access
was unavailable to that separate reviewer; its visual scorecard remained
unscored. The authoring workflow's 30-minute run timed out after code and QA
had been produced, so we do not equate agent completion with validated site
completion.

Corrective changes to `markets.js` and `markets.css`:
the state formerly called `live` is now `connected`; the accessible
`#widget-status` truthfully says that the **TradingView frame has opened**
and points to a real official link if price/candles fail to render. It never
claims that data has loaded on component registration. `aria-busy`
marks ongoing initialization. BTC and all ETF fallback views always have a
visible official-link alternative. Focus moves from the removed loading
button to the persistent Close control; on asynchronous load failure it
moves to the visible Retry button. Selecting a different symbol replaces
the old provider component rather than assuming an attribute-only change
always refreshes the embedded chart.

The independently authored offline/registered-but-empty browser harness
`Z:/AI/Temp/Jobs/naojun-three-pages-20261103/focus_fallback.py`
verified at 320, 390 and 1440px that failed loads announce the error, offer
the official link and put keyboard focus on Retry; registering the widget
without a provider chart leaves the honest `connected` status and fallback,
with no fabricated success claim.

**Provider intermittency observed, not hidden:** The first live
390/1440px provider runs showed BTC, SPY, QQQ and DIA candles with matching
provider text. Later rapid switching runs, however, showed empty
NASDAQ:QQQ OHLC fields and TradingView sheriff subrequests failing,
including when the browser origin was set to `https://naojun.jp`
with **local files intercepted rather than deployed**.
Standalone provider rendering of QQQ was separately observed.
This is a dependency limitation, not proof that the site has a licensed
own quote feed or that every embedded chart will always work. Maintain the
visible provider link and no-false-success messaging rather than pretending
to supply an uninterrupted index quote service. The actual website needs
production readback of fresh BTC/ETF clicks after release.

### Final independent review correction (2026-11-03)

The independent Codex exact-commit review of `dea41da86e1de505c2e695fcc49a5ca40e357988`
found no Critical problems but one Important accessibility defect: the global
`.markets-page .mk-cover a { color: inherit }` selector won over the
low-specificity `.mk-action-primary` white text on a blue/violet CTA, yielding
unacceptable normal and hover contrast on the official TradingView link.
The exact selector was corrected with scoped `.mk-reader` link rules, giving
the primary TradingView link the light paper text on both blue and violet
background, while ordinary reader links keep the meaningful ultramarine link
color. Focus remains visible with a mango focus ring. This correction is a
review finding, not by itself evidence of a passed live CSS check.
The subsequent independent browser-computed-style probe
`Z:/AI/Temp/Jobs/naojun-three-pages-20261103/check_cta_contrast.py`
measured the actual chart-access anchor at 320, 390, 430, 768, 1024 and
1440px: **6.48:1 normal, 13.72:1 hover and focus**, all 18 checks passed.
The mango keyboard-focus outline remained visible and the action stayed in
the document at each width. No paid color audit or WebKit/physical device
evidence is implied.
