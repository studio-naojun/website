# NAOJUN Markets — X OAuth 2.0 PKCE runbook

**Status (2026-10-31 JST):** OAuth 2.0 user-context authorization succeeded for `@naojun_markets`. A read-only `GET /2/users/me` returned HTTP 200, and a separate read-only test using the Windows-encrypted stored token also returned HTTP 200. No X post has been made by this workflow.

## Authentication

- App: **NAOJUN Markets Publisher**, App ID `33593079`, Pay Per Use.
- OAuth 2.0 public/native client; redirect `http://localhost:8080/callback` registered alongside the pre-existing site URL.
- Minimum scopes: `tweet.read tweet.write users.read offline.access`. No DM permissions requested.
- The Windows local helper keeps access/refresh tokens in `%LOCALAPPDATA%\NAOJUN-Markets\oauth2.tokens.dpapi`, encrypted using Windows DPAPI for the current user. Never copy the plaintext tokens into source files, pull requests, CI logs, or chat messages.
- OAuth 1.0a GitHub Secrets and the older manual test workflow are legacy. Their earlier HTTP 401 failures are **not** evidence that the new OAuth 2.0 grant failed.

## OAuth 2.0 publisher code

`scripts/x_markets_oauth2_post.mjs` is the reusable, credential-storage-agnostic publisher. It accepts an access token **at runtime** (not in source code). It supports three explicit modes:

| Mode | Behavior |
| --- | --- |
| `dry-run` | Preview a clearly labeled test post without calling X (default). |
| `verify-only` | Call `GET /2/users/me` and require exactly `@naojun_markets`; no post. |
| `publish-test` | Verify account, check recent posts for an exact duplicate, then send **at most one** labeled test via `POST /2/tweets`. No automatic retry after an uncertain POST result. |

The existing GitHub workflow runs the OAuth 2.0 regression tests, but **does not have a GitHub-hosted OAuth 2.0 refresh-token mechanism**. A GitHub Actions dry-run success is not proof of API credentials. Do not enable scheduled publishing in GitHub Actions until safe rotating-refresh-token storage is implemented.

## Remaining before live recurring market updates

1. Wire the Windows DPAPI token provider/refresh mechanism to the publisher and verify it without posting.
2. Explicitly authorize the first real labeled test post and confirm its permalink.
3. Define the schedule and source-approved market facts (data redistribution rights are not yet verified).
4. Configure a monthly spending limit; the dashboard previously showed an unlimited cycle limit while automatic recharge was off.

Do not automatically schedule market-data posts merely because the API credentials now work.
