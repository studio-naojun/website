# WordPress Blog Migration Shell

Last updated: 2026-08-07
Status: Phase 1 prototype
Domain: TBD

## Purpose

WordPressを継続運用せず、別DomainのBlogをStatic Site + Private Archiveへ移すための移行前shellです。

このPhaseでは実WordPress exportを取り込みません。公開表示、Admin UI、Private Archiveのauthorization boundary、後続migrationの完了条件だけを先に固定します。

## Current Phase 1 scope

Implemented:

- Public sample index: `index.html`
- Public sample article: `posts/sample.html`
- Admin prototype: `admin/index.html`
- Synthetic comments for UI confirmation only: `admin/admin.js`
- Private Archive RLS definition: `db/schema.sql`
- Site/migration configuration: `site.config.json`
- Static smoke test: `ci-smoke.mjs`

Not implemented yet:

- WordPress WXR import
- WordPress media import
- Real legacy comments
- Production Supabase table application
- Production Auth role assignment
- Custom Domain deployment
- Redirect map
- Final migration verification

## Data boundary

### Public

Public pages contain only publishable article content and metadata.

Legacy comments must never be embedded in public HTML, public JavaScript, GitHub-hosted JSON, or another browser-readable fallback.

### Private Archive

Real migrated comments will live in a private database table protected by Supabase RLS.

Expected administrator claim:

```json
{
  "app_metadata": {
    "wordpress_blog_role": "admin"
  }
}
```

Authentication is not the authorization boundary by itself. Database RLS remains authoritative.

The Phase 1 Admin page contains only synthetic demo comments. These are intentionally fake and may be publicly readable because the repository itself is public. Real comments must never be placed in `admin/admin.js` or any other repository file.

## Retained legacy comment fields

Planned retained fields:

- legacy comment ID
- legacy post ID
- post slug
- parent legacy comment ID
- display name
- comment body
- created timestamp
- WordPress status
- import timestamp

Intentionally excluded unless Jun later changes the archive requirement:

- commenter email address
- IP address
- User-Agent
- password/security data

## Phase 2 migration sequence

1. Export WordPress using WXR/XML.
2. Preserve the original export as immutable migration input outside the public site tree.
3. Inventory posts, pages, attachments, categories, tags, URLs, and comments before transformation.
4. Convert publishable article/page content into the selected static content format.
5. Copy media and build old URL -> new URL mappings.
6. Import retained comments into `wp_legacy_comments` through an authenticated/admin migration path.
7. Generate a machine-readable migration report.
8. Verify counts and text preservation.
9. Only after verification passes, prepare Domain/DNS cutover and WordPress retirement.

## Verification contract

Migration completion must not be judged only by visual spot checks.

At minimum compare:

- posts total
- pages total
- comments total
- approved comments total
- per-record legacy IDs
- URL/slug mapping coverage
- source raw content character totals
- normalized plain-text character totals
- unmatched/orphan records

Raw HTML/WXR character counts are expected to differ from Markdown/HTML output because representation changes. Therefore final acceptance should use both:

1. source/raw totals for audit;
2. normalized plain-text totals and preferably per-record normalized text hashes for content-preservation verification.

Normalization rules must be frozen before the real import is run. Do not change the counting algorithm after seeing mismatches unless the change is documented and both source and destination are recounted with the same algorithm.

## Completion gate

WordPress is not considered migrated until:

- all required public records are mapped;
- retained comments are present only behind RLS;
- count verification passes;
- normalized text verification passes or every exception is documented;
- redirect coverage is reviewed;
- public pages contain no private comment data;
- rollback/cutover procedure is documented.

## Phase 1 local check

From repository root:

```bash
node sites/wordpress-blog/ci-smoke.mjs
```

The smoke test is intentionally independent of production Supabase. It validates the shell and privacy boundary definition without reading or mutating live data.
