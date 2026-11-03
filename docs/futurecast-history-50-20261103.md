# FUTURECAST HISTORY 50+ と Market Memo の自動チャート（2026-11-03）

**状態:** ワークツリー `_staging/naojun-futurecast-50-embedded-20261103`（起点 main `dd60558`）で実装・検証済み。**未push・未公開。** 本番の読み戻しは公開後に別途行う。

## 1. FUTURECAST: HISTORY 50+（封印なし・採点対象外の編集号）

### 何を変えたか
- 新しい編集元 `futurecast/high-conviction/forecasts.json`（5件）。生成は `tools/futurecast/history50.mjs`、`node tools/futurecast/fc.mjs build futurecast/data futurecast` で `futurecast/index.html` と新ページ `futurecast/high-conviction/index.html` を出力する。生成物だけを手で直さない。
- トップの第一画面を HISTORY 50+ に変更。番号付き5件の見出しに、確率・判定期限・一次資料リンクを表示。DATA DISAGREES の「採択0件」は**別の厳しい基準**として見出しの下に分けて表示し、封印済みの3件はその下に「封印済みの記録・アーカイブ」として残した。
- 詳細ページ `/futurecast/high-conviction/`：「なぜ50％超と言えるのか」、限界、各件のYES/NO定義・曖昧さと例外・判定資料、根拠の数字、反対の材料、世論との比較と確からしさ、推定を変える条件、未確認事項、一次資料。
- FUTURECAST全ページ共通のサブナビ（`fc.mjs` と `studio_chrome.py`）に「トップ / HISTORY 50+」を追加。DATA DISAGREES・ERA SHIFTS は既存のPython生成器で再生成。
- 方法論ページに「07 HISTORY 50+は、台帳とは別の編集号」、成績ページに「5件は採点しない」注記。
- 検証（`validateHistory50`）：`sealed:false`・`scored:false`・未校正を必須とし、確率は **51〜95の整数のみ**。50%以下になった項目は残せない（外す）。URLはHTTPSのみ、根拠・判定資料の参照番号、世論ステータスの種類も検査。

### 不変であることを確認したもの
`futurecast/data/`（台帳3件・receipts・index.json・scoreboard.json）、`era-shifts/scenarios.json`、`data-disagrees/candidates.json` は main `dd60558` とSHA-256で一致（`tools/futurecast/tests/history50.test.mjs` に固定値）。`verify-public --production --require-committed` と `check-append --base HEAD` も成功。過去の確率・受領・Brier採点は変更していない。

### 5件と根拠（as_of 2026-11-03、すべて主観的な編集推定）
| # | 出来事 / 期限 | 編集推定 | 出発点の数字 | 世論 |
|---|---|---|---|---|
| 01 | AI主導の発見がノーベル賞級と2団体以上に評価 / 2030年末 | 62% | Anthropic「AI expectations gap」(2026-10-16): 米国成人39%（2026年8月調査全体n=10,980）→44%（同年9月再調査全体n=7,613。2030年設問の回答数は全体とは異なる）、社員91%（n=1,334）。**回答者の割合で確率ではない** | **唯一の直接測定**：再調査でも米国成人56%が2030年までと考えていない（設問は「能力」で判定条件と差あり→確からしさ「中」） |
| 02 | AIがミレニアム懸賞問題を解決・実質支援 / 2040年末 | 58% | LEAP Wave 2: 2040年中央値 専門家60%・超予測者58%・一般50%（四分位30〜81%）。CMIは公表後2年以上＋一般的受容が審査条件→判定確定は2042年末まで延長 | 一般50%：過半数懐疑ではない |
| 03 | 米連邦・英中央・EUが新AIの公開前に安全理由で拘束的措置 / 2035年末 | 70% | LEAP: 専門家中央値2030年（75%点2034）、超予測者2030年（75%点2035）、一般2032年。**既公開モデルへの輸出管理（LEAPが2026-06-12の指示を不適格と明記）は数えない** | 一般も2035年までに起きる側が多数 |
| 04 | 再エネ＋原子力が世界発電の50%超 / 2032暦年（2033年末までの統計で判定） | 66% | IEA Electricity 2026: 2025年42%、2030年に約50%（予測）。IEA 2026年7月中間報告: 再エネ単独は2025年33%→2027年37%の見通し。ただし燃料価格高騰による石炭への転換・天候リスクを指摘 | 世論は未測定 |
| 05 | ロボットが人の物理的介入なしに生体の虫垂切除を完遂 / 2045年末 | 65% | LEAP: 専門家中央値2040年（75%点2046）、超予測者2035年、一般2039年 | 一般も2045年までに起きる側が多数 |

