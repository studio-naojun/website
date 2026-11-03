# NAOJUN STUDIOS — the visual reboot after rejected v2.1

**Status:** creative preflight, before implementation, 2026-11-03.
**Scope:** substantial site redesign, not a targeted UI fix. This replaces the
visual idea of the previous `MAKE / OBSERVE` two-column revision. The owner
explicitly rejected that result as merely tidied-up: this is the fundamental
acceptance criterion. A cleaner alignment or color substitution is a FAIL.

## What the visitor actually comes for

NAOJUN STUDIOS is a small two-person production studio which publishes real
usable products (including the actual Koechara product and Ametsuta game), free
tools, and separately produces research-based investment, school admissions and
developer/security journals. The site must make a new visitor want to *try a
real work* or *read a real report*, in seconds. Product, source and date exist;
fake clients, growth numbers, awards, stock mockups and fabricated charts do not.

## Baseline that failed

Release `ecd1d33865793cf90ceb6b9727ed09467e63cfd0` deployed 2026-11-03.
Verified browser evidence in
`Z:/AI/Temp/Jobs/naojun-design-20261103-production/` including
`home-1440.png`, `home-390.png`, `adm-article-1440.png` and
`adm-article-390.png`. These are genuine site captures, not a concept render.

The logo, paper-tone #f4f3ec, black hairlines, generic text tables and sober
column layout remain almost identical to the earlier site. On articles, the
headline remains black on beige and a left TOC is basically the only visible
change. The design system has no editorial cover, identifiable article series,
illustrated subject, visual storytelling or memorable first-screen composition.
The previous internal design score of 9.11/10 was not a reliable originality
assessment; the user's comparison supersedes that subjective grade.

## Three *structurally divergent* directions

### A. The Living Desk (rejected)

Visitors enter an illustrated collection of physical work objects on a desk:
the Koechara app appears as a tilted real screenshot, Ametsuta as a game card,
and the three research editions as stacked notebooks. Images, art direction and
spatial collage dominate. Articles open like folding notebook sheets with
side annotations. Mobile becomes a single vertical art board. Memorable but
the tactile metaphor can obscure navigation and produce slow, fragile layouts.

### B. A Studio Broadcast (rejected)

An always-moving broadcast of studio products, new reports and in-progress
experiments. Home starts with a kinetic ticker plus rich visual preview, tools
lead to active demos, articles have news-like timestamps, captioned graphics
and perspective rails. Mobile adapts to a compact channel. Real content exists,
but frequent motion over-represents freshness and harms long research reading;
not appropriate for three evidence-heavy editorial genres.

### C. Studio Editions / The Covers (SELECTED)

NAOJUN is a **publisher of useful things and verifiable ideas**. Instead of a
beige two-column landing, make its first screen a striking, colorful *edition
gallery*: actual product imagery is one oversized visual specimen, while live
articles are represented as designed issue covers with the actual titles,
dates, sections and links. Cover art is intentionally designed by category —
not AI stock, not fake market trends, not a collection of equal SaaS cards.

The homepage begins like a bold independent visual publication with different
compositional weights: a monumental studio title and direct action *try a free
game*, next to an authentic full-bleed work image; a set of live paper-like
edition covers emerges immediately rather than below repeated text summaries.
Research has three recognizably different but related series; every actual
article opens with a visually immersive **cover spread** using the authentic
title/date, and a useful, heading-derived chapter preview. A calm reading
surface follows the cover, with a chapter rail and accessible source tables.
The content stays sober; the art is not a substitute for evidence.

**Identity/token plan:** warm chalk-white #fdfaf4 for readable interiors,
deep violet-ink #302447 for brand/nav, saturated ultramarine #3d47da for
interactive/finance, luminous blue-green #9bd9d0 for the playable studio,
soft mango #f5b85b for education, and bright raspberry #f26966 for security.
These are distinct family fields, NOT near-black plus acid green or cream with
terracotta and endless rules. Distinctive typography uses one confident
Japanese humanist sans with a compact condensed display for English issue
identifiers; Japanese body remains legible system sans at 16–18px. Boldness is
spent on the one actual large specimen and real issue covers, not on ten
decorative animations. No external font, no layout shift from dynamic fonts.

**Named product anchors:** (1) authentic Koechara / Ametsuta visuals from the
site's actual asset registry, linked to real working destinations and free-use
journey; (2) 3 real publication feeds plus the *real h2* contents from every
article, date and section as cover story artwork and navigation. A generic
portfolio could not truthfully claim either.

**Why C:** ambitious composition, real material and a coherent design grammar
for both products and serious research; clear on 320px, no heavy animation,
fast static HTML, no invented evidence.

## Content map & placement

