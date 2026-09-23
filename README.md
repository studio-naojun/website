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
- `investment/state.json`: 最新の公開済み月次市場状態
- `investment/PUBLISHER.md`: K.A.N.A.D.E. Static Publisher契約
- `investment/_templates/`: 記事テンプレート
- `investment/smoke.mjs`: 公開物の整合性チェック

週次・月次の投資レポートはいずれも、K.A.N.A.D.E.の編集・公開前チェック完了後、Static PublisherがWebsite PRを作成し、required CIと差分・provenance確認が成功すれば自動で`main`へmergeします。GitHub Pagesの公開成功を確認した後、Junへlive公開URLを送り、Junは公開ページを確認して必要なら修正を指示します。

通常の投資レポート公開では記事ごとのJun事前承認を要求しません。hard blockerがある場合だけ公開を停止します。