**注意事項**
- 5件の数字は名前を挙げた資料を出発点にした**主観的な編集推定**（NAOJUN STUDIOSのAI支援）。実現頻度の観測値でも、誤差を測った統計モデルの出力でもない。DATA DISAGREES の採択基準を満たしたとは主張しない。
- IEA Electricity 2026の一次ページは2026-11-03の自動取得で **HTTP 403**。42%→約50%の数字は Balkan Green Energy News（2026-02-09、2026-06-02更新）で照合した。さらに新しいIEA公式の2026年7月中間報告（https://www.iea.org/reports/electricity-mid-year-update-2026/executive-summary）を本文確認。再エネの上昇継続と、燃料価格ショック・石炭火力への転換・エルニーニョの下振れを合わせて検討しており、66%は校正された確率ではなく主観推定として維持した。
- 03の反対材料は、未検証の政治情勢の断定を避け「LEAPの問いが未解決＝前例なし」という資料上の事実に限定した。05の動物実験の個別論文は未検証として明記。
- 決定的な反証は見つからなかったため、5件とも外していない。

## 2. Market Memo: 開いた瞬間にTradingViewのチャートを表示

- 以前はクリックしないと外部通信しない設計だったが、所有者が2026-11-03に**自動埋め込みを明示承認**。`investment/markets/markets.js` は読み込み時にTradingView提供の**sandbox付き・別originのiframe**を生成し、S&P 500キーを選択した状態で **SPY（AMEX:SPY）** を表示する。NDX→QQQ（NASDAQ:QQQ）、DJI→DIA（AMEX:DIA）、BTC→BITSTAMP:BTCUSD を同じ枠で切り替える。外部Web ComponentのJavaScriptをNAOJUNのページ本体に実行させない。
- **ETFと指数の区別**：キー・VIEWING・枠上のラベル（黒い「ETF」タグ）・説明文で「連動ETFで指数そのものではない」と表示し、SP:SPX / NASDAQ:NDX / DJ:DJI の公式ページへのリンクを残した。指数シンボルは埋め込みへ送らない（テストで固定）。
- **追加の独立レビュー修正**：TradingViewのWeb Component moduleを親サイトのoriginで実行する構成をやめ、公式が案内するiframe形式と実際に描画成功した `tradingview-widget.com/embed-widget/advanced-chart/` の設定URLへ移行した。チャートのJavaScriptは別originのsandbox付きiframe内で動作し、NAOJUNのDOMへは直接実行権限を持たない。追加の外部script要素は作らない。320〜1440pxの6幅でSPYのiframe、provider canvas 7枚、JavaScript例外0、水平はみ出し0を実ブラウザで確認。390/1440でBTC/QQQ/DIAへの切替URLも確認し、1440ではSPYの実OHLCとローソク足を目視確認。
- 失敗時：iframeの `error` と15秒タイムアウトでエラー表示に切り替え、公式リンクへ誘導する。iframe自体の読み込み後に相場データだけが失敗する状態は親サイトから判定できないため、上部に「チャートを再読み込み」を常設し、ETFチャートそのものと指数の公式ページへの**別々の**リンクを常に表示する。iframeの `load` はローソク足が描画された証拠として扱わない。
- 提供元の断続的な不具合：TradingView側で銘柄が描画されない・「TradingView上でのみ利用可能」と表示される場合はサイトから検知できない（クロスオリジンiframe）。このため常時「表示されない場合は公式ページへ」と案内している。独自の価格履歴は従来どおり未接続（`history.json` は `unavailable`）。静的な価格は追加していない（テストで検査）。
- プライバシー：ページ内と `/privacy/#tradingview` に、TradingView公式FAQ（https://www.tradingview.com/widget-docs/faq/general/ ）の記載「Cookieを設定しない／IPアドレス・埋め込み先URL・ウィジェット種類・表示銘柄を受け取る／IPはDDoS対策のため短期間保持」を記載。実測で接続先は `widgets.tradingview-widget.com`、`www.tradingview-widget.com`、`widget-sheriff.tradingview-widget.com`、`www.tradingview.com`、`s3.tradingview.com`、`scanner-backend.tradingview.com`、`s3-symbol-logo.tradingview.com`。1回の実行では `snowplow-pixel.tradingview.com`（TradingViewの計測）も観測した。

## 3. デザインの扱い
ユーザー承認済みのStudio Editions（violet・mango・condensed数字・角の立った罫）の範囲内の機能追加として扱い、新しいアートディレクションは作っていない（DESIGN EVOLUTION の `targeted` 扱い）。インラインstyleはCSP `default-src 'self'` で遮断されるため、確率メーターはSVG属性で描画。ERA SHIFTSのフッター文字が320pxで56pxはみ出す既存の不具合（main時点から存在）を `.fc-static .footer-wordmark` の縮小で修正した。

