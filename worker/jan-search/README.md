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

Cloudflare Workerへ次のsecretを設定します。

```bash
npx wrangler secret put YAHOO_CLIENT_ID
npx wrangler secret put RAKUTEN_APPLICATION_ID
npx wrangler secret put RAKUTEN_ACCESS_KEY
```

楽天Affiliateを利用する場合だけ追加します。

```bash
npx wrangler secret put RAKUTEN_AFFILIATE_ID
```

secret値はrepositoryへcommitしません。

## Deploy

`worker/jan-search/` で実行します。

```bash
npx wrangler deploy
```

発行されたWorker URLが例えば

```text
https://naojun-jan-search.<account>.workers.dev
```

の場合、`tools/jan/index.html` の `data-jan-api` を次へ設定します。

```text
https://naojun-jan-search.<account>.workers.dev/search
```

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

### 楽天市場

公式 楽天プロダクト製品検索APIを `productCode` (JAN) で検索します。

- `productName` -> product.name
- `usedExcludeSalesMinPrice` / `salesMinPrice` -> price
- `usedExcludeSalesItemCount` / `salesItemCount` -> stock判断
- `affiliateUrl` / `productUrlPC` / `searchUrl` -> url

楽天側は店舗1件ごとの価格一覧ではなく、楽天市場全体の「購入可能商品の最低価格」を1結果として表示します。

## Free-plan guardrails

- Worker側にDB/KVは必須としない。
- Cache APIのみを利用する。
- 1検索あたり外部providerへのrequestは最大2本。
- timeoutはproviderごとに4.5秒。
- API keysはsecretに保存する。
- CORSは `https://naojun.jp` のみに許可する。

Cloudflareの無料枠を超えた場合に有料へ自動移行させるのではなく、free plan側の制限で失敗させる運用を前提とします。