1. **First screen / studio entrance:** recognizable NAOJUN brand, specific
   promise (`つくる。遊ぶ。確かめる。`) and direct free game/tool access, presented in a
   dynamic editorial cover layout with genuine product screenshot, not a slogan
   sitting above two clean columns.
2. **Works gallery:** different sizes and crops based on the actual products;
   accessible product titles, real status/cost, obvious try/open links.
3. **Live editions:** investment, admissions and AI-dev as three contrasting
   issue-cover treatments, each pulling the current item from `feed.json`.
   The title, date and linked destination must remain data-driven.
4. **Article cover:** dramatic yet readable themed canvas, one actual title and
   deck, authentic publication metadata, accessible cover chapter previews
   derived solely from published headings. No invented images of schools,
   numbers or market graphs, no fake photography.
5. **Article reading:** calm, genuinely legible long-form text, narrow measure,
   meaningful section transitions, anchored chapter links, clear evidence
   tables and citations, related real publication. Readers get clarity after
   being drawn in by the cover.
6. **Indexes & footer:** matching category cover and truthful dated lists,
   unbroken Works/Journal/Store/Contact/YouTube routes.

## Before-code composition sketches

Desktop 1440:

```
 ┌─ STUDIO HEADER / brand + nav ─────────────────────────────────────────────┐
 │                                                                          │
 │ BIG EDITION COVER ┌────────────┐            REAL WORK EXPERIENCE         │
 │ つくる。           │  PRODUCT   │    ┌────────────────────────────────┐  │
 │ 遊ぶ。            │  CAPTION   │    │         ACTUAL SCREEN          │  │
 │ 確かめる。         └────────────┘    └────────────────────────────────┘  │
 │           [アメツタを遊ぶ]   [作品一覧]   [記事へ]                        │
 └──────────────────────────────────────────────────────────────────────────┘
 ┌── NEXT PAGE ────────────────────┬──────────────────────┬───────────────────┐
 │ Investment issue / actual date │ Admissions / title   │ AI-dev / title    │
 │ purposeful color/typography    │ different cover art  │ type/circuit      │
 └────────────────────────────────┴──────────────────────┴───────────────────┘

 ARTICLE
 ┌───────────────────── FULL EDITION COVER / themed visual art ─────────────┐
 │ breadcrumb / real edition date / field                                 │
 │ HUGE EDITORIAL TITLE                     ┌─────────────────────────┐    │
 │ real deck / byline / publication notes   │ REAL CHAPTER PREVIEW    │    │
 │                                         │ linked to actual h2     │    │
 └─────────────────────────────────────────┴─────────────────────────┘    │
 ┌─ side chapters ──┬─ a calm long-form report / citations / data tables ────┐
```

Mobile 390:

```
 brand                          menu
 ┌─ colorful editorial cover ─────────────────┐
 │ large, readable Japanese one-line rhythm   │
 │ real product photograph/screenshotted UI   │
 │ one unequivocal try/free action            │
 └────────────────────────────────────────────┘
 [latest investment issue] [admissions issue] [AI-dev issue] (stacked, not slivers)
 ARTICLE
 [category cover / fullbleed / strong readable title and date]
 [actual key chapters linked, text wraps naturally]
 [このページの内容 ▾] (native details)
 [long-form reading, local table scrolling]
```

## Source lessons read for this revision

- Anthropic `frontend-design`, at commit
  `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`, fetched via GitHub's
  direct file connector 2026-11-03. The source warns that BOTH near-black
  with acid accents and beige broadsheets/hairlines are common generated
  defaults. Therefore **reject** either as the new system. Real product
  material leads, typography is structural, and animation is restrained.
- Vercel `web-interface-guidelines/command.md`, at commit
  `4ecfb9fb8d1d3b7009674869b3aaee2f904042e1`, fetched via GitHub's
  direct file connector 2026-11-03. Apply native links/disclosure, visible
  focus, reduced motion, responsive 320px content, explicit image dimensions,
  semantic heading levels and table-local scroll.

Rejected generic motif: beige-paper two-column MAKE/OBSERVE with thin rules,
overlarge headline then undifferentiated article lists, dark/acid hero, and
uniform dashboard cards. The selected full-bleed covers and real chapter
preview change the information architecture, not just the colors.

## Acceptance, release scope

Visual **A/B at 390 and 1440 must obviously differ from `ecd1d338` without
reading the CSS diff**: full-bleed studio cover, editorial treatments for all 3
fields and article pages with a new first screen. All existing 34 article
bodies/citations/canonicals/SEO/schema must remain literally intact other than
necessary stable HTML wrappers or heading IDs; future publisher templates
inherit the design. Preserve the Works registry, forms and auth, no new paid
libraries, no external photo or stock image, no unverified metrics. Use one
isolated working tree. Run all required full-width/browser and publisher gates,
independent visual critique, revise as needed and verify GitHub Pages deployment
only after safety and access gates pass.

