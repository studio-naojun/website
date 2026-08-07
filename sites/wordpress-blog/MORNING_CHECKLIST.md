# u2memo Migration Checkpoint

Last updated: 2026-08-08

## Resolved

- WXR/XML received and privately validated.
- Target URL fixed: `https://pocca.net/u2memo/`.
- Legacy `/u2memo/...` path preservation selected.
- Private Archive target fixed: existing Naojun / Stay Atlas Supabase Project.
- Logical isolation fixed:
  - `public.u2memo_legacy_comments`
  - `public.u2memo_migration_runs`
  - `app_metadata.u2memo_archive_role = "admin"`
- Real WXR is not committed to the public repository.
- Public comments remain disabled; legacy comments are Admin-only.

## Remaining publication decisions / external actions

1. **Public generated article files in Git history**
   - Decide whether the generated static articles may be committed to the public `studio-naojun/website` repository, or must be deployed through another publication path.
   - Until decided, `public.realContentCommitted=false` remains the safe state.

2. **Production Supabase execution**
   - Apply the prepared schema to the existing Project.
   - Assign `u2memo_archive_role=admin` only to the intended administrator.
   - Import the private archive from a trusted Admin/server-side path and run DB verification.

3. **Media publication**
   - Download/reconcile non-tracking legacy images and rewrite article image references to controlled static media paths.

4. **Cutover approval**
   - After a fresh final WXR is reconciled, approve production deployment/cutover and the eventual WordPress retirement window.

Do not shut down WordPress or discard the final WXR/private migration evidence until production acceptance and rollback window completion.
