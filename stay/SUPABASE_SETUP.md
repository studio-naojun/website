# Stay Atlas Supabase Setup

Last updated: 2026-08-07

This document is the production-persistence runbook and current-state record for Stay Atlas v1 Live Admin.

## Current state

Stay Atlas v1 is deployed and connected to the production Supabase project.

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
- Stay Atlas v1 is merged to `main` and deployed through GitHub Pages.
- Real production login through `/stay/live-admin.html` has been exercised.
- The one-time initial Hotel bootstrap has been completed.
- Production Admin edit → Revision behavior has been exercised successfully.
- Production Restore → pre-Restore Revision preservation has been exercised successfully.
- Public browser access to the Supabase Data API has been confirmed.
- Public browsing is isolated from the persisted Live Admin Auth Session by a dedicated anonymous Supabase Client.
- Current production counts were confirmed directly in SQL and match the public application.

Current production snapshot, confirmed 2026-08-07:

```text
hotels_total   133
open           130
planned          3
closed           0
hidden           0
verifications  123
```

The public application should therefore expose **133 Hotels** at this snapshot because public Hotel read policy permits `open` and `planned` rows.

These counts are a dated observation, not a permanent invariant.

Remaining explicit production acceptance checks:

- A real authenticated non-admin account has not yet been used to prove write rejection end-to-end in production.
- A real `hidden` Hotel row has not yet been used to prove public exclusion end-to-end in production.
- The bootstrap's second-run refusal exists in code and is covered by its guard, but a deliberate second production attempt has not been performed because the initial bootstrap is already complete.

Do not confuse CI coverage with these optional stricter production acceptance checks.

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

### Public and Admin Client separation

The Supabase adapter maintains two browser clients:

- authenticated Client: used by Live Admin, with persisted Auth Session;
- anonymous Public Client: used by `/stay/`, without persisted Session or token refresh.

Public reads must not change because an administrator happens to be logged in on the same origin.

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

The standalone callback is deployed at:

```text
https://naojun.jp/stay/auth/accept-invite.html
```

Supabase Dashboard:

`Authentication > URL Configuration`

Intended production configuration:

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

## 5. Live Admin production states

Open:

```text
https://naojun.jp/stay/live-admin.html
```

Expected states:

- configured but signed out: `AUTH REQUIRED`
- authenticated without Stay Atlas role: `NOT ADMIN`
- authenticated administrator: `LIVE DB`

Production administrator login and `LIVE DB` state have been confirmed.

A non-admin authenticated user must not gain write access even if the browser UI is modified. RLS is the final authorization boundary. The policy is covered by schema/CI; a dedicated real non-admin production account test remains optional strict acceptance work.

## 6. Initial data bootstrap

The production bootstrap has already been completed. **Do not run it again.**

The bootstrap:

1. reads immutable migration input from `data/legacy-table.html`;
2. applies repository-managed curation layers;
3. normalizes the Hotel records;
4. inserts them into PostgreSQL;
5. lets the insert Trigger create initial Revision rows;
6. inserts repository Field Verification records.

Bootstrap deliberately refuses to run if any Hotel already exists in the Live DB. There is no force path. It is an initial migration operation, not the monthly synchronization mechanism.

The authoritative current database snapshot after production setup is:

```text
Hotels              133
Field Verifications 123
```

Do not infer that all 133 Hotels are fully verified. Field Verification rows are per-field evidence records and many Hotel fields remain `unverified`, `needs_review`, or `conflicting`.

## 7. Editing and restore behavior

Live edits call `update_hotel_record()`.

Before a Hotel row changes, the database Trigger stores the previous state in `hotel_revisions`. The Live Admin edit note is saved with that Revision.

Restore calls `restore_hotel_revision()`.

Restore never deletes or rewrites history. The state immediately before Restore is recorded as a new `restore` Revision, then the historical snapshot becomes current.

Production integration test completed on 2026-08-07:

- an Admin-edited Hotel saved successfully;
- the pre-edit state appeared in Revision History;
- Restore succeeded;
- the pre-Restore state was preserved as another Revision;
- the Hotel returned to the original state.

## 8. Public read path

The public application is:

```text
https://naojun.jp/stay/
```

Public Hotel reads use a dedicated anonymous Supabase Client and query `hotels` with the public status set (`open`, `planned`). Database RLS independently enforces the same public visibility boundary.

Public Field Verification reads are also constrained by RLS to rows associated with publicly visible Hotels.

If the live service is temporarily unavailable, the public bridge may fall back to the bundled migration dataset so the page remains usable. This fallback is not the production Source of Truth.

For troubleshooting, `/stay/?debug=1` can expose the public bridge's non-secret diagnostic state in-page. Do not add Secret keys, passwords, Session tokens, or private record contents to diagnostics.

## 9. CI validation

`Stay Atlas Smoke` has two jobs:

- `browser-smoke`: Chromium validation of legacy migration, curation, public filters, Local Admin, adapter mapping, and the Live Admin unconfigured path.
- `database-schema`: PostgreSQL 16 validation of schema idempotency, RLS, direct Revision capture, Live Admin RPC notes, and Restore behavior.

Although `stay/supabase-config.js` contains the production public configuration, `ci-smoke.mjs` injects a disabled `STAY_ATLAS_SUPABASE_CONFIG` before browser scripts execute. This keeps PR CI deterministic and prevents tests from reading or mutating the production Supabase project.

The standalone invite callback has a separate `Stay Atlas Auth Smoke` workflow on `main`.

## 10. Production integration status

Confirmed in production:

1. `/stay/live-admin.html` reaches the Auth-gated Live Admin path.
2. Administrator sign-in reaches `LIVE DB`.
3. Initial bootstrap completed once.
4. Edit creates an `edit` Revision.
5. Restore preserves the pre-Restore state as a new Revision.
6. Public `/stay/` reads Supabase data successfully.
7. Public count matches direct production SQL: 133 Hotels (`open=130`, `planned=3`).
8. Public Data API can read the expected Field Verification set: 123 rows at the recorded snapshot.
9. Public reads are isolated from the administrator's persisted Auth Session.

Not explicitly exercised with dedicated production fixtures/accounts:

1. authenticated non-admin write rejection;
2. second bootstrap attempt refusal;
3. `hidden` Hotel public exclusion.

These remaining items are useful for strict security acceptance, but they do not change the confirmed current public count of 133.
