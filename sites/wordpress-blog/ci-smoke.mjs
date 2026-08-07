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
const liveAdmin = read('admin/live-admin.html');
const liveAdminScript = read('admin/live-admin.js');
const liveConfig = read('admin/supabase-config.js');
const schema = read('db/schema.sql');

assert(config.phase === 'ready_for_wxr', 'Migration shell must be ready for WXR input.');
assert(config.migration.engineReady === true, 'WXR migration engine must be ready.');
assert(config.migration.autoImport === false, 'Real WordPress input must never auto-import.');
assert(config.migration.realInputCommitted === false, 'Real WXR input must not be committed.');
assert(config.admin.liveDataEnabled === false, 'Live private data must remain disabled until DB/Auth setup is explicitly completed.');
assert(config.admin.browserWritesAllowed === false, 'Browser writes to the private archive must remain disabled.');
assert(config.admin.commentsVisibility === 'admin_only', 'Legacy comments must be admin_only.');

for (const [name, html] of [['index.html', publicIndex], ['posts/sample.html', publicPost]]) {
  assert(!html.includes('admin/admin.js'), `${name} must not load the Admin script.`);
  assert(!html.includes('Sample Reader'), `${name} must not contain synthetic private-archive demo records.`);
  assert(!html.includes('wp_legacy_comments'), `${name} must not reference the private comment table.`);
  assert(!html.includes('wordpress_blog_role'), `${name} must not reference the Admin role.`);
}

assert(adminPage.includes('DEMO DATA'), 'Admin prototype must clearly label synthetic data.');
assert(adminScript.includes('実WordPressデータではありません'), 'Demo comments must be explicitly synthetic.');
assert(liveAdmin.includes('AUTHENTICATED PRIVATE ARCHIVE'), 'Live Admin shell must identify the private archive.');
assert(/enabled:\s*false/.test(liveConfig), 'Live Supabase config must remain disabled until production setup.');
assert(liveAdminScript.includes(".from('wp_legacy_comments')"), 'Live Admin must read the private archive table.');
assert(liveAdminScript.includes('.select('), 'Live Admin must support read-only select.');
assert(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/.test(liveAdminScript), 'Live Admin must not write to the archive from the browser.');

assert(schema.includes('alter table public.wp_legacy_comments enable row level security'), 'Legacy comments table must enable RLS.');
assert(schema.includes('wordpress_blog_role'), 'Schema must require the WordPress blog admin role.');
assert(schema.includes("revoke all on table public.wp_legacy_comments from anon"), 'Anonymous access must be revoked.');
assert(!/author_email|comment_author_ip|comment_agent/i.test(schema), 'Private commenter identifiers must not be schema columns.');

console.log('WordPress blog migration shell smoke: PASS');
console.log(JSON.stringify({
  phase: config.phase,
  migrationEngineReady: config.migration.engineReady,
  autoImport: config.migration.autoImport,
  liveDataEnabled: config.admin.liveDataEnabled,
  browserWritesAllowed: config.admin.browserWritesAllowed,
  commentsVisibility: config.admin.commentsVisibility,
  publicSamplePages: 2,
  privateArchiveSchema: 'RLS required'
}, null, 2));
