# WordPress Blog Migration

Last updated: 2026-08-07
Status: Ready for real WXR input
Domain: TBD

## Purpose

WordPressを継続運用せず、別DomainのBlogをStatic Site + Private Archiveへ移すためのmigration workspaceです。

公開側はStatic Site、旧コメントはSupabase RLSで保護されたPrivate Archiveとし、新規コメント受付は前提にしません。

## Current state

Completed in repository:

- Public sample index: `index.html`
- Public sample article: `posts/sample.html`
- Private Archive admin entry: `admin/index.html`
- Read-only authenticated Admin shell: `admin/live-admin.html`
- Disabled-by-default Supabase config: `admin/supabase-config.js`
- Private Archive RLS definition: `db/schema.sql`
- WXR parser and migration engine: `migration/wxr_engine.py`
- WXR CLI: `migration/import_wxr.py`
- Independent bundle verifier: `migration/verify_bundle.py`
- Guarded media downloader: `migration/download_media.py`
- Synthetic WXR fixture and unit tests
- CI smoke and migration-engine workflows

No synthetic comment records are retained in the repository. The Admin entry contains no comment dataset.

Still intentionally not completed because they require real input or an external irreversible change:

- Real WordPress WXR import
- Real media download
- Real legacy comments in production Database
- Production Supabase schema application / Auth role assignment
- Final Domain configuration / DNS cutover
- WordPress retirement

## Sensitive input rule

A WordPress WXR export may contain commenter email addresses, IP addresses, and other private legacy data.

Real WXR/XML files and generated migration bundles are excluded by `sites/wordpress-blog/.gitignore`. Never place them in this public repository.

The migration engine deliberately excludes commenter email, IP address, User-Agent, password/security fields from the retained Private Archive bundle.

## Migration engine

The engine uses only Python standard library code. No XML/parser package is required.

Example:

```bash
cd sites/wordpress-blog/migration
python import_wxr.py /PRIVATE/PATH/export.xml --output /PRIVATE/PATH/migration-bundle --strict
```

The engine:

1. parses WordPress WXR/XML;
2. inventories posts, pages, attachments, statuses, categories, tags and comments;
3. preserves legacy URL paths for published posts/pages;
4. sanitizes publishable HTML using a conservative allowlist;
5. flags active/unsupported markup and shortcodes for review;
6. creates static preview pages without comments;
7. writes all retained comments only to `private/comments.jsonl`;
8. creates a media manifest;
9. creates `redirects.csv`;
10. records counts, normalized character totals and SHA-256 hashes;
11. verifies that rendered article text matches the source normalized text;
12. scans public output for Private Archive/Admin tokens.

The engine does not silently treat sanitizer warnings as migration completion. Use `--strict` for final acceptance.

## URL policy

Default policy is `preserve_legacy_path`.

For example:

```text
Old:
https://old.example.com/2024/01/example/

New Domain:
https://NEW-DOMAIN/2024/01/example/
```

Keeping the path stable reduces redirect requirements. `redirects.csv` is still generated so every legacy URL can be audited before cutover.

## HTML safety

WordPress article HTML is not copied blindly into production output.

The migration engine:

- removes `script`, `style`, and `template` content;
- strips unsafe URL schemes such as `javascript:`;
- removes event-handler/style attributes;
- flags iframe/form/object/embed/svg/canvas/video/audio and unknown tags for review;
- flags shortcode-like syntax for review;
- compares normalized source text and normalized rendered text after sanitization.

A warning remains a migration exception until reviewed. Final strict verification fails when warnings remain.

## Media migration

`media-manifest.json` inventories WordPress attachment URLs.

The downloader does not make network requests unless an allowed source hostname is explicitly supplied:

```bash
python download_media.py /PRIVATE/PATH/migration-bundle/media-manifest.json \
  --output /PRIVATE/PATH/media \
  --allow-host old.example.com
```

Safety controls include:

- explicit hostname allowlist;
- only `http` / `https` sources;
- response Content-Type checks;
- per-file byte limit;
- SHA-256 for downloaded files;
- no executable processing of downloaded files.

Use `--dry-run` to validate manifest URLs without downloading.

## Private Archive

Real migrated comments will live in `wp_legacy_comments` protected by Database RLS.

Expected administrator claim:

```json
{
  "app_metadata": {
    "wordpress_blog_role": "admin"
  }
}
```

Authentication alone does not grant archive access. Database RLS is authoritative.

`admin/live-admin.html` is read-only. Browser-side INSERT/UPDATE/DELETE/RPC writes are intentionally absent. Initial migration writes must use a trusted server-side/Admin path.

Current `admin/supabase-config.js` remains disabled until the target Supabase Project is explicitly selected and `db/schema.sql` is actually applied.

## Retained legacy comment fields

Retained:

- legacy comment ID
- legacy post ID
- post slug
- parent legacy comment ID
- display name
- comment body
- local/GMT timestamps
- WordPress approval/status value
- comment type
- raw character count
- normalized plain-text character count
- normalized plain-text SHA-256
- import timestamp in Database

Excluded:

- commenter email address
- IP address
- User-Agent
- password/security data

All WordPress comment statuses are inventoried and retained in the Private Archive rather than silently discarding spam/trash records. Public display remains zero comments.

## Verification contract

Migration completion is machine-verified, not judged by visual spot checks alone.

Source/output verification includes:

- posts total
- pages total
- attachments total
- comments total
- approved comments total
- post/page status distribution
- comment status/type distribution
- per-record legacy IDs
- legacy URL -> output path mappings
- raw content character totals
- normalized content character totals
- raw comment character totals
- normalized comment character totals
- per-record normalized text SHA-256
- sanitizer/review warning count
- missing/colliding output paths
- public output scan for private/admin tokens

Normalization is frozen as:

1. HTML text extraction excluding script/style/template content;
2. HTML entity decoding;
3. NBSP -> normal space;
4. Unicode NFC normalization;
5. all whitespace runs -> one space;
6. leading/trailing whitespace removal;
7. character count as Unicode code points;
8. SHA-256 over UTF-8 normalized text.

Do not change this algorithm after seeing real-data mismatches unless the change is documented and both source and destination are recounted with the same version.

## Completion gate

WordPress is not considered migrated until:

- all required public records are mapped;
- all retained comments are present only behind RLS;
- source/output count verification passes;
- normalized text/hash verification passes;
- all sanitizer/review warnings are resolved or explicitly accepted;
- media manifest/download verification is complete;
- redirect coverage is reviewed;
- public pages contain no private comment data;
- target Domain/DNS plan is fixed;
- rollback/cutover procedure is documented;
- final WordPress export is taken immediately before cutover and reconciled against the tested migration run.

## Repository checks

From repository root:

```bash
node sites/wordpress-blog/ci-smoke.mjs
cd sites/wordpress-blog/migration
python -m unittest -v test_engine.py
python import_wxr.py fixtures/sample.xml --output /tmp/wordpress-blog-fixture --strict
python verify_bundle.py /tmp/wordpress-blog-fixture --strict
```

CI is intentionally independent of production Supabase and real WordPress data.
