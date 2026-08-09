# Studio NaoJun website

GitHub Pages向けの静的サイトです。

## 構成

- `/` トップ
- `/about/` Studio紹介
- `/works/` 作品一覧
- `/works/sample-product/` 作品詳細テンプレート
- `/investment/` NaoJun Investment Observatory（AI-native static publishing）
- `/contact/` 問い合わせ

## Investment Observatory

投資コンテンツはCMSを使わず、静的HTML/CSS/JSとJSON registryで公開します。

- `investment/feed.json`: 公開記事一覧
- `investment/state.json`: 最新の承認済み月次市場状態
- `investment/PUBLISHER.md`: K.A.N.A.D.E. Static Publisher契約
- `investment/_templates/`: 記事テンプレート
- `investment/smoke.mjs`: 公開物の整合性チェック

記事公開はWebsiteへのPull Requestを作成し、Junが`main`へmergeすることで行います。
