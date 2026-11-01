import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {
  importCredential,
  loadCredential,
  openCredential,
  sealCredential,
} from './x_account_credentials.mjs';

test('sealed account credential round-trips with account-bound authenticated encryption', () => {
  const sealed = sealCredential(
    {accessToken:'token-a',accessTokenSecret:'secret-a'},
    'consumer-secret',
    'naojun_juken',
    {iv:Buffer.alloc(12, 3)},
  );
  assert.deepEqual(
    openCredential(sealed, 'consumer-secret', 'naojun_juken'),
    {accessToken:'token-a',accessTokenSecret:'secret-a'},
  );
  assert.throws(() => openCredential(sealed, 'consumer-secret', 'naojun_security'));
  assert.throws(() => openCredential(sealed, 'wrong-secret', 'naojun_juken'));
});

test('credential import writes ciphertext only and preserves existing accounts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'x-account-cred-'));
  await mkdir(join(root, 'content'), {recursive:true});
  const storePath = join(root, 'content', 'credentials.json');
  const sourcePath = join(root, 'token.json');
  await writeFile(
    storePath,
    JSON.stringify({
      schema_version:1,
      encryption:'aes-256-gcm-hkdf-sha256',
      accounts:{existing:{username:'existing',user_id:'1',updated_at:'2026-01-01T00:00:00.000Z',sealed:{version:1,iv:'x',tag:'y',ciphertext:'z'}}},
    }),
  );
  await writeFile(
    sourcePath,
    JSON.stringify({
      username:'naojun_juken',
      userId:'123',
      accessToken:'plain-access-token',
      accessTokenSecret:'plain-token-secret',
    }),
  );
  await importCredential({
    sourcePath,
    storePath,
    target:'naojun_juken',
    consumerSecret:'consumer-secret',
    now:new Date('2026-11-01T03:40:00.000Z'),
  });
  const raw = await readFile(storePath, 'utf8');
  assert.doesNotMatch(raw, /plain-access-token|plain-token-secret/);
  const parsed = JSON.parse(raw);
  assert.ok(parsed.accounts.existing);
  assert.ok(parsed.accounts.naojun_juken.sealed.ciphertext);
  const loaded = await loadCredential({
    storePath,
    target:'naojun_juken',
    consumerSecret:'consumer-secret',
  });
  assert.equal(loaded.username, 'naojun_juken');
  assert.equal(loaded.accessToken, 'plain-access-token');
  assert.equal(loaded.accessTokenSecret, 'plain-token-secret');
});
