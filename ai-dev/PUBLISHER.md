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
  id, type=daily, published_at, updated_at, first_published_at, title, summary, path=daily/YYYY-MM-DD/,
  source_cycle=ai-dev-daily-YYYY-MM-DD, priority=P0|P1|P2|P3.
- `published_at` is the issue date. `first_published_at` is the real first public date and must never
  be earlier than the issue date. A delayed recovery keeps the original stable URL but records the real
  first publication date instead of backdating.
- No unpublished placeholder pages, private diagnostic data, tokens, credentials, personal device identifiers or local paths.
- Build via the template /ai-dev/_templates/article-template.html and existing studio shared shell.
- Stabilize generated output in this order: `scripts/sync_studio.py`, `scripts/build_discovery.py`,
  `scripts/sync_studio.py`; then require both generators' `--check` modes to report no changes.
  Generated HTML/sitemap/Atom and feed move together.

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

### Failure isolation and backlog prevention

- A refusal is scoped to the exact repository + operation + cycle + attempt that actually failed. Do not
  retry the identical refused write in the same run and do not evade a current hard refusal through another
  model, connector or provider.
- A prior refusal is not a permanent global publication lock. At the next scheduled 07/13/19 JST slot,
  reconcile whether the effect already occurred, re-read current permissions/contracts, and re-evaluate the
  project's normal authorized branch/PR route for the oldest incomplete cycle. If that normal route now
  succeeds, record the old refusal and the new success; do not pretend the old refusal never happened.
- Oldest incomplete ready cycle publishes first. Keep preparing later private source cycles, but do not let
  a stale refusal automatically suppress them. A newer cycle may be blocked by an older one only when a fresh
  current check shows the same hard block still applies to the release path.
- The 13:00 and 19:00 runs are recovery slots, not passive status repeats. At 13:00 refresh the exact
  checkpoint and current-route evidence if the 07:00 article is not LIVE. At 19:00 classify a still-missing
  article as a release incident and preserve the highest verified stage for the next run.
- Resume from the highest independently verified stage (source / PR+CI / merged / Pages / LIVE); never
  recreate an already completed external effect merely because an earlier response was lost.
- `ai-dev/smoke.py` rejects out-of-order/gapped daily feed sequences and any `first_published_at` earlier
  than the issue date, so a newer release cannot silently skip an older missing daily cycle.

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
is an acceptable workaround to a hard safety block. A later scheduled run may, after external-effect
reconciliation, re-evaluate the normal authorized route using current evidence; that is a fresh state check,
not a bypass of the earlier refused operation.
