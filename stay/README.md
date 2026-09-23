# NaoJun Stay Atlas v1

家族旅行向けホテル情報を、地図・検索・フィルタ・比較で閲覧できるStudio NaoJunのデータ作品です。

Public:

```text
https://naojun.jp/stay/
```

Live Admin:

```text
https://naojun.jp/stay/live-admin.html
```

## Production state

Last verified: 2026-08-07

Stay Atlas v1 is deployed on GitHub Pages and reads the production dataset from Supabase.

Current production snapshot:

- Hotels: **133**
- `open`: **130**
- `planned`: **3**
- `closed`: **0**
- `hidden`: **0**
- Field Verification rows: **123**

The public application exposes only `open` and `planned` Hotel rows. The current public count is therefore **133**.

These values are a dated production snapshot, not a permanent invariant. Future curation, opening/closure changes, or monthly refreshes may change the counts.

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
- PostgreSQL / Supabase production persistence
- Supabase Auth + `app_metadata` role based Live Admin
- RLSによる公開読取・Admin書込の分離
- 公開閲覧専用の匿名Supabase ClientとAdmin Sessionの分離
- 編集前Snapshotを残すRevision History
- Field単位の変更差分表示
- 過去Revisionを現在値として復元（復元前の現在値も新Revisionとして保存）
- WordPress旧テーブルHTML importer
- Jun提供の旧WordPress表を `data/legacy-table.html` として保存
- Repository管理の公式確認Patch layer
- Field単位の `verified` / `conflicting` 表示
- 公開画面の「公式確認あり / 公式Source競合あり」Filter
- Live Adminでの検索・編集・Revision・Restore
- 初期Preview Datasetの一回限りのSupabase bootstrap
- JSON export / Local Admin Preview
- Browser smoke tests
- PostgreSQL schema / RLS / Revision / Restore tests

## Data provenance

### 1. Legacy source

`data/legacy-table.html` は、Junが共有した旧WordPress表をMigration inputとして保存したものです。値は旧表由来であり、2026年時点の最新情報として全件再検証済みではありません。

Repository内のImporterは、この保存済みHTMLを構造化し、Preview Datasetおよび初期production migrationの基礎データを作ります。`data/seed.js` はLegacy HTML取得に失敗した場合のPreview fallbackです。

Importerは空欄や「いける？」「追加料金？」等を推測で補完せず、`needs_review` として保持します。英語ホテル名も推測生成せず、旧表に英語表記が明示されている場合だけ抽出します。それ以外は `English name pending` として残します。

### 2. Curated official verification

公式Sourceで確認したFieldだけを旧表由来recordへ重ねる補正layerです。旧表自体は書き換えず、`verifications` にField名・status・Source・確認日・noteを残します。

現在のRepository curation versionは `5`、確認対象は21件です。

Hilton batches:

- Waldorf Astoria Osaka
- Canopy by Hilton Okinawa Miyako Island Resort
- Waldorf Astoria Tokyo Nihonbashi
- Conrad Yokohama
- Conrad Nagoya
- Hilton Tokyo
- Hilton Tokyo Bay
- Hilton Osaka
- Conrad Tokyo
- Hilton Tokyo Odaiba
- DoubleTree by Hilton Tokyo Ariake
- Hilton Odawara Resort & Spa
- Hilton Nagoya

Marriott batch 1:

- The Westin Yokohama
- Sheraton Grande Tokyo Bay Hotel
- Fuji Marriott Hotel Lake Yamanaka
- Courtyard by Marriott Hakuba

Marriott batch 2:

- The Westin Tokyo
- Yokohama Bay Sheraton Hotel & Towers
- Tokyo Marriott Hotel
- Osaka Marriott Miyako Hotel

Marriott batchesでは、公式Marriott property pageから英語名・所在地・営業状態を確認し、公式Sourceが支える範囲でClub / Executive Lounge、Pool、Hot Spring、ParkingをField単位で補正しています。

The Westin YokohamaではClub Lounge、室内プールと子どもの利用時間・料金、駐車料金を確認しています。Sheraton Grande Tokyo Bay Hotelでは室内 / 屋外プールと駐車料金を確認しました。Fuji Marriott Hotel Lake YamanakaとCourtyard by Marriott Hakubaでは、公式ページがHot Springを明示しているため温泉Fieldを`verified`として扱っています。

The Westin TokyoではWestin Clubと12歳以下のCocktail Time制限、駐車情報を確認しています。Yokohama Bay Sheraton Hotel & TowersではSheraton Club Lounge、室内プール、駐車料金を確認。Tokyo Marriott HotelではExecutive Loungeと駐車料金、Osaka Marriott Miyako HotelではClub Lounge、小学生以下の17:30までの利用条件、駐車料金を確認しました。

