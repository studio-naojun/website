# Morning Checkpoint

Everything that can be safely prepared without real WordPress data or external account changes should be completed before asking for these items.

## Required from Jun

1. **WordPress WXR/XML export**
   - WordPress管理画面の `ツール > エクスポート`
   - `すべてのコンテンツ` を選択
   - 生成された `.xml` をこのChatへUpload
   - このFileには旧コメントのemail/IP等が含まれる可能性があるため、GitHubへ直接commitしない

2. **Final Domain name**
   - 移行後Blogで使用するDomainを確定する
   - URL pathは原則として旧WordPressのpathを維持する

3. **Private ArchiveのSupabase Project**
   - 第一候補: 既存のNaoJun / Stay Atlasと同じSupabase Projectを再利用し、専用Table + 専用`app_metadata.wordpress_blog_role`で分離する
   - 別Projectにしたい場合だけ変更する

## Usually resolved from the WXR automatically

- 記事/固定Page/Attachment/コメント件数
- 公開/下書き/private等のstatus分布
- 旧URL一覧
- category/tag
- 画像source host
- comment status/type
- raw/normalized文字数
- sanitizer/shortcode例外
- Media host allowlist候補

これらはJunへ先に質問せず、WXRを解析して具体的な差分・例外が出た場合だけ確認対象にする。
