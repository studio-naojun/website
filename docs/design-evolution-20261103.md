# NAOJUN STUDIOS / DESIGN EVOLUTION 2.1 — editorial renewal

Status: source-bound creative preflight, 2026-11-03. Scope: substantial redesign
of the public studio homepage, editorial category landings and existing/current /
future investment, admissions and AI development articles. Leave the self-contained
applications (`stay`, `tools/3lines`, etc.), published facts, selling terms,
analytics contracts and article canonicals untouched.

## Discovery: what makes the product specific

**The studio makes things people can use and publishes its process of observing
the world.** Those are two genuine editorial channels, not six generic product
categories. NaoJun's real anchors: the actual Ametsuta playable game / Koechara
product art, and dated, source-backed editorial records. Preserve the NAOJUN
STUDIOS name, actual project/brand assets, verified article links and authorship.

Current screenshots captured from production on 2026-11-03 in
`Z:/AI/Temp/Jobs/naojun-design-20261103-baseline/`: home, investment and
admissions landing, investment/admissions/AI-dev articles, futurecast, at
390 and 1440 CSS px. Baseline ref `f256f2a19818c9a542af5f26166c77140b35b65f`.
The current article first screen repeats 2–3 all-caps meta/eyebrow labels before
one enormous heading, then ordinary central copy without editorial navigation.
This is the clearest high-value renovation opportunity.

## Three structurally distinct concepts

### A. The Useful Archive — archival index

Homepage as a filtered library, highly typographic, all projects in an index
with small real screenshots; article pages resemble reference ledgers with
chronological top-to-bottom contents. Reader can compare entries quickly, but
the home has no clear visual lead, and the resulting print/broadsheet treatment
is another increasingly common AI design default. **Rejected**.

### B. Two Lenses — a studio and its field notes (selected)

Purposeful duality: **MAKE / OBSERVE**. A dramatically composed homepage places
one authentic work specimen in dialogue with a dated editorial item; work and
research have distinctive rhythms but share brand, rules, typography and
navigation. Hero states *what a visitor can do*, not an abstract AI promise.
Magazine-like article pages have a precise issue masthead, a narrow comfortable
reading column, and a context rail indexed by actual `h2` content; metadata
occupies its own editorial line. Mobile transforms the rail into a compact
native expandable contents navigator, not a 34px card grid. Interior research
category pages remain data-dense, but their article links are clear editorial
rows, not generic card grids.

Design language: almost-white limestone `#f7f6f1` for reading, deep ink
`#151c1b`, restrained field-note blue `#2445db` and product-specific coral
`#e66f4a` for *one* focal move. Sparse warm-lime `#dceba6` only when a useful
two-channel contrast is required. Typography uses a coherent system sans for
Japanese with very limited English mono folios, not decorative labels on each
section. Headlines stay readable in Japanese at narrow widths. Visual identity
comes from actual specimens and two-column editorial rhythm, not from glow,
rounded SaaS cards or gratuitous movement.

Product anchors: (1) genuine playable Ametsuta/real Koechara visuals and
corresponding link destinations; (2) actual dated research from the investment,
admissions and AI-dev feeds, navigable by a contents rail whose headings are
generated from real article sections, never invented excerpt data.

Trade-off: a bespoke typographic/content system takes more care than a plain
card template. Benefits are clear reader orientation, distinctiveness,
responsiveness and discoverability.

### C. Studio in Motion — kinetic exhibition

Interactive vertical storyboard with full-screen product scenes and animated
transitions; articles appear as chapters in a kinetic slideshow. Strong visual
impact but excessive loading, scrolling and accessibility complexity for long
source-backed research. **Rejected**.

## Rough composition, BEFORE implementation

Desktop 1440:

```
 brand symbol  NAOJUN STUDIOS                  WORK  JOURNAL  ABOUT  STORE
 ---------------------------------------------------------------
 [STUDIO / two lenses]   visitor-facing purpose
 |  MAKE | authentic hero specimen   | OBSERVE | today's dated report
 |       work destination / caption  |         editorial destination
 ---------------------------------------------------------------
           chosen works / clear actual product specimens
 ---------------------------------------------------------------
 journal / compact dated editorial index / three actual feeds
 ---------------------------------------------------------------

 ARTICLE / desktop
 HOME / RESEARCH        DATE / KIND                  SHARE? (none)
 [CATEGORY COLOR RAIL] large real Japanese title + grounded deck
 READING NAV            | prose column (~740 px), real h2 hierarchy
 (actual section links) | source tables inside scroll regions
 (sticky if space)      | visible footer nav and related actual feed
```

Mobile 390:

```
 brand                      MENU
 [MAKE] meaningful work scene + link
 [OBSERVE] current article headline + date + link
 journal index (single readable track, large tap targets)

 ARTICLE / mobile
 breadcrumb
 date • issue type / real title + deck
 [このページの内容 ▾] native details, links to each real heading
 prose 16–17 px / 1.85 leading; tables scroll only within the table
 '記事一覧へ戻る' and related section
```

## Editorial content map

- Homepage first viewport answers: what are the two output types, and what can
  I try or read *now*? Work specimen uses actual linked product art, dated
  research entry uses published sources. Do not assert a nonexistent feature.
- Works: real catalog from `content/works.json`, so manually invented cards
  cannot drift. No duplicate content registry.
- Journal: the three existing feed publishers supply titles, dates and links;
  never invent publication dates. Visible real metadata over generic category.
- Articles: correct breadcrumbs > issue category/date > readable title/deck >
  actual heading-generated contents navigation > conclusion > sources/notes >
  return to section. The article's original text and evidence remain intact.

## Source research (read at pinned commits)

1. Anthropic Frontend Design, `41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f`:
   https://github.com/anthropics/skills/blob/41bbe19d1a1a7eaab5e7bb9050a417e5c6cffc8f/skills/frontend-design/SKILL.md
   **Applied lesson:** lead with the most distinctive real *subject matter*,
   avoid repeated all-caps eyebrow + gratuitous numbered labels, make one
   memorable art move; reserve motion for meaningful states.
2. Vercel Web Interface Guidelines, `4ecfb9fb8d1d3b7009674869b3aaee2f904042e1`:
   https://github.com/vercel-labs/web-interface-guidelines/blob/4ecfb9fb8d1d3b7009674869b3aaee2f904042e1/command.md
   **Applied lesson:** keyboard focus, native disclosure, reduced-motion,
   touch interaction, long locale text and failure states are compositional
   obligations, not late fixes.
3. Magic UI Visual Hierarchy, `b1cd00a8eadd0685833c1a69c7cbdc2c942ee5f6`:
   https://github.com/magicuidesign/magicui/blob/b1cd00a8eadd0685833c1a69c7cbdc2c942ee5f6/apps/www/content/blog/visual-hierarchy-in-web-design.mdx
   **Applied lesson:** one clear starting point for attention; contrast and
   whitespace must encode source hierarchy rather than decorate it.

**Rejected pattern:** vague giant promise + two pill CTAs + stacked uniform
three-card sections, or five animated gradient effects on an article. Genuine
creative identity is *what the visitor actually sees and reads*.

## Acceptance and release boundaries

Keep canonical URLs, OG tags, feed entries, structured metadata, articles,
analytic JS, publishers, CSP, accessibility and existing CI tests intact. Run
`sync_studio.py` and `build_discovery.py` as documented before final verification.
Use exact current-main source, preserve unstaged work from other branches.
Desktop/phone screenshots and independent reviewer identify generic signatures
as a failure. Author preference for Codex/Astra is a permission, not evidence
that the current Router selected that model. No release before authorized gate.

## Implementation record — 2026-11-03

Candidate on `feature/design-evolution-editorial-20261103`, based on `f256f2a`.
The initial Codex implementation did not push or publish. Independent visual
review and production readback are separate follow-up acceptance steps; this
implementation record assigns no design scores.