## Implementation record (2026-11-03, candidate worktree)

Base `ecd1d338` on `feature/naojun-visual-reboot-20261103`, worktree
`_staging/naojun-editorial-reboot-20261103`. Nothing pushed or deployed. No change to
secrets, auth, CSP, analytics, canonical/schema/og/meta description, publication dates,
purchase/STORES links, forms, or app-internal UI (Koechara, Ametsuta play, 3lines, JAN).
No design score is self-assigned; a separate reviewer judges the screenshots below.

### What changed structurally (not only CSS)

- **Home (`index.html` + `scripts/sync_studio.py`)**: the MAKE/OBSERVE two-column
  landing and the dark journal band are gone. New order:
  1. `front-cover` (violet field): h1 `日々に、小さな発明を。`, three cover lines
     遊ぶ／つくる／確かめる linking to the game, Works and the editions, the existing
     two-thread canvas as a paper seal; the genuine Koechara 1440×900 screen as a
     cropped bleed specimen; a mint **アメツタを遊ぶ** block with a real gameplay frame.
     Generated from `content/works.json` (`spotlight_id` + new optional `specimen`).
  2. `editions-section` (`#journal`): three issue covers generated from each `feed.json`
     — latest title/date/type/summary plus back numbers — in an asymmetric grid
     (tall investment, stacked admissions and AI-dev).
  3. Free shelf: the featured Ametsuta card + JAN and 3lines as a numbered typographic list.
  4. YouTube channel, About note, footer (now violet with a mint wordmark).
- **Articles (all 34, and future ones via sync)**: `editorial_article()` now writes two
  managed blocks into the existing hero `<header>`: `studio:coverart` (aria-hidden
  nameplate INVESTMENT / ADMISSIONS / AI-DEV + category ornament: orbit lines and
  outlined issue date; the real publication month calendar with the issue day marked;
  circuit traces) and `studio:covernav` (`この号の章立て` nav, the first 4 real h2
  headings linked to their IDs, plus `全N章の目次へ` → `#reading-toc`). The hero is a
  full-bleed colour field per series (ultramarine / mango / raspberry). The body,
  citations, h1, deck, byline and metadata are untouched. Body class `edition-<section>`
  drives the series colours. Sync stays idempotent.
- **Category indexes**: `edition-<section>` body class; the hero becomes the series
  colour field with a CSS-only decorative pattern. Content unchanged.
- **Global chrome**: palette tokens replaced (chalk `#fdfaf4`, violet `#302447`,
  ultramarine, mint, mango, raspberry), four-colour edition strip under the header,
  OS-only fonts (Japanese display sans + Bahnschrift/Arial Narrow condensed). No
  external font or library.

### Changed files

- `scripts/sync_studio.py` — `EDITIONS`, `cover_art()`, `chapter_preview()`,
  `front_cover()`, `editions()`; validated optional `specimen` field; edition body
  classes; removed the obsolete make/observe/journal/hero-strip generators; CSS/JS
  cache key `20261103r`.
- `index.html` — new `<main>` composition with managed blocks `frontcover`, `editions`,
  `featured`, `channel`; theme-color `#302447`.
- `assets/css/studio.css` — tokens; removed the two-lenses layer; new Studio Editions layer.
- `assets/js/studio.js` — the cover's `#reading-toc` link opens the native `<details>` contents.
- `content/works.json` — `specimen` for Ametsuta.
- `works/ametsuta/assets/ametsuta-play-2026-11.webp` (new, 9.7 KB, 640×1131) — a real
  frame of the shipped game, captured headless from `/works/ametsuta/play/` in this worktree.
- `investment/_templates/article-template.html`, `admissions/_templates/report-template.html`,
  `ai-dev/_templates/article-template.html` — one comment noting that the cover is generated.
- `docs/SITE-GUIDE.md` — visual table, cover/`specimen` rules.
- `scripts/design-smoke.cjs` — see the test note below.
- Regenerated by sync: 52 pages (34 articles, 3 indexes, home, interiors; mostly the
  CSS/JS version key).

### Verification (final state)

| Gate | Result |
|---|---|
| `python scripts/sync_studio.py` / `--check` | 0 changes on rerun, 52 checked (idempotent) |
| `python scripts/build_discovery.py --check` | 0 changes |
| `python scripts/design-integrity.py` | PASS 52 pages, 1688 internal refs/anchors, unique IDs, one h1 each, img alt/size |
| `python scripts/test_studio_contract.py` | 5 tests OK |
| `node investment/smoke.mjs`, `node admissions/smoke.mjs`, `python ai-dev/smoke.py` | PASS |
| `node scripts/design-smoke.cjs` (Chromium 151, local Playwright) | PASS: menu/Escape/focus, focus contrast, motion toggle, filters, 48 route×width checks, no-JS, zero JS/resource errors |
| Article fidelity script (all 34 feed articles vs HEAD) | `<article>` body text and canonical URL identical; h1 visible text identical (AI-dev wraps `日報` in a display-only span), all 34 have the cover |
| Measurement 320/390/430/768/1024/1440 × 10 routes | no document overflow, no cover element outside its field, no text column under 60px |

