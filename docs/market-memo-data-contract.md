# NAOJUN Market Memo — Data and release contract (2026-10-31)

## Public features

- Canonical: `https://naojun.jp/investment/markets/`.
- S&P 500, Nasdaq-100, Dow 30 and BTC/USD have separate sampling/time conventions. The static no-data state is intentional; no invented prices or false real-time promises.
- Official TradingView charts load only on visitor click and carry attribution; TradingView widgets are **not** a market-data source for scraping, copying, X text/images or public JSON.
- Static links to the latest published investment reports work without JavaScript; with JavaScript, the existing `investment/feed.json` keeps links current.
- This page does not create new investment feed entries or change weekly/monthly articles and `investment/state.json`.

## License gate

`investment/markets/history.json` is initially `unavailable`, and `history.mjs` has an empty `APPROVED_HISTORY_LICENSES` registry. Neither a JSON source claim nor a working TradingView embed grants redisplay or retention rights. Before enabling the independent charts, record provider-specific rights for each exact instrument, public history/quotes, derived series, chart, browser-accessible arrays, attribution, historical retention, correction/withdrawal policy and end-of-contract handling. Add approved provider IDs and exact HTTPS origins only following confirmation. The public feed must not contain credentials or private source data.

US equity indexes refer to official close by session. BTC history uses **06:30 JST** spot observation calendar dates (21:30 UTC on previous day), not US closing time. The three-index comparison uses only shared US trading dates and a shared first-date baseline of 100. No CFD proxy, Bitcoin perpetual, artificial interpolation or mixing rate returns with price returns.

## X option A — selected, not activated

Jun selected the **X official API + existing GitHub Actions** route. This page does not connect an X account, purchase API credits, set up a new scheduler, post to X or pin a post. Activation still requires the verified official account, authenticated developer app, spending cap and data rights explicitly covering X numbers and images. Use daily identity `account + JST date + post-kind` and verify uncertain sends before any retry. Existing Bluesky automations are not the X publisher. Keep the normal operational report in Commander NINA/Operations Portal.

## Release acceptance

Run focused Market Memo tests, existing investment smoke, Studio sync/discovery checks, required PR CI, same-commit Pages, and independent live status/body/mobile and linked published articles. Green tests are not proof of successful deployment or new visitors.
