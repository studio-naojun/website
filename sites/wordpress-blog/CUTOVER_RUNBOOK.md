# u2memo WordPress -> Static Cutover Runbook

Last updated: 2026-08-08
Status: Real WXR rehearsal verified; production cutover not executed
Target URL: `https://pocca.net/u2memo/`
Private Archive: existing Naojun / Stay Atlas Supabase Project, dedicated tables + dedicated role

## Principle

DNS変更やWordPress停止をmigration手段にしない。先に独立したStatic copyとPrivate Archiveを完成・検証し、受入条件を満たしてからtrafficを切り替える。

## Stage A - WXR Rehearsal

1. WordPress `All content` WXR/XMLはpublic repositoryへ保存しない。
2. `migration/import_u2memo_wxr.py` をprivate output directoryへ実行する。
3. `migration-report.json` と `u2memo-policy-report.json` を確認する。
4. published post/pageだけがpublic outputへ出ていることを確認する。
5. private/trash等はinventoryには残してもpublic renderしない。
6. legacy URL pathは `/u2memo/...` のまま維持する。
7. commentsは `private/` のみに存在することを確認する。
8. legacy comment先頭の `SECRET:` / `PASS:` 制御行は公開・保存本文から除去し、SECRET状態だけをbooleanとして保持する。PASS値は保持しない。

## Stage B - Media

1. `media-manifest.json` はWordPress attachmentだけでなく、published本文内の`img src`もinventoryする。
2. `tracking_likely=true` の1px/A8系tracking imageは既定でdownloadしない。
3. 実コンテンツ画像のsource hostnameをmanifestから確定する。
4. `download_media.py --dry-run` をexplicit hostname allowlist付きで実行する。
5. 実downloadではbyte sizeとSHA-256を記録する。
6. missing/blocked imageを解決してから、記事HTMLの参照先をfinal static media pathへ置換する。

旧WordPress/旧外部hostの画像へ本番Siteが恒久依存しない状態にする。

## Stage C - Private Comment Archive

Targetは既存Naojun / Stay Atlas Supabase Project。同一Project内で以下を論理分離する。

- table: `public.u2memo_legacy_comments`
- migration run table: `public.u2memo_migration_runs`
- Auth claim: `app_metadata.u2memo_archive_role = "admin"`

Procedure:

1. `db/schema.sql` を選定済みSupabase Projectへ適用する。
2. 両tableでRLSが有効であることを確認する。
3. intended administratorだけに `u2memo_archive_role=admin` を付与する。
4. `prepare_u2memo_db_import.py` でprivate DB packageを生成する。
5. `u2memo_legacy_comments.csv` をtrusted Admin/server-side pathからimportする。
6. `u2memo_migration_run.json` の値をactual DB recount後に `u2memo_migration_runs` へ記録する。
7. `db/verification.sql` を実行する。
8. anonymous userが0 row、roleなしauthenticated userも0 rowであることを確認する。
9. intended Adminだけが `admin/live-admin.html` からreadできることを確認する。
10. その後にだけ `admin/supabase-config.js` を有効化する。

Browser-side INSERT/UPDATE/DELETE/RPCは使用しない。

## Stage D - Static Preview Acceptance

最低限確認する。

- archive/top page;
- short/long article;
- heading/list/table/link/image;
- 日本語文字・句読点;
- mobile layout;
- `/u2memo/...` legacy path維持;
- title/description/canonical/OGP;
- public HTML/JS/network payloadにlegacy commentsが存在しないこと;
- rehearsal中は`noindex`を維持し、本番公開時にproduction SEO policyへ切替えること。

## Stage E - Final Snapshot

Cutover直前に:

1. 旧WordPressの編集をfreezeする。
2. fresh `All content` WXRを取得する。
3. 同一migration engine commitで最初から再生成する。
4. rehearsalとの差分を説明可能にする。
5. public count/hash、comment archive、media reconciliationを再検証する。

旧WordPressがrehearsal後に変化した場合、最終WXRをSource of Truthとする。

## Stage F - Cutover

Final verification後のみ:

1. Static outputを `https://pocca.net/u2memo/` をserveするproduction targetへdeployする。
2. HTTPSを確認する。
3. path維持できない例外だけredirectする。
4. representative legacy URLsを確認する。
5. sitemap/robots/canonical/OGPをproduction設定で確認する。
6. Admin archiveのRLSを再確認する。

DNS/hosting switchとWordPress停止はrepositoryから自動実行しない。

## Rollback

Cutover前に旧WordPressへtrafficを戻す手順を記録する。Critical defect時は生成物を手編集せずmigration engineを修正して再生成・再検証する。旧WordPress hostingは受入完了とrollback window終了まで削除しない。

## Completion record

最終記録には以下を残す。

- source WXR file name + SHA-256;
- migration engine commit SHA;
- target URL;
- post/page/comment counts;
- source/retained raw + normalized character totals;
- ignored/actionable warning list;
- media download result counts/hashes;
- Private Archive DB verification;
- redirect exceptions;
- production deployment commit;
- cutover date/time;
- rollback procedure/status.
