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

## Windows local execution (verified)

The approved OAuth 2.0 runtime is installed on the user's authorized Windows machine:

- Encrypted token store (Windows user DPAPI): `%LOCALAPPDATA%\NAOJUN-Markets\oauth2.tokens.dpapi`
- Local command entrypoint: `%LOCALAPPDATA%\NAOJUN-Markets\oauth2_runner.mjs`
- Pinned repository checkout: `Z:\AI\Runtime\NAOJUN-Markets\website`
- Audited checkout revision: `feb73d9c9c7cad4fbf9956f9b89689b6e2c8cfea`; the local runner refuses to execute if the checkout changes without repinning.
- Verified 2026-10-31: all 10 OAuth2 unit tests passed; local `dry-run` and live read-only `verify-only` passed, including `GET /2/users/me` account validation.

Example PowerShell commands:

```powershell
node "$env:LOCALAPPDATA\NAOJUN-Markets\oauth2_runner.mjs" dry-run
node "$env:LOCALAPPDATA\NAOJUN-Markets\oauth2_runner.mjs" verify-only
```

The runner can also accept `publish-test` for a **real public post**, but this has **not** been executed. Do not schedule or invoke that mode without explicit publishing authorization. No credentials are printed or committed.

## Remaining before live recurring market updates

1. Authorize a first real, clearly labeled public test post and confirm its permalink.
2. Agree on the recurring content source, posting cadence, and redistribution/licensing rights for market data.
3. Configure a spending ceiling before recurring operation. The dashboard had a $10 total balance with $5 promotional credit and auto-recharge off, but the billing-cycle limit was unlimited.
4. Decide whether real publishing should stay on the Windows DPAPI runtime or use a separate hosted refresh-token store. GitHub Actions currently has **no** safe OAuth2 refresh-token rotation; manual dry-run CI remains active.

The X OAuth2 user grant is scoped to `tweet.read tweet.write users.read offline.access` and does not grant DM access. Do not re-enter the legacy OAuth1 keys to continue OAuth2 testing.
