# u2memo WordPress Migration

Last updated: 2026-08-08
Status: Real WXR rehearsal verified; production publication not executed
Target URL: `https://pocca.net/u2memo/`

## Purpose

`pocca.net/u2memo/` のWordPress contentをStatic Siteへ移し、旧コメントは公開せずPrivate Archiveとして保持するmigration workspaceです。

Private Archiveは既存Naojun / Stay Atlas Supabase Projectを利用し、u2memo専用table + u2memo専用Auth roleで論理分離します。

## Current state

Repository側で完成済み:

- generic WXR parser / verifier
- u2memo-specific WXR entrypoint: `migration/import_u2memo_wxr.py`
- u2memo policy: `migration/u2memo_policy.py`
- inline image inventory
- tracking-like image classification
- guarded media downloader
- private DB package builder: `migration/prepare_u2memo_db_import.py`
- dedicated RLS schema: `db/schema.sql`
- post-import verification queries: `db/verification.sql`
- read-only authenticated Admin shell
- synthetic fixtures / unit tests / CI
- cutover + rollback runbook

Real WXR is used only in a private migration workspace and is not committed to this public repository. Real generated public content is also not committed until publication scope/deployment is explicitly approved.

## Target configuration

Public site:

- URL: `https://pocca.net/u2memo/`
- strategy: static output
- legacy path policy: preserve `/u2memo/...`
- comments on public pages: none

Private Archive:

- Supabase Project: existing Naojun / Stay Atlas project
- comment table: `public.u2memo_legacy_comments`
- migration run table: `public.u2memo_migration_runs`
- role claim: `app_metadata.u2memo_archive_role = "admin"`
- browser writes: disabled

## Real-WXR policy

Use:

```bash
cd sites/wordpress-blog/migration
python import_u2memo_wxr.py /PRIVATE/PATH/export.xml --output /PRIVATE/PATH/u2memo-bundle
```

The u2memo policy adds site-specific handling on top of the generic migration engine:

1. published posts/pages only are rendered publicly;
2. private/trash/internal WordPress records are not rendered publicly;
3. legacy `/u2memo/...` paths are preserved;
4. comments remain only in the private bundle;
5. commenter email/IP/User-Agent are excluded;
6. leading legacy `SECRET:` / `PASS:` control lines are removed from retained comment text;
7. `legacy_secret` is retained as a boolean audit field;
8. PASS values/hashes are not retained;
9. inline article images are inventoried even when WXR attachment records are absent;
10. likely 1px/tracking images are marked and skipped by default;
11. normalized article text SHA-256 must match after sanitization;
12. known WordPress internal item types are ignored as non-content records;
13. verified legacy `<font>` presentation loss is accepted only when normalized text remains unchanged.

## Media

`media-manifest.json` contains attachment and inline-image candidates.

Real download requires an explicit source-host allowlist:

```bash
python download_media.py /PRIVATE/PATH/u2memo-bundle/media-manifest.json \
  --output /PRIVATE/PATH/u2memo-media \
  --allow-host example-host.invalid
```

`tracking_likely=true` rows are skipped by default. `--include-tracking-likely` is an explicit opt-in.

Before production, downloaded media must be reconciled and article references rewritten so the static site does not depend permanently on retiring legacy hosts.

## Private Archive import

After u2memo bundle verification passes:

```bash
python prepare_u2memo_db_import.py /PRIVATE/PATH/u2memo-bundle \
  --output /PRIVATE/PATH/u2memo-db-import
```

This produces private migration files including:

- `u2memo_legacy_comments.csv`
- `u2memo_migration_run.json`

Do not commit either file.

Apply `db/schema.sql` to the selected existing Supabase Project, import the CSV only through a trusted Admin/server-side path, then run `db/verification.sql`.

Authentication alone is insufficient. Database RLS requires `u2memo_archive_role=admin`. There is intentionally no browser-side INSERT/UPDATE/DELETE/RPC policy.

## Verification contract

The migration verifies:

- source item/status inventory;
- published post/page count;
- private comment count;
- source and retained character totals;
- per-record normalized text SHA-256;
- legacy URL -> public path mapping;
- public path collisions;
- sanitizer/review exceptions;
- inline-media inventory;
- public-output scan for private/admin tokens;
- absence of commenter email/IP/User-Agent/PASS values from the retained archive package.

Normalization is frozen as Unicode NFC plain text with NBSP normalization, collapsed whitespace, Unicode-code-point character count, and SHA-256 over UTF-8 normalized text.

## Publication boundary

The following are intentionally not performed by the repository migration itself:

- production Supabase schema application / role assignment;
- real Private Archive DB import;
- final static-content publication to `pocca.net/u2memo/`;
- DNS/hosting switch;
- WordPress shutdown.

Those are external or recoverability-sensitive changes and follow `CUTOVER_RUNBOOK.md`.

## Repository checks

```bash
node sites/wordpress-blog/ci-smoke.mjs
cd sites/wordpress-blog/migration
python -m unittest -v test_engine.py test_u2memo_policy.py
python import_wxr.py fixtures/sample.xml --output /tmp/generic-fixture --strict
python import_u2memo_wxr.py fixtures/u2memo-sample.xml --output /tmp/u2memo-fixture
python prepare_u2memo_db_import.py /tmp/u2memo-fixture --output /tmp/u2memo-db-import
```

CI uses synthetic data only. Production WXR/private output must remain outside Git history.
