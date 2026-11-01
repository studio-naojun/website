# AI Developer Watch — Static Publisher Contract

Canonical private source: ffz2bpjyj4/kanade-report-library
Canonical public target: studio-naojun/website
Public category: https://naojun.jp/ai-dev/

## Scope and authority
This contract applies only to 001-04 daily AI developer security, reliability and technology reports.
Standing policy: auto_publish=true; publication_policy=auto-after-checks; review_mode=post-publish.
Do not change Investment or Admissions approval/publication contracts.
Read /AGENTS.md and /docs/SITE-GUIDE.md on current main before changes.

## Eligible source record
Source cycle: reports/ai-dev-daily-YYYY-MM-DD/.
Require report.yaml with matching id/type/date, research material, source registry with official references,
03_manuscript/blog-draft.md, completed 05_review/publication-checklist.md without blockers,
and 06_publication/editorial-status.md status=draft-ready with valid policy and target path.
Any material change to source before merge invalidates authorization until rechecked.

## Public files and feed
- Article stable URL: /ai-dev/daily/YYYY-MM-DD/
- On update of the same day, edit the *same* article (no duplicate feed id) and mark updated_at with correction history.
- Feed: /ai-dev/feed.json; newest first, unique id daily-YYYY-MM-DD. Entry fields:
  id, type=daily, published_at, updated_at, title, summary, path=daily/YYYY-MM-DD/,
  source_cycle=ai-dev-daily-YYYY-MM-DD, priority=P0|P1|P2|P3.
- No unpublished placeholder pages, private diagnostic data, tokens, credentials, personal device identifiers or local paths.
- Build via the template /ai-dev/_templates/article-template.html and existing studio shared shell.
- Run scripts/sync_studio.py then scripts/build_discovery.py; generated HTML/sitemap/Atom and feed together.

## Public article acceptance
Each material incident should explain: what happened, precise affected product/version/configuration,
practical impact, vulnerable/not-vulnerable conditions, verified immediate fix or mitigation,
how to check successful remediation, timestamp and primary evidence inline, known uncertainty.
P0/P1 first; no fabricated exploits, versions, commands or source links; no needless filler.
Differentiate first disclosure, latest update, and as-of JST. Correct published errors visibly.

## Safe release protocol
1. Resolve source/target current GitHub repo metadata and permissions.
2. Read the latest source and website contracts, feeds and existing incident/date records.
3. Validate public/private boundary, editorial checklist, official sources, link safety and consistency.
4. Create or recover a dedicated publication branch/PR for the single date; inspect exact diff/provenance.
5. Required local tests and CI including studio, discovery and AI-dev smoke must succeed at exact PR head SHA.
6. Re-read source content/checklist/status to ensure no mutation or blocker.
7. Merge authorized PR; verify matching GitHub Pages deployment and LIVE HTTP 200 content/links.
8. Store verified commit, PR, Pages evidence and real URL in private source status, then notify Jun.
9. If delayed/failed, leave an idempotent checkpoint for 13:00 and 19:00 retry. Never assert live from merge alone.

The 13:00 and 19:00 slots must also check newly disclosed emergency P0/P1 events;
update an already published same-day article by a distinct correction PR, not by duplicating posts.
If no meaningful change, leave content and public notifications unchanged.

## Automatic X distribution

After a new `ai-dev/feed.json` entry reaches `main`, the public article is distributed automatically to
`@naojun_security` by `.github/workflows/x-editorial-publish.yml`.

- only a newly seen immutable feed `id` is eligible; same-day corrections to the same `daily-YYYY-MM-DD` id never create a second X post;
- pre-existing feed ids recorded in `content/x-editorial-state.json` are the launch baseline and are never backfilled;
- the workflow waits for the canonical `https://naojun.jp/ai-dev/.../` URL to return live before posting;
- the X account is verified as exactly `@naojun_security` before any POST;
- duplicate detection uses the canonical article URL from recent posts; if a POST outcome is ambiguous, the id is stored as `uncertain`, automatic re-POST is disabled, and hourly runs only attempt URL reconciliation;
- X copy uses only the already-public feed title/summary; private device, remediation, source-repository, or diagnostic material is never included;
- successful/reconciled X receipts are stored in `content/x-editorial-state.json`;
- the hourly recovery trigger only retries still-unpublished new feed ids and otherwise performs no X API call.
- an `uncertain` id blocks later automatic posts on the same channel until it is reconciled or deliberately cleared.
- withdrawing an article does not automatically delete its X post; removal/correction on X is a separate deliberate recovery action.

## Claude feedback and Jun environment
Independent Claude Code Opus 5.5 review happens after the 19:00 pass (Windows 22:00 / 23:00 recovery).
The verified Claude JSON lives in the private source repository's ai-dev-feedback branch under
ops/ai-dev-review/YYYY-MM-DD/claude.json. The next morning's GPT must read it and record
adopt/defer/reject decisions with evidence; do not confuse missing feedback with a reviewed day.
Remediation for Jun's own environment is PRIVATE and separate from public reports. Confirm actual
version/configuration before creating unique remediation tasks. Do not publish private diagnostics.

## Fail closed
Never merge on unknown/failing CI, ambiguous repo identity or diff, unsupported claims,
unverified source, public secret exposure, or platform safety denial. No alternate model/connector
is an acceptable workaround to a hard safety block.
