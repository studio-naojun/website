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
const liveAdmin = read('admin/live-admin.html');
const liveAdminScript = read('admin/live-admin.js');
const liveConfig = read('admin/supabase-config.js');
const schema = read('db/schema.sql');
const policy = read('migration/u2memo_policy.py');
const importCli = read('migration/import_u2memo_wxr.py');
const dbCli = read('migration/prepare_u2memo_db_import.py');

assert(config.siteId === 'u2memo', 'Site ID must be u2memo.');
assert(config.domain === 'pocca.net', 'Target domain must be pocca.net.');
assert(config.siteUrl === 'https://pocca.net/u2memo/', 'Target site URL must be fixed.');
assert(config.phase === 'real_wxr_validation', 'Migration shell must be in real WXR validation phase.');
assert(config.migration.engineReady === true, 'WXR migration engine must be ready.');
assert(config.migration.autoImport === false, 'Real WordPress input must never auto-import.');
assert(config.migration.realInputCommitted === false, 'Real WXR input must not be committed.');
assert(config.public.realContentCommitted === false, 'Real generated content must not be committed before publication scope is approved.');
assert(config.admin.liveDataEnabled === false, 'Live private data must remain disabled until DB/Auth setup is explicitly completed.');
assert(config.admin.browserWritesAllowed === false, 'Browser writes to the private archive must remain disabled.');
assert(config.admin.commentsVisibility === 'admin_only', 'Legacy comments must be admin_only.');
assert(config.admin.table === 'u2memo_legacy_comments', 'Dedicated u2memo archive table is required.');
assert(config.admin.roleClaim === 'u2memo_archive_role', 'Dedicated u2memo role claim is required.');

for (const [name, html] of [['index.html', publicIndex], ['posts/sample.html', publicPost]]) {
  assert(!html.includes('u2memo_legacy_comments'), `${name} must not reference the private comment table.`);
  assert(!html.includes('u2memo_archive_role'), `${name} must not reference the Admin role.`);
  assert(!html.includes('comment_body'), `${name} must not contain Private Archive data structures.`);
}

assert(adminPage.includes('PRIVATE ARCHIVE'), 'Admin entry must identify the Private Archive.');
assert(!adminPage.includes('DEMO DATA'), 'Synthetic comment demo must not remain in the final Admin entry.');
assert(adminPage.includes('./live-admin.html'), 'Admin entry must link to authenticated Live Admin.');
assert(liveAdmin.includes('AUTHENTICATED PRIVATE ARCHIVE'), 'Live Admin shell must identify the private archive.');
assert(/enabled:\s*false/.test(liveConfig), 'Live Supabase config must remain disabled until production setup.');
assert(liveAdminScript.includes(".from('u2memo_legacy_comments')"), 'Live Admin must read the dedicated u2memo archive table.');
assert(liveAdminScript.includes('u2memo_archive_role'), 'Live Admin must require the dedicated u2memo role.');
assert(liveAdminScript.includes('.select('), 'Live Admin must support read-only select.');
assert(!/\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/.test(liveAdminScript), 'Live Admin must not write to the archive from the browser.');

assert(schema.includes('alter table public.u2memo_legacy_comments enable row level security'), 'u2memo legacy comments table must enable RLS.');
assert(schema.includes('u2memo_archive_role'), 'Schema must require the u2memo archive admin role.');
assert(schema.includes('revoke all on table public.u2memo_legacy_comments from anon'), 'Anonymous access must be revoked.');
assert(!/author_email|comment_author_ip|comment_agent/i.test(schema), 'Private commenter identifiers must not be schema columns.');
assert(!/\bpass(word)?_hash\b/i.test(schema), 'Legacy password hashes must not be schema columns.');

assert(policy.includes('scrub_legacy_comment_prefix'), 'u2memo policy must scrub legacy SECRET/PASS control lines.');
assert(policy.includes('augment_inline_media'), 'u2memo policy must inventory inline media.');
assert(policy.includes('IGNORED_UNSUPPORTED_POST_TYPES'), 'u2memo policy must classify known WordPress internal item types.');
assert(importCli.includes('verify_u2memo_bundle'), 'u2memo import CLI must use site-specific verification.');
assert(dbCli.includes('u2memo_legacy_comments.csv'), 'u2memo DB package must use dedicated table naming.');

console.log('u2memo WordPress migration shell smoke: PASS');
console.log(JSON.stringify({
  phase: config.phase,
  siteUrl: config.siteUrl,
  migrationEngineReady: config.migration.engineReady,
  autoImport: config.migration.autoImport,
  liveDataEnabled: config.admin.liveDataEnabled,
  browserWritesAllowed: config.admin.browserWritesAllowed,
  commentsVisibility: config.admin.commentsVisibility,
  privateArchiveTable: config.admin.table,
  privateArchiveRole: config.admin.roleClaim,
  privateArchiveSchema: 'RLS required'
}, null, 2));
