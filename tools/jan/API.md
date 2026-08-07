# JANコード在庫検索 API contract

`tools/jan/` のフロントエンドが利用する価格・在庫検索APIの最小契約です。

現在のDraft実装では `worker/jan-search/` にCloudflare Workers向けbackendを用意しています。

## Endpoint

```text
GET <WORKER_ORIGIN>/search?jan=<GTIN-8 or GTIN-13>
Accept: application/json
```

`tools/jan/index.html` の `<html data-jan-api="...">` に公開Worker URLを設定します。

## Initial providers

### Yahoo!ショッピング

公式 商品検索(v3)を利用します。

- JAN指定: `jan_code`
- 新品のみ: `condition=new`
- 在庫ありのみ: `in_stock=true`
- 価格昇順: `sort=+price`
- 最大50件

店舗ごとの商品価格、在庫フラグ、商品URLを共通形式へ変換します。

### 楽天市場

公式 楽天プロダクト製品検索APIを利用します。

- JAN指定: `productCode`
- 購入可能な最低価格を取得
- 購入可能商品数から在庫有無を判断

楽天側は店舗単位の商品一覧ではなく、楽天市場全体の購入可能最低価格を1件として返します。

## Success response

```json
{
  "jan": "4901234567894",
  "product": {
    "name": "商品名"
  },
  "results": [
    {
      "store": "販売店名",
      "price": 12800,
      "shipping": 0,
      "stock": "in_stock",
      "url": "https://example.com/item/123",
      "checkedAt": "2026-08-07T21:00:00+09:00",
      "note": "任意の補足",
      "source": "yahoo"
    }
  ],
  "providers": [
    {
      "provider": "yahoo",
      "ok": true,
      "count": 5
    }
  ],
  "checkedAt": "2026-08-07T21:00:00+09:00"
}
```

## Field rules

- `jan`: 検索対象のJANコード。
- `product.name`: 商品名。取得できない場合は省略可。
- `results`: 販売店またはmarketplaceごとの結果配列。
- `store`: 表示用販売店名。
- `price`: 販売価格またはmarketplace内購入可能最低価格。
- `shipping`: 送料。取得できる場合のみ数値で返す。
- `stock`: `in_stock` / `low_stock` / `out_of_stock` / `unknown` のいずれか。
- `url`: ユーザーが販売先で商品を確認できるURL。
- `checkedAt`: 情報を確認した日時。
- `note`: 最低価格の意味、送料不明など価格だけでは誤解を生む場合の補足。
- `source`: provider識別子。

## Frontend behavior

- `out_of_stock` は画面に表示しない。
- 初期表示は販売価格の安い順。
- 送料は価格とは分離して表示し、勝手に合算しない。
- 在庫や価格を取得できないproviderを、取得済みであるかのように表示しない。

## Backend requirements

- 有料の商品検索APIは使わない。
- providerの公式APIを優先する。
- HTML scrapingは初期版では行わない。
- provider単位で失敗を分離し、1サービスの失敗で検索全体を500にしない。
- 同一JANの結果は5分間cacheする。
- API keyやsecretはフロントエンド・repositoryへ置かない。
- CORSは `https://naojun.jp` のみに許可する。