## 4. 実行した検証（2026-11-03、ローカル）
| コマンド | 結果 |
|---|---|
| `node --test tools/futurecast/tests/*.test.mjs` | 100 pass / 0 fail（新規 `history50.test.mjs` 8件を含む） |
| `node --test investment/markets/markets.test.mjs` | 10 pass / 0 fail（同意ゲートの旧検査を初回自動表示の検査に置き換え。他の検査は維持） |
| `node investment/smoke.mjs` | pass |
| `python scripts/sync_studio.py --check` | 変更0 / 61ページ |
| `python scripts/design-integrity.py` | PASS 61ページ |
| `python scripts/build_discovery.py --check` | 変更0（sitemapに `/futurecast/high-conviction/` を追加済み） |
| `build_era_shifts.py --check` / `build_data_disagrees.py --check` / `monthly_evidence.py --check` / `test_data_disagrees.py` | pass |
| `fc.mjs verify-public futurecast/data --production --require-committed` | public chains valid |
| `fc.mjs check-append --base HEAD` | append-only valid |
| 再ビルドと `cmp`（CIと同じ一覧＋high-conviction） | すべて一致（冪等） |

**ブラウザ（Chromium 1234 / Playwright、ローカル配信）** — 証跡はリポジトリ外 `Z:/AI/Temp/Jobs/naojun-futurecast-50-embed-20261103/`
- `shots-final/`, `shots/`, `shots2/`：`/futurecast/`、`/futurecast/high-conviction/`、DATA DISAGREES、方法論、ERA SHIFTS、成績、Market Memo、Privacy を 320/390/430/768/1024/1440px で全ページ撮影。文書の横はみ出し0、h1は各1、JSエラー0（`/favicon.ico` の404のみ。ローカルにルートfaviconがない既存状態）。
- `markets/proof.json` と `markets/*.png`：390pxと1440pxで、**操作なしの読み込み後約3秒で SPY の提供元iframeにOHLC（終値752.10等）とcanvas 7枚**を確認。QQQ（タップ／クリック）、DIA（キーボードEnter）、BTC/USD（タップ／クリック）もそれぞれ提供元のOHLCを確認。390pxでモバイルメニューの開閉、Escapeで閉じて起点へフォーカスが戻ることを確認。

## 5. していないこと・残課題
- push、公開、本番読み戻しは未実施。
- 実装者とは別の独立レビュー（別モデル・別担当）は未実施。DESIGN EVOLUTIONの独立採点も未実施。
- HISTORY 50+の数字を将来採点したい場合は、条件と確率を事前に封印して公開確認する別手続きが必要。
- 一般の人の認識を測る同一設問の代表調査は、01以外ではまだない。

## 6. 実装後の独立レビューと是正（2026-11-03）

上記の「未実施」は実装者の完了報告時点の記録である。後続のCodex
`naojun-futurecast-history50-embed-review-20261103-01` は重要3件・軽微2件でHOLD：
未確認のモデル細分類名、2040年公表と2042年確認の判定矛盾、2026年7月IEA追加資料の欠落、
不正な日付を通す検証、AI規制の管轄が「いずれか」である点を修正した。
9月の米国成人再調査44％（8月は39％）も追記し、調査全体のサンプル数と
2030年設問の対象人数を取り違えない注記を加えた。

Marketsの別独立レビューでは、初期Web Componentによる提供元JavaScriptの
本体origin上実行、ETFが読めない場合の誤った指数URLへの誘導、
iframeの相場データ停止を検知できないことを指摘。
そこで外部コードの実行境界を隔離iframeに変え、ETFと指数への2つの公式リンク、
常設の再読み込みを追加した。外部iframeが`load`を返してもローソク足の描画は
証明できないため「チャート枠を開いた」としか案内しない。

**最終独立Codex再レビュー** `naojun-futurecast-history50-embed-review-20261103-02` は
Critical/Importantなし、`ACCEPTABLE_FOR_RELEASE`（CIと本番読戻しを条件）と判定。
なおTradingViewの「iframeならドキュメント分離」は公式資料にあるが、今回の
`/embed-widget/advanced-chart/` とURL fragment形式は将来互換性を保証する公式契約とは
確認できていない。実ブラウザーで動作を確認し、外部チャート提供停止に備え公式リンクを残す。
この時点でのローカル検証は6幅・FUTURECASTトップ/詳細/Markets・モバイルの
通信遮断3幅とも合格。公開後のプロバイダ可用性を保証しない。
