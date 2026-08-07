import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => fs.readFileSync(path.join(here, relativePath), 'utf8');
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const config = JSON.parse(read('site.config.json'));
const publicIndex = read('index.html');
const publicPost = read('posts/sample.html');
const adminPage = read('admin/index.html');
const adminScript = read('admin/admin.js');
const schema = read('db/schema.sql');

assert(config.phase === 'shell', 'Phase 1 config must remain shell.');
assert(config.migration.enabled === false, 'WordPress importer must remain disabled in Phase 1.');
assert(config.admin.liveDataEnabled === false, 'Live private data must remain disabled in Phase 1.');
assert(config.admin.commentsVisibility === 'admin_only', 'Legacy comments must be admin_only.');

for (const [name, html] of [['index.html', publicIndex], ['posts/sample.html', publicPost]]) {
  assert(!html.includes('admin/admin.js'), `${name} must not load the Admin script.`);
  assert(!html.includes('Sample Reader'), `${name} must not contain synthetic private-archive demo records.`);
  assert(!html.includes('wp_legacy_comments'), `${name} must not reference the private comment table.`);
}

assert(adminPage.includes('DEMO DATA'), 'Admin shell must clearly label synthetic data.');
assert(adminScript.includes('実WordPressデータではありません'), 'Demo comments must be explicitly synthetic.');

assert(schema.includes('alter table public.wp_legacy_comments enable row level security'), 'Legacy comments table must enable RLS.');
assert(schema.includes('wordpress_blog_role'), 'Schema must require the WordPress blog admin role.');
assert(schema.includes("revoke all on table public.wp_legacy_comments from anon"), 'Anonymous access must be revoked.');
assert(!/author_email|comment_author_ip|user_agent/i.test(schema), 'Private commenter identifiers must not be schema columns.');

console.log('WordPress blog migration shell smoke: PASS');
console.log(JSON.stringify({
  phase: config.phase,
  migrationEnabled: config.migration.enabled,
  liveDataEnabled: config.admin.liveDataEnabled,
  commentsVisibility: config.admin.commentsVisibility,
  publicSamplePages: 2,
  privateArchiveSchema: 'RLS required'
}, null, 2));
