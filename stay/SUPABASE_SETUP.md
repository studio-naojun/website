# Stay Atlas Supabase Setup

This document describes the production-persistence path for the v1 Live Admin.

## 1. Create a Supabase project

Create the project in the Supabase dashboard. Do not commit database passwords, secret keys, or legacy `service_role` keys to this repository.

The browser application needs only:

- Project URL
- Publishable key

These values are configured in `stay/supabase-config.js`.

```js
window.STAY_ATLAS_SUPABASE_CONFIG = {
  enabled: true,
  url: 'https://PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_...'
};
```

The publishable key is intentionally a low-privilege browser key. Authorization remains enforced by PostgreSQL RLS.

## 2. Apply database SQL

Apply these files in order:

1. `stay/db/schema.sql`
2. `stay/db/live-admin.sql`

`schema.sql` creates the hotel, revision, verification, change-candidate and refresh-run tables, RLS policies, automatic Revision triggers, and Restore RPC.

`live-admin.sql` adds `update_hotel_record()`, which lets the authenticated Live Admin attach a change note to an update while still using the same automatic Revision trigger.

## 3. Create the administrator account

Create or invite the administrator through Supabase Auth using the dashboard or a trusted server-side administrative process.

The user's JWT must contain this App Metadata value:

```json
{
  "stay_atlas_role": "admin"
}
```

Do not use user-editable metadata for this authorization flag.

Do not place a Supabase secret key in `live-admin.html`, `supabase-config.js`, GitHub Pages, or any other browser-delivered file.

## 4. Verify Live Admin login

Open:

`/stay/live-admin.html`

The page should change from `NOT CONFIGURED` to `AUTH REQUIRED` after a valid Project URL and Publishable Key are configured.

After an administrator signs in, it should show `LIVE DB`.

A signed-in user without `app_metadata.stay_atlas_role = admin` must not receive write access. The UI also hides the workspace, but PostgreSQL RLS is the actual authorization boundary.

## 5. Initial data bootstrap

If `hotels` is empty, Live Admin exposes **Preview Datasetを初期投入**.

The bootstrap:

1. reads the immutable legacy WordPress source from `data/legacy-table.html`;
2. applies the repository-managed curation layers;
3. inserts the normalized Hotel records into PostgreSQL;
4. lets the database create initial Revision records through the insert trigger;
5. inserts Field Verification records.

Bootstrap intentionally refuses to run when the Live DB already contains a Hotel. It is an initial migration operation, not a synchronization mechanism.

## 6. Editing and restore behavior

Live edits call `update_hotel_record()` rather than directly storing local browser state.

Before the Hotel row changes, the database trigger stores the previous state in `hotel_revisions`. The note entered in Live Admin is stored with that Revision.

Restore calls `restore_hotel_revision()`. Restore does not delete or rewrite history. The state that existed immediately before Restore becomes another Revision before the historical snapshot becomes current.

## 7. Validation

The `Stay Atlas Smoke` GitHub Actions workflow runs two independent checks:

- Chromium browser validation for the public UI, Local Admin and unconfigured Live Admin shell.
- PostgreSQL 16 validation for schema idempotency, RLS, direct update Revision capture, Live Admin RPC Revision notes and Restore behavior.

A real Supabase project remains required for final integration testing of Auth and PostgREST against Supabase infrastructure.