「予約上の子ども区分」と「無料添寝条件」は同義とみなしません。公式Sourceが添寝条件を直接支えない場合、旧表の添寝値を別の年齢情報だけで上書きしません。

旧表で `温泉: 〇` でも、公式ページでSpa / bath / sauna / whirlpool等しか確認できない場合は `温泉なし` と断定せず `conflicting` として残します。一方、公式SourceがHot Springを明示する場合は `verified` として扱います。

Source同士の状態が一致しない場合も、都合のよい値を選びません。Conrad Nagoyaは営業開始状態、Hilton Nagoyaは旧表の添寝上限と現行Family Policyの整合に確認余地があるため `needs_review` / `conflicting` を保持します。

## Public / Admin architecture

### Public application

`/stay/` はSupabaseの公開読取を使用します。

- 公開ClientはAuth Sessionを保持しない匿名Clientです。
- `hotels` はRLSにより `open` / `planned` のみ公開されます。
- `field_verifications` も公開可能なHotelに紐づく行だけ読取可能です。
- Live DBが一時的に利用できない場合の安全なBundled Dataset fallbackは残しています。

### Live Admin

`/stay/live-admin.html` はSupabase Auth Sessionを使用します。

Authenticationだけでは書込権限になりません。AdminはJWTのtrusted `app_metadata.stay_atlas_role = "admin"` とDatabase RLS / RPC checkの双方で制御します。

Productionでは実際に、Admin login、Hotel edit、`edit` Revision生成、過去RevisionからのRestore、Restore前状態の新Revision保存まで確認済みです。

### Local Admin Preview

`/stay/admin.html` は開発・Preview用途です。Local Adminの編集とRevisionは `localStorage` に保存され、production Supabaseの値は変更しません。

## Data model（v1）

Hotel recordは以下を基本単位とします。

- identity: `id`, `name_ja`, `name_en`, `chain`, `brand`, `portfolio`, `status`, `opening_note`, `official_url`
- location: `region`, `prefecture`, `city`
- child: `raw`, `allowed`, `rule_type`, `max_age`
- award: `raw`
- capacity: `raw`, `value`
- facilities: lounge / breakfast / onsen / pool / parking
- family verification extras: `verifications['families.booking_age']` など
- legacy source: `source.label`, `source.url`, `source.last_checked`
- official field verification: `verifications[field_path]`
- record quality: `verified`, `unverified`, `needs_review`, `missing`, `conflicting`

原文値は `raw` に保存し、構造化によって原文の意味を失わないようにします。

## Revision policy

ProductionのHotel編集では、変更前Hotel snapshotをPostgreSQL Triggerで`hotel_revisions`へ保存します。

Restoreは履歴を書き換えません。選択した過去snapshotを現在値へ複製する直前に、Restore前の現在値を新しい`restore` Revisionとして保存します。

Repository側の公式確認Patchは、初期migration / Preview再構築用のcuration layerとしてVersion管理します。Production更新はDatabaseのRevision履歴を保ったまま行います。

## Validation

`Stay Atlas Smoke` は以下をCIで検証します。

- Browser: legacy migration、curation、public filters、Local Admin、adapter mapping、Live Admin unconfigured path
- PostgreSQL 16: schema idempotency、RLS、Revision capture、Live Admin RPC note、Restore behavior

Production integrationでは、CIとは別に実環境で以下を確認済みです。

- Live AdminのAdmin login
- 一回限りの初期bootstrap
- Edit → Revision
- Restore → Restore前状態のRevision保存
- Public browserからSupabase Data APIへの接続
- Public countとproduction SQL countの一致（133件）

厳格なSecurity acceptanceとして、通常のauthenticated non-admin userによる書込拒否と、`hidden` rowの公開不可は別途明示的なproduction testを行う余地があります。Schema / CIではRLS policyを検証していますが、実production accountを使った手動acceptanceとは区別します。

## 次段階

- Marriott系の公式確認batchを継続し、家族利用に重要な施設・ポリシーを更新
- Hilton系の未確認ホテルを継続確認
- 全ホテルの日本語正式名 / 英語正式名の確認
- 旧表の未確認・欠落項目の棚卸し
- SLH等の公式Sourceによる現況再検証
- 月次Change Candidate検出とreview workflow（v1.1）
- `stay.naojun.jp` への独立Deployment検討
- strict production security acceptance（non-admin write拒否 / hidden公開拒否）の明示的確認
