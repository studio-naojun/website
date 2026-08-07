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
- Repository管理の公式確認Patch layer
- Field単位の `verified` / `conflicting` 表示
- Adminの「公式確認あり」Audit Queue
- JSON export
- PostgreSQL / Supabase向けSchema
- Browser smoke tests

## Data provenance

### 1. Legacy source

`data/legacy-table.html` は、Junが共有した旧WordPress表をMigration inputとして保存したものです。値は旧表由来であり、2026年時点の最新情報として再検証済みではありません。

公開画面とAdmin Previewは、ブラウザに現行datasetがまだ無い場合、この保存済みHTMLを自動で読み込み、全行を構造化します。`data/seed.js` は取得に失敗した場合のPreview fallbackです。

Importerは空欄や「いける？」「追加料金？」等を推測で補完せず、`needs_review` として保持します。英語ホテル名も推測生成せず、旧表に英語表記が明示されている場合だけ抽出します。それ以外は `English name pending` として残します。

### 2. Curated official verification

`data/verified-patches.js` は、公式Sourceで確認したFieldだけを旧表由来recordへ重ねる補正layerです。旧表自体は書き換えず、`verifications` にField名・status・Source・確認日・noteを残します。

現在のcuration versionは `2` です。確認batchは次の9件です。

- Waldorf Astoria Osaka
- Canopy by Hilton Okinawa Miyako Island Resort
- Waldorf Astoria Tokyo Nihonbashi
- Conrad Yokohama
- Conrad Nagoya
- Hilton Tokyo
- Hilton Tokyo Bay
- Hilton Osaka
- Conrad Tokyo

第2batchでは、Hilton Tokyo / Hilton Tokyo Bay / Hilton Osaka / Conrad Tokyoについて、公式Hiltonページから英語名・所在地・営業状態・ラウンジ・プール・駐車場等を確認しました。Hilton TokyoとHilton Osakaは添寝条件も公式Hotel Policyへ置き換えています。

Hilton Tokyo Bayについて公式ページで確認できた「6歳以上は大人として予約人数に含める」という条件は、添寝無料条件と同義ではないため、`families.booking_age` として別Fieldに保存し、旧表の添寝値をその情報だけで上書きしません。

旧表で `温泉: 〇` となっている一方、公式ページではSpa / bath / sauna / indoor pool等の記載しか確認できないケースは、温泉なしと断定せず `conflicting` として再確認対象にしています。

Source同士の状態が一致しない場合も、都合のよい値を選ばず `conflicting` として残します。Conrad Nagoyaは、公式Hiltonで2026-07-31以降の予約を受け付ける一方、検索一覧が `Coming Soon` 表示のため、営業開始状態を `needs_review` / `conflicting` として保持しています。

## 重要: Admin Previewの制約

現在の管理画面はGitHub Pagesで安全に試せるよう、変更とRevisionを `localStorage` に保存します。そのため管理変更は同じブラウザにだけ反映され、他の利用者やリポジトリの公開データは更新しません。

「旧表＋公式確認へ戻す」は、そのブラウザ内の編集・Revisionを削除して `data/legacy-table.html` からdatasetを再構築し、`data/verified-patches.js` を重ね直します。

本番v1として公開更新を可能にする場合は、次のどちらかへ移行します。

1. Supabase / PostgreSQL + Auth
2. Cloudflare Workers + D1 + Access/Auth

本番では、公開データ、Admin認証、Revision、Source verificationをServer-sideで管理します。クライアントにGitHub PAT等の長期Credentialを置かない方針です。

## Data model（v1）

Hotel recordは以下を基本単位とします。

- identity: `id`, `name_ja`, `name_en`, `chain`, `brand`, `portfolio`, `status`, `opening_note`, `official_url`
- location: `region`, `prefecture`, `city`
- child: `raw`, `allowed`, `rule_type`, `max_age`
- award: `raw`
- capacity: `raw`, `value`
- facilities: lounge / breakfast / onsen / pool / parking
- legacy source: `source.label`, `source.url`, `source.last_checked`
- official field verification: `verifications[field_path]`
- record quality: `verified`, `unverified`, `needs_review`, `missing`, `conflicting`

原文値は `raw` に保存し、構造化によって原文の意味を失わないようにします。

## Revision policy

編集時は変更前Hotel snapshotをRevisionとして保存します。Rollbackは履歴を書き換えず、選択した過去snapshotを現在値へ複製し、Rollback直前の値も新Revisionとして保存します。

公式確認PatchはRepository側のcuration layerとしてVersion管理します。ブラウザにlocal Revisionが存在する場合、未適用のcurationを自動で上書き適用しない方針です。

## Validation

`tests.html` のSmoke Testでは、旧表100件超のMigration、curation version、9件の公式確認Patch、Field-level verification / conflict、Revision / restore、曖昧値の保持を検証します。

Browserでのvisual/function validationはMerge前に別途必要です。

## 次段階

- Hilton系の公式確認batchを継続し、英語名・添寝・朝食・設備情報を更新
- 全ホテルの日本語正式名 / 英語正式名の確認
- 旧表の未確認・欠落項目の棚卸し
- Marriott / SLH等の公式Sourceによる現況再検証
- 本番DB / Authの選定と導入
- `stay.naojun.jp` への独立Deployment
- 月次Change Candidate検出（v1.1）
