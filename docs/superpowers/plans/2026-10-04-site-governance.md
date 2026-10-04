# Site governance implementation plan

**Goal:** Add the official YouTube route and make future work/article additions follow the accepted NaoJun design.
**Architecture:** Static HTML remains the deployed output. A small Python synchronizer applies shared chrome and renders work cards from one catalogue; existing editorial feeds stay authoritative for articles.
**Tech:** Python standard library, existing HTML/CSS/JS and GitHub Actions.
**Spec:** Jun's request and docs/SITE-GUIDE.md.

- [x] Test catalogue additions, escaped copy, duplicate/unsafe input, article-body preservation and idempotence.
- [x] Extract existing covers/chrome; create content/works.json and content/site.json. Add the official channel supplied by Jun.
- [x] Implement scripts/sync_studio.py with --check; migrate current pages and article templates without changing editorial body data.
- [x] Document page roles, tokens, art direction, publication rules, update sequence and exceptions. Link from AGENTS.md, README and both publisher contracts.
- [x] Add CI drift check, browser-check representative long articles and existing routes; inspect mobile/desktop captures.
- [x] Complete read-only review and prepare release. Merge after CI and verify live URLs as recorded in the release PR.

Constraints: preserve public URLs, analytics, sales, forms and article facts; do not import another site's branding or identifiers. No new runtime dependencies. No YouTube autoplay/embed or unverified video claim.

Review focus: newly added work/count; long Japanese titles; local table scrolling; nested article header preserved; new articles cannot silently omit shared chrome.
