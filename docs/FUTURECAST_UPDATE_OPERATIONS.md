# FUTURECAST 更新運用 — DATA DISAGREES

作成日：2026-11-03（JST）／対象：NAOJUN STUDIOS 公式サイト

## 目的と選定条件

FUTURECASTの新しい主役は「多数の人は起きないと予測しているが、同じ期限・命題で分析したデータは発生確率50%超と示す、社会構造の転換」。低確率の衝撃的シナリオを無理に51%へ調整しない。採択0件を正しい状態として扱う。

採択基準は、(1) 365日以内のYes/No判定可能な事象と判定資料の事前定義、(2) 同一命題・同一期限を問う代表性ある調査で半数超の回答者が発生確率50%未満と推定、(3) 過去データと誤差分布、数値手法を公開したAI側確率が50%超。生のLLMの自己評価やIEAの中心予測だけを(3)の数値として使わない。推定値の妥当な感度分析で50%をまたぐ場合は保留。

## 実際に自動実行される部分

| タイミング | 実行主体 | 実際にすること | しないこと |
| --- | --- | --- | --- |
| 毎月2日 **08:00 JST**（UTC 1日23時、実際のGitHub Actions開始時刻には遅延あり） | 既存GitHub Actionsの `.github/workflows/futurecast-monthly-evidence.yml` | 候補3件の公式情報源（IEA・Ember・Waymo）のHTTPS応答・HTTPステータス・任意の更新メタデータを収集。JSON/Markdownを90日アーティファクトに保存。毎月1件までのGitHub Issueを研究キューとして起票する | 記事の意味の再解釈、数字の確率化、世論集計、AIへの有料推論、公開台帳の更新 |
| 不定期（重要な一次資料が出たとき） | 研究担当／Codex・Astra・NINAから着手可能 | 公開資料を読み、ベースレート・変動要因・反証・推定誤差を調査。Issue内に命題と同一対象・期限の世論証拠を紐付ける | 意味未確認のURL更新だけで確率の公表を決めない |
| 新しい予測を採択する場合のみ | 検証された担当実行者＋既存GitHub PR/CI/Pages | 原本の追記型NDJSONへ根拠・確率・時刻を新規記録。CIで型・履歴・公表データを検査し、Pages公開後に実URLのバイト読み戻しを確認する | 過去の確率を書き換えない。公開以前に結果が出た値は成績に含めない |
| 四半期（計画・レビュー） | FUTURECAST運用 | 候補の影響度・期限適合性・重複、採択済みの実績、調査対象を棚卸しする | 件数ノルマを課さない |

上表の「不定期」「四半期」は運用仕様であり、専用のAI自動実行ジョブやClaude Scheduled Tasksは**設定していない**。GitHub Actionsの月次ジョブが実際に保証するのは資料の技術的疎通検査とIssue生成であり、**意味を読み直すAI調査やサイト確率の自動更新ではない**。この境界はユーザー向けサイトでも明示する。

### GitHub Actionsの受領

- 対象: `studio-naojun/website` main
- 初回予定: 2026-12-02 08:00 JST相当（GitHub側の遅延はあり得る）
- 手動: GitHub Actions → FUTURECAST Monthly Evidence Review → Run workflow。再実行しても同じJST月のIssueがある場合は新規起票しない。
- CI/手元チェック: `python tools/futurecast/build_data_disagrees.py --check`、`python tools/futurecast/monthly_evidence.py --check`。実際のネットワーク状態を検証するときは `python tools/futurecast/monthly_evidence.py --scan --output <safe-temp>.json --markdown <safe-temp>.md`。
- 失敗: 取得HTTPエラー・リダイレクト・タイムアウトを記録して未確認扱い。確率や本編採択を自動変更しない。Github Issuesの書込権限/組織設定によりIssue作成が失敗した場合はActionsログが未達の証拠。
- 月次Issueは作業キューであり、NINAがIssueを自動で回収・AI再推論・公開する接続は現時点で未確認。

## 次の技術拡張

①更新があった情報源の**意味内容の差分**と出典時刻を読み直す調査実行者を、既存NINA/METIS運用に接続する。②同一設問に対する代表性ある人間側の予測データを取得する（サイト投票は代表標本ではない）。③ベースレートと誤差分布から確率を計算・校正する。④検証に通った予測を既存台帳へ追記し、PR/CI→Pages読み戻しまでの発行を冪等化する。現時点では①〜④は未完成で、誇張した「自動予測」として説明しない。

## 保存と過去データ

- 新ページ: `futurecast/data-disagrees/index.html`
- 調査候補の唯一の編集元: `futurecast/data-disagrees/candidates.json`
- 新ページ生成: `tools/futurecast/build_data_disagrees.py`
- 情報源の月次調査: `tools/futurecast/monthly_evidence.py`
- 旧低確率候補: `futurecast/era-shifts/`（元の8件の数値・期限は変えない）
- 以前から公開の3件と受領: `futurecast/data/ledger/*.ndjson`, `futurecast/data/receipts.ndjson`（不変）
- 追加費用: 有料LLM API・Claudeスケジュールタスクを新設しない。GitHub Actionsの標準実行分のみ。

**現在の判定:** 新基準をすべて満たした公開予測は0件。これは分析の不出来ではなく、裏付けに足りない数字を掲載しないための正しい状態。