- Home now pairs genuine local Koechara product art with the newest dated article.
  The work registry supplies specimen title, description, status and destination;
  the three existing feeds supply article titles, dates, summaries and URLs.
  The two-thread artwork remains as a small, controllable studio signature.
  A visible free-tool/game entrance, a separate Ametsuta specimen and a compact
  editorial index replace the previous repeated card/intro sequence.
- All 34 feed articles receive an issue masthead, controlled 740px reading column,
  actual h2-derived static TOC, desktop sticky rail, mobile native details,
  current-section indication and a feed-derived next read. Existing heading IDs
  survive. Tables retain keyboard focus and scroll locally. Published prose and
  citations were not rewritten.
- Investment/admissions indexes put the dated article archive before forecasts
  or explanatory report types. All three indexes share restrained heading scales
  and readable editorial rows. Standalone application/game logic is unchanged.
- `sync_studio.py` owns the generated structure. All three publisher placeholder
  sets are preserved; future articles inherit it during the existing sync pass.
  Shared CSS/JS versions and the site guide are updated. No dependencies, fonts,
  external artwork, feed records, analytics, CSP or authentication were added/changed.
- Reference application: the pinned Anthropic and Vercel source pages were opened
  in this session; subject-led composition and native/keyboard interaction informed
  the implementation. The supplied Magic UI hierarchy insight informed priority
  and spacing. No third-party instructions were adopted as project authority.

Actual validation:

| Check | Result |
|---|---|
| `python scripts/sync_studio.py` / `--check` | PASS; 52 pages; repeat sync changes 0 |
| `python scripts/build_discovery.py` / `--check` | PASS; changes 0 |
| `python scripts/design-integrity.py` | PASS; 52 pages, 1512 internal references |
| `python scripts/test_studio_contract.py` | PASS; 5 tests |
| `node scripts/design-smoke.cjs` | PASS; 48 route/width cases, menu/Escape/focus, filters, reduced motion, no-JS and resource checks |
| `node investment/smoke.mjs` / `node admissions/smoke.mjs` | PASS / PASS |
| `python ai-dev/smoke.py` / AI-dev unittest discovery | PASS / PASS; 6 tests |
| `node --test admissions/smoke-regression.test.mjs` | PASS; 7 tests |
| Additional Chromium editorial checks | PASS; home, three requested articles and three indexes × 320/390/430/768/1024/1440; no document overflow or console errors; TOC targets, native disclosure, sticky rail and no-JS checked |
| Source comparison against HEAD | PASS; 34 article bodies identical after normalizing added heading IDs/table attributes; canonicals, SEO and schema identical |
| Publisher/empty-feed checks | PASS; all three token contracts, future TOC generation, duplicate headings, preserved IDs, repeat sync and empty feeds |
| Keyboard table scrolling | Verified on investment 2026-10-31 and admissions 2026-09-14 at 390px; ArrowRight moves each table 40px, document remains stationary |
| `git diff --check` | PASS |

Screenshots and browser JSON are local candidate evidence under
`C:/Users/jun/AppData/Local/Temp/naojun-editorial-20261103/` (390/1440 heads,
full pages and desktop reading positions). Browser tests used the existing local
Playwright installation and Chromium; no package installation was needed.
The first browser pass found a narrow-screen footer-wordmark overflow, now fixed.
Visual inspection also corrected stale TOC current-section state after scrolling
back to the top. A legacy admissions table minimum width also prevented native
keyboard scrolling; the shared table rule now resets that width. Production
readback and independent scoring were not performed.

Changed-source SHA-256 (sorted path + NUL + file bytes + NUL, excluding docs):
`df168261c745416fb150df594b8acb7057804b0b90b34d71b454d935b5445dc3`.
Router preview was read before implementation: revision 42; design preferred
CLAUDE_CODE without a work adapter, implementation selected eligible CODEX.
Work continued in the already-active native implementation session; no new
provider execution, policy change or fallback was started.