Test note: `design-smoke.cjs` checked the stylesheet loaded by asserting the old body
colour `rgb(244, 243, 236)`. The palette was replaced on purpose, so that one literal
is now `rgb(253, 250, 244)` (the new `--paper`). The check still does the same job. No
other test changed. `ai-dev/smoke.py` requires `href="ai-dev/"` on the home page, so the
edition covers keep that relative link form instead of a test edit. The smoke found a real
regression (the Ametsuta vertical title clipped at 768px), which was fixed in CSS. axe-core
is not installed locally, so the optional WCAG audit did not run.

### Screenshots

`Z:/AI/Temp/Jobs/naojun-reboot-20261103/`
- `final/` — home, 3 indexes, 3 articles at 320/390/430/768/1024/1440; `final/full/` full pages at 390/1440.
- `compare/` — BEFORE (production `ecd1d338`, `Z:/AI/Temp/Jobs/naojun-design-20261103-production/`)
  vs AFTER side by side at 390 and 1440 for `/`, `/investment/weekly/2026-10-31/`,
  `/admissions/weekly/2026-11-02/`, `/ai-dev/daily/2026-11-01/` and the 3 indexes.
- `design-smoke/` — smoke artefacts, including about/works/koechara/contact routes.
- `r1`–`r4/` — intermediate rounds (seal overlap, dead band above titles, chart-like AI-dev
  bars replaced by circuit art, mobile calendar overflow, index hero contrast).

### Independent critique and corrective revision

An independent, **read-only** Codex `gpt-6.1-sol` visual critique (separate from
Opus author, METIS request `naojun-reboot-independent-review-20261103-01`)
compared the true before/after screenshots at phone, tablet and desktop sizes.
Verdict: **REVISE**, not an automatic pass. The new direction is visibly and
structurally different from `ecd1d338` and merits refinement; no Critical
findings, with three Important and one Minor findings:

- **Important**: decorative calendar/circuit covered issue metadata at tablet
  768 and 1024. Fixed by hiding just these decorations in the 761–1099px
  intermediate range while preserving the coloured edition/title/metadata.
- **Important**: prominent Japanese titles split `アメツタを遊ぶ` at 320px and
  `日報` in the AI-dev headline at phone and desktop. Fixed with a narrower real
  Ametsuta image column and adjusted type at <=360px plus an idempotently
  generated no-wrap span around `日報` in the visible h1, leaving plain text,
  content, metadata and canonicals unchanged.
- **Important**: mobile article cover had excessive empty vertical space before
  first chapter link. Reduced 64px header-content gap to 24px and tightened
  title/bottom spacing; retained cover identity and accessible links.
- **Minor**: chapter preview showed double ordinals (`02 1. ...`). Fixed by
  stripping the heading's leading numeral **in the cover preview only**;
  actual h2 headings and full table of contents remain unchanged.

After those changes: `sync_studio.py --check` returns zero changes over 52
pages, article text/canonical comparison still returns 34/34 unchanged,
`design-integrity` passes 1688 references and the independent 10-route ×
6-width Chromium geometry/console test reports **60/60 pass**. Fresh phone,
tablet and desktop screenshots are in `Z:/AI/Temp/Jobs/naojun-reboot-20261103/candidate/`
and correct the specific screen regions identified by the reviewer. This
follow-up was visually checked against the exact four reported defects; the
original review should not be represented as a PASS in retrospect.

The independent read-only Codex recheck (`naojun-reboot-independent-recheck-20261103-02`)
confirmed **all original five visual defects corrected**, but found a new
Important collision: the AI-dev mobile circuit illustration touched the issue
update timestamp after shortening the cover. Revised the 760px-and-under
circuit from 108px/48px-top to 72px/8px-top, deliberately reserving the
metadata area while retaining a recognisable decorative circuit in the cover.
Final visual and geometry checks must use screenshots **after** this CSS
adjustment; the recheck's earlier REVISE finding is retained as provenance.

### Open items

- Git commit / CI / production deploy and production readback are separate gates.
- WebKit/Safari and axe audits did not run (no axe-core installed locally).
- Edition covers truncate long summaries/back-number titles visually (line clamp / ellipsis)
  on the two smaller covers. Full text is one click away on the article and index pages.
