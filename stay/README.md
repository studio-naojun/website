# NaoJun Stay Atlas v1

家族旅行向けホテル情報を、地図・検索・フィルタ・比較で閲覧できるStudio NaoJunのデータ作品です。

## v1で実装したもの

- クリック可能な日本地域マップ
- Table / Cards表示切替
- ホテル名・都道府県・ブランド検索
- チェーン / 都道府県 / 定員 / 設備 / 確認状態 / 営業状態フィルタ
- 12歳以上まで添寝可能なホテルの絞り込み
- 並び替え
- ホテル詳細Dialog
- 日本語名 / 英語名の分離
- Source / 最終確認日 / quality status
- Admin Preview
- 編集前Snapshotを残すRevision History
- Field単位の変更差分表示
- 過去Revisionを現在値として復元（復元前の現在値も新Revisionとして保存）
- WordPress旧テーブルHTML importer
- Jun提供の旧WordPress表を `data/legacy-table.html` として保存
- 初回アクセス時の旧表全件自動Migration
- JSON export
- PostgreSQL / Supabase向けSchema
- Browser smoke tests

## 初期データについて

`data/legacy-table.html` は、Junが共有した旧WordPress表をMigration inputとして保存したものです。値は旧表由来であり、2026年時点の最新情報として再検証済みではありません。

公開画面とAdmin Previewは、ブラウザに現行datasetがまだ無い場合、この保存済みHTMLを自動で読み込み、全行を構造化します。`data/seed.js` は取得に失敗した場合のPreview fallbackです。

Importerは空欄や「いける？」「追加料金？」等を推測で補完せず、`needs_review` として保持します。英語ホテル名も推測生成せず、旧表に英語表記が明示されている場合だけ抽出します。それ以外は `English name pending` として残します。

旧表に「開業予定」と記録されているホテルも、現時点で開業済みと推測して書き換えません。現在の公式状態は次工程でSource確認します。

## 重要: Admin Previewの制約

現在の管理画面はGitHub Pagesで安全に試せるよう、変更とRevisionを `localStorage` に保存します。そのため管理変更は同じブラウザにだけ反映され、他の利用者やリポジトリの公開データは更新しません。

「旧表から再読み込み」は、そのブラウザ内の編集・Revisionを削除して `data/legacy-table.html` からdatasetを再構築します。

本番v1として公開更新を可能にする場合は、次のどちらかへ移行します。

1. Supabase / PostgreSQL + Auth
2. Cloudflare Workers + D1 + Access/Auth

本番では、公開データ、Admin認証、Revision、Source verificationをServer-sideで管理します。クライアントにGitHub PAT等の長期Credentialを置かない方針です。

## Data model（v1）

Hotel recordは以下を基本単位とします。

- identity: `id`, `name_ja`, `name_en`, `chain`, `brand`, `portfolio`, `status`
- location: `region`, `prefecture`, `city`
- child: `raw`, `allowed`, `rule_type`, `max_age`
- award: `raw`
- capacity: `raw`, `value`
- facilities: lounge / breakfast / onsen / pool / parking
- source: `label`, `url`, `last_checked`
- quality: `verified`, `unverified`, `needs_review`, `missing`, `conflicting`

原文値は `raw` に保存し、構造化によって原文の意味を失わないようにします。

## Revision policy

編集時は変更前Hotel snapshotをRevisionとして保存します。Rollbackは履歴を書き換えず、選択した過去snapshotを現在値へ複製し、Rollback直前の値も新しいRevisionとして保存します。

## 次段階

- 全ホテルの日本語正式名 / 英語正式名の確認
- 旧表の未確認・欠落項目の棚卸し
- Hilton / Marriott等の公式Sourceによる現況再検証
- 本番DB / Authの選定と導入
- 項目単位Source / verification UI
- `stay.naojun.jp` への独立Deployment
- 月次Change Candidate検出（v1.1）
