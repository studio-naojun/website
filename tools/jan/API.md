# JANコード在庫検索 API contract

`tools/jan/` のフロントエンドが利用する価格・在庫検索APIの最小契約です。

## Endpoint

```text
GET <API_ENDPOINT>?jan=<GTIN-8 or GTIN-13>
Accept: application/json
```

`tools/jan/index.html` の `<html data-jan-api="...">` に公開APIのURLを設定します。

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
      "note": "任意の補足"
    }
  ]
}
```

## Field rules

- `jan`: 検索対象のJANコード。
- `product.name`: 商品名。取得できない場合は省略可。
- `results`: 販売店ごとの結果配列。
- `store`: 表示用販売店名。
- `price`: 税込販売価格。数値で返す。
- `shipping`: 送料。取得できる場合のみ数値で返す。
- `stock`: `in_stock` / `low_stock` / `out_of_stock` / `unknown` のいずれか。
- `url`: ユーザーが販売店で商品を確認できるURL。
- `checkedAt`: 情報を確認した日時。ISO 8601推奨。
- `note`: ポイント条件、店頭在庫のみ等、価格だけでは誤解を生む場合の補足。

## Frontend behavior

- `out_of_stock` は画面に表示しない。
- 初期表示は販売価格の安い順。
- 送料は価格とは分離して表示し、勝手に合算しない。
- 在庫や価格を取得できない販売店を、取得済みであるかのように表示しない。

## Backend requirements

- 量販店ごとの公式APIが存在する場合はAPIを優先する。
- HTML取得を行う場合は、各サイトの利用規約・robots・レート制限・表示条件を確認してから実装する。
- provider単位で失敗を分離し、1店舗の失敗で検索全体を500にしない。
- レスポンスには取得時刻を保持し、古いキャッシュを在庫確定情報として扱わない。
- API keyやsecretはフロントエンドへ置かない。
