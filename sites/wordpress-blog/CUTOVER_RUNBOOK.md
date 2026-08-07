# WordPress -> Static Blog Cutover Runbook

Last updated: 2026-08-07
Status: Prepared, not executed

## Principle

Do not make DNS or WordPress shutdown the migration mechanism. First create and verify a complete independent copy, then cut traffic over only after the copy passes acceptance.

## Stage A - Rehearsal from WXR

1. Export WordPress `All content` as WXR/XML.
2. Store the WXR outside the public repository.
3. Run `migration/import_wxr.py` into a private output directory with `--strict`.
4. Review `migration-report.json`.
5. Resolve every sanitizer/path/shortcode warning or document an explicit exception.
6. Review `public-manifest.json`, `inventory.json`, and `redirects.csv`.
7. Confirm drafts/private/future content is inventoried but not publicly rendered.
8. Confirm comments exist only under `private/`.

## Stage B - Media

1. Review `media-manifest.json`.
2. Determine the actual source hostnames from the manifest.
3. Run `download_media.py --dry-run` with an explicit hostname allowlist.
4. Download media into a private migration workspace.
5. Record byte size and SHA-256 for every downloaded file.
6. Investigate missing/blocked files before cutover.
7. Rewrite article media references to the final static media paths only after the downloaded set is complete.

Do not depend on the old WordPress host for images after WordPress retirement.

## Stage C - Private Comment Archive

1. Select the target Supabase Project.
2. Apply `db/schema.sql`.
3. Confirm RLS is enabled on both migration tables.
4. Assign trusted `app_metadata.wordpress_blog_role = "admin"` to the intended administrator account.
5. Run `prepare_db_import.py` against the strictly verified bundle.
6. Import `wp_legacy_comments.csv` only through a trusted Admin/server-side path.
7. Run `db/verification.sql` and compare totals with `migration-report.json`.
8. Confirm an unauthenticated browser cannot read any row.
9. Confirm an authenticated user without the Admin role cannot read any row.
10. Confirm the intended Admin can read the archive through `admin/live-admin.html`.
11. Only then configure/enable `admin/supabase-config.js`.

Browser-side comment import/write is intentionally unsupported.

## Stage D - Static Preview Acceptance

Verify at minimum:

- top/archive page;
- representative short and long articles;
- headings/lists/tables/links/images;
- Japanese characters and punctuation;
- mobile layout;
- old URL path preservation;
- canonical/title/description policy once final Domain is known;
- no legacy comments in HTML/JS/network payloads for public pages;
- `robots=noindex` remains on rehearsal pages until the final production release policy is applied.

## Stage E - Final Snapshot

Immediately before cutover:

1. Prevent new editorial changes in old WordPress for the cutover window.
2. Take a fresh final `All content` WXR export.
3. Run the exact same migration engine version again from scratch.
4. Compare the final run against the rehearsal run and explain all deltas.
5. Repeat strict verification, media reconciliation, and Private Archive count checks.

The rehearsal export is not the final source of truth if WordPress changed afterward.

## Stage F - Domain Cutover

Only after final verification passes:

1. Deploy the final static output to the selected production hosting target.
2. Configure the final Domain and HTTPS.
3. Apply redirects only where the legacy path cannot be preserved.
4. Verify representative legacy URLs over HTTPS.
5. Verify sitemap/robots/canonical/OGP for the production Domain.
6. Verify the Admin archive remains protected after the Domain change.

DNS change is intentionally not automated by this repository.

## Rollback

Before DNS cutover, record how to restore traffic to the old WordPress host.

If a critical defect appears after cutover:

1. stop further content changes on the new site;
2. restore the previous DNS/hosting target if still available;
3. keep the final WXR and migration bundle unchanged as evidence;
4. fix the migration defect in a new run rather than editing generated output ad hoc;
5. rerun verification before attempting cutover again.

Do not cancel/delete the old WordPress hosting until the migration is accepted and the chosen rollback window has ended.

## Completion record

A final migration record should include:

- source WXR file name and hash;
- migration engine commit SHA;
- final Domain;
- post/page/attachment/comment counts;
- raw and normalized character totals;
- warning/exception list;
- media download result counts/hashes;
- Private Archive DB verification results;
- redirect exceptions;
- production deployment commit;
- cutover date/time;
- rollback procedure/status.
