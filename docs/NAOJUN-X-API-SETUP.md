# NAOJUN Markets — Official X API manual test setup (2026-10-31)

Account: https://x.com/naojun_markets

## Scope
- A manual GitHub Actions workflow allows only dry-run or a single labeled X API test post. It has no recurring schedule, no market prices, no automated browser posting and no changes to Bluesky.
- A dry-run requires no credentials and contacts no X API endpoint.
- A live test verifies that OAuth 1.0a tokens belong to the exact @naojun_markets account, checks the latest 20 own posts for an identical same-day test, and uses one official POST /2/tweets request.
- Authentication/read failures stop before posting. If a POST times out or returns an ambiguous result, inspect X manually before retrying. A large number of intervening posts could defeat the latest-20 duplicate check, so never blindly rerun.
- The workflow does not connect the daily market reports to X. Those require separately confirmed redistribution rights for each data source and for text/images shared on X.

## Owner action once — Developer Console
1. While signed into @naojun_markets, open https://console.x.com/.
2. Complete Developer onboarding. Review and personally accept the X Developer Agreement and policy. The assistant has not accepted any legal agreements.
3. Create the app NAOJUN Markets Publisher with Read and Write permission and OAuth 1.0a User Context. Generate API Key, API Key Secret, Access Token and Access Token Secret for the SAME @naojun_markets account. If you change write permissions, regenerate tokens as needed.
4. Verify credit balance and set a conservative spending cap yourself. Published 2026-10-31 pricing: text-only Post Create $0.015, Post Create with URL $0.200; identity verification and own-timeline reads may be billed separately. Charges may change.

## Repository configuration
In studio-naojun/website, visit Settings / Secrets and variables / Actions and add four repository secrets:

- NAOJUN_X_API_KEY
- NAOJUN_X_API_SECRET
- NAOJUN_X_ACCESS_TOKEN
- NAOJUN_X_ACCESS_TOKEN_SECRET

Never paste actual secret values into a chat, issue, workflow definition or public commit.

## Run
Open https://github.com/studio-naojun/website/actions/workflows/x-markets-api-test.yml and select Run workflow on main.

1. Run with mode dry-run. Verify green tests and a preview in the log. This sends nothing to X.
2. Run once with mode publish-test. On success, the log contains the public URL of the created post. Open it and confirm it was published from @naojun_markets.
3. Do not enable a daily schedule until market-data licensing and operations reporting have been implemented.

The ongoing NAOJUN Operations Portal remains the single dashboard. For the release contract see docs/market-memo-data-contract.md.

Official references:
- https://docs.x.com/x-api/posts/manage-tweets/quickstart
- https://docs.x.com/x-api/getting-started/getting-access
- https://docs.x.com/x-api/getting-started/pricing
- https://help.x.com/en/rules-and-policies/x-automation
