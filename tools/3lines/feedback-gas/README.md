# 3行フィードバック endpoint

このフォルダの `Code.gs` は、Google Sheets に匿名の Good / Bad 集計を追記するための任意 endpoint です。初期状態では公開 Web App URL を設定していないため、要約機能はローカルだけで動作し、フィードバックは `unavailable` として扱われます。

## データ境界

受け付ける列は次の10列だけです。

`schema_version`, `server_timestamp`, `event_id`, `rating`, `style`, `bad_reason`, `app_version`, `engine`, `model_id`, `latency_bucket`

原文、生成3行、ユーザー入力、アカウント識別子は受け付けず、未知のフィールドは無視します。1日5,000件を上限にし、超過分は保存しません。

## 配備時

1. Google Sheet に Apps Script を紐付け、`Code.gs` を配置する。
2. Web App としてデプロイし、必要な実行ユーザー・公開範囲を Jun が確認する。
3. 得られた URL を、公開 app の設定値 `window.THREELINES_CONFIG = { feedbackEndpoint: '...' }` として明示的に設定する。

URLは秘密ではありませんが、新しい credential や API key は不要です。配備しない場合も本体生成には影響しません。
