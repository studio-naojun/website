# NaoJun JAN Search Worker

`naojun.jp/tools/jan/` 用の軽量検索backendです。

## 方針

- Cloudflare Workers Free planで運用する。
- 有料の商品検索APIは使わない。
- 初期providerはYahoo!ショッピングと楽天市場の公式APIのみ。
- retailer HTML scrapingは行わない。
- provider単位で失敗を分離し、片方が落ちても検索全体は可能な限り返す。
- 5分間のCache APIを使い、同一JANの短時間連続検索を外部providerへ繰り返さない。

## Required secrets

本番Workerでは次の3つを必須とします。

- `YAHOO_CLIENT_ID`
- `RAKUTEN_APPLICATION_ID`
- `RAKUTEN_ACCESS_KEY`

楽天Affiliateを利用する場合だけ `RAKUTEN_AFFILIATE_ID` を追加します。

secret値はrepositoryへcommitしません。`wrangler.toml` の `[secrets].required` で必須名だけを宣言し、欠けた状態のdeployを失敗させます。

## Recommended deploy: GitHub Actions

`.github/workflows/jan-search-deploy.yml` を手動実行する構成です。GitHub repository secretsへ次を登録します。

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `YAHOO_CLIENT_ID`
- `RAKUTEN_APPLICATION_ID`
- `RAKUTEN_ACCESS_KEY`
- `RAKUTEN_AFFILIATE_ID`（任意）

Workflowはrequired secretの存在を確認し、一時JSONファイルをrunner上だけに生成して `wrangler deploy --secrets-file` でcodeとsecretを同時deployします。処理後は一時secret fileを削除します。

Cloudflare API tokenはWorkersを編集できる最小権限で作成します。

## Local deploy

ローカルから行う場合は `worker/jan-search/` で実行します。

```bash
npx wrangler secret put YAHOO_CLIENT_ID
npx wrangler secret put RAKUTEN_APPLICATION_ID
npx wrangler secret put RAKUTEN_ACCESS_KEY
npx wrangler deploy
```

## Public endpoint

発行されたWorker URLが例えば

```text
https://naojun-jan-search.<account>.workers.dev
```

の場合、`tools/jan/index.html` の `data-jan-api` を次へ設定します。

```text
https://naojun-jan-search.<account>.workers.dev/search
```

URL確定前は `data-jan-api` を空のまま保持し、フロントを本番公開しません。

## Endpoint

```text
GET /search?jan=<JAN-8 or JAN-13>
```

成功時は `tools/jan/API.md` の共通形式を返します。

## Provider mapping

### Yahoo!ショッピング

公式 商品検索(v3) を `jan_code` で検索します。

- `hits.name` -> product.name
- `hits.seller.name` -> store
- `hits.price` -> price
- `hits.inStock` -> stock
- `hits.url` -> url

検索時点で新品・在庫ありに絞り、最大50件を価格昇順で取得します。

### 楽天市場

公式 楽天プロダクト製品検索APIを `productCode` (JAN) で検索します。

- `productName` -> product.name
- `usedExcludeSalesMinPrice` / `salesMinPrice` -> price
- `usedExcludeSalesItemCount` / `salesItemCount` -> stock判断
- `affiliateUrl` / `productUrlPC` / `searchUrl` -> url

楽天側は店舗1件ごとの価格一覧ではなく、楽天市場全体の「購入可能商品の最低価格」を1結果として表示します。

## CI

`.github/workflows/jan-search-smoke.yml` で次を確認します。

- frontend / Worker JavaScriptのsyntax
- Wrangler `deploy --dry-run`
- JAN入力validation
- API未接続時の安全な表示
- scanner dialogのopen / close

実provider responseとスマートフォンcameraはcredential/deploy後に別途実機確認します。

## Free-plan guardrails

- Worker側にDB/KVは必須としない。
- Cache APIのみを利用する。
- 1検索あたり外部providerへのrequestは最大2本。
- timeoutはproviderごとに4.5秒。
- API keysはsecretに保存する。
- CORSは `https://naojun.jp` のみに許可する。
- 有料サービスへの自動移行は行わない。

無料枠が実運用上の制約になった場合は、課金へ自動移行せず設計を再検討します。
