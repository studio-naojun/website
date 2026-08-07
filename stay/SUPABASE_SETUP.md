# Stay Atlas Supabase Setup

Last updated: 2026-08-07

This document is the production-persistence runbook for Stay Atlas v1 Live Admin.

## Current state

The Supabase project has been created and the server-side foundation is already configured.

Completed:

- Production Supabase Project exists.
- `stay/auth/accept-invite.html` is deployed on `naojun.jp`.
- Supabase Auth Site URL / Redirect URL points to the production invite callback.
- The administrator Auth user is confirmed, has a password, and has `app_metadata.stay_atlas_role = "admin"`.
- `stay/db/schema.sql` has been applied successfully.
- `stay/db/live-admin.sql` has been applied successfully.
- `hotels`, `hotel_revisions`, `field_verifications`, `change_candidates`, and `refresh_runs` all have RLS enabled.
- `restore_hotel_revision()` and `update_hotel_record()` exist in the production project.
- `stay/supabase-config.js` is configured with the Project URL and Publishable Key only.

Not completed yet:

- Stay Atlas v1 PR #2 has not been merged, so `/stay/live-admin.html` and the public `/stay/` application are not deployed from that PR yet.
- Real production login through `/stay/live-admin.html` has not been exercised.
- The one-time initial Hotel bootstrap has not been run.
- Real Supabase Auth/PostgREST edit / Revision / Restore behavior still needs post-deployment integration validation.

Do not treat CI success as proof of the final production integration. CI intentionally avoids depending on the live Supabase service.

## 1. Browser configuration

The browser application needs only:

- Project URL
- Publishable Key

These values live in `stay/supabase-config.js`.

```js
window.STAY_ATLAS_SUPABASE_CONFIG = window.STAY_ATLAS_SUPABASE_CONFIG || {
  enabled: true,
  url: 'https://PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_...'
};
```

The Publishable Key is intentionally a low-privilege browser credential. PostgreSQL RLS is the authorization boundary.

Never place any of the following in browser-delivered files, GitHub Pages, or client JavaScript:

- Database password
- `sb_secret_...`
- legacy `service_role`
- JWT signing secret

The config keeps an existing `window.STAY_ATLAS_SUPABASE_CONFIG` value when one is injected before page scripts. The browser smoke suite uses this to force an offline/unconfigured mode and avoid coupling PR CI to the production project.

## 2. Database SQL

Apply these files in this order:

1. `stay/db/schema.sql`
2. `stay/db/live-admin.sql`

Both scripts are designed to be reapplied during validation.

`schema.sql` creates:

- `hotels`
- `hotel_revisions`
- `field_verifications`
- `change_candidates`
- `refresh_runs`
- RLS policies
- automatic Revision triggers
- `restore_hotel_revision()`

`live-admin.sql` adds `update_hotel_record()`, allowing Live Admin to attach a change note while still using the normal Revision trigger.

Production verification completed on 2026-08-07:

- all five tables report `rowsecurity = true`;
- `restore_hotel_revision` exists;
- `update_hotel_record` exists.

## 3. Auth redirect URLs

The standalone callback is already deployed at:

```text
https://naojun.jp/stay/auth/accept-invite.html
```

Supabase Dashboard:

`Authentication > URL Configuration`

Current intended configuration:

```text
Site URL
https://naojun.jp/stay/auth/accept-invite.html

Redirect URLs
https://naojun.jp/stay/auth/accept-invite.html
https://naojun.jp/stay/live-admin.html
```

Do not restore `http://localhost:3000` as the production redirect.

The invite callback accepts an authenticated Supabase redirect, establishes the browser session, allows a password to be set, and signs the callback session out after completion.

If an invitation or recovery token is exposed, expired, or already consumed, do not reuse it.

## 4. Administrator authorization

Authentication alone does not grant Stay Atlas write access.

The administrator JWT must contain:

```json
{
  "app_metadata": {
    "stay_atlas_role": "admin"
  }
}
```

Do not use user-editable metadata for this authorization flag.

Client-side checks of `user.app_metadata.stay_atlas_role` are only for UX. Database RLS and the RPC admin checks remain authoritative.

After App Metadata changes, obtain a new Auth session so the JWT contains the current claim.

## 5. Live Admin post-deployment check

After Stay Atlas v1 is deployed, open:

```text
https://naojun.jp/stay/live-admin.html
```

Expected states:

- configured but signed out: `AUTH REQUIRED`
- authenticated without Stay Atlas role: `NOT ADMIN`
- authenticated administrator: `LIVE DB`

A non-admin authenticated user must not gain write access even if the browser UI is modified. RLS is the final authorization boundary.

## 6. Initial data bootstrap

If the production `hotels` table is empty, Live Admin exposes **Preview Datasetを初期投入**.

The bootstrap:

1. reads immutable migration input from `data/legacy-table.html`;
2. applies repository-managed curation layers;
3. normalizes the Hotel records;
4. inserts them into PostgreSQL;
5. lets the insert Trigger create initial Revision rows;
6. inserts repository Field Verification records.

Bootstrap deliberately refuses to run if any Hotel already exists in the Live DB. There is no force path. It is an initial migration operation, not the monthly synchronization mechanism.

Before clicking the bootstrap button, confirm the production `hotels` table is empty.

## 7. Editing and restore behavior

Live edits call `update_hotel_record()`.

Before a Hotel row changes, the database Trigger stores the previous state in `hotel_revisions`. The Live Admin edit note is saved with that Revision.

Restore calls `restore_hotel_revision()`.

Restore never deletes or rewrites history. The state immediately before Restore is recorded as a new `restore` Revision, then the historical snapshot becomes current.

## 8. CI validation

`Stay Atlas Smoke` has two jobs:

- `browser-smoke`: Chromium validation of legacy migration, curation, public filters, Local Admin, adapter mapping, and the Live Admin unconfigured path.
- `database-schema`: PostgreSQL 16 validation of schema idempotency, RLS, direct Revision capture, Live Admin RPC notes, and Restore behavior.

Although `stay/supabase-config.js` contains the production public configuration, `ci-smoke.mjs` injects a disabled `STAY_ATLAS_SUPABASE_CONFIG` before browser scripts execute. This keeps PR CI deterministic and prevents tests from reading or mutating the production Supabase project.

The standalone invite callback has a separate `Stay Atlas Auth Smoke` workflow on `main`.

## 9. Required production integration checks after deployment

Before declaring Live Admin complete:

1. Open `/stay/live-admin.html` and confirm `AUTH REQUIRED`.
2. Sign in with the administrator account and confirm `LIVE DB`.
3. Confirm a normal authenticated user without the role cannot write.
4. Confirm `hotels` is empty before the initial bootstrap.
5. Run the one-time bootstrap once.
6. Confirm the bootstrap refuses a second run.
7. Edit one Hotel with a clear test note and confirm an `edit` Revision is created.
8. Restore an earlier Revision and confirm a new `restore` Revision preserves the pre-restore state.
9. Confirm the public `/stay/` page reads open/planned rows from Supabase.
10. Confirm hidden rows do not appear publicly.
11. Confirm Field Verification records are visible where expected.

Only after these checks should the production Supabase integration be treated as complete.
