import {createCipheriv, createDecipheriv, hkdfSync, randomBytes} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const VERSION = 1;
const ENCRYPTION = 'aes-256-gcm-hkdf-sha256';

function normalizeHandle(value) {
  const handle = String(value || '').trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(handle)) throw new Error('Invalid X account handle.');
  return handle;
}

function keyFor(consumerSecret, target) {
  if (!consumerSecret) throw new Error('Missing X consumer secret.');
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(String(consumerSecret), 'utf8'),
      Buffer.from('naojun-x-account-credentials-v1', 'utf8'),
      Buffer.from(normalizeHandle(target), 'utf8'),
      32,
    ),
  );
}

function aadFor(target) {
  return Buffer.from('naojun-x-account:' + normalizeHandle(target) + ':v1', 'utf8');
}

export function sealCredential(payload, consumerSecret, target, {iv = randomBytes(12)} = {}) {
  const handle = normalizeHandle(target);
  const cipher = createCipheriv('aes-256-gcm', keyFor(consumerSecret, handle), iv);
  cipher.setAAD(aadFor(handle));
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')),
    cipher.final(),
  ]);
  return {
    version: VERSION,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    ciphertext: ciphertext.toString('base64url'),
  };
}

export function openCredential(sealed, consumerSecret, target) {
  const handle = normalizeHandle(target);
  if (!sealed || sealed.version !== VERSION) throw new Error('Unsupported sealed credential.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    keyFor(consumerSecret, handle),
    Buffer.from(sealed.iv, 'base64url'),
  );
  decipher.setAAD(aadFor(handle));
  decipher.setAuthTag(Buffer.from(sealed.tag, 'base64url'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(sealed.ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8'),
  );
}

async function loadStore(path) {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    if (
      parsed?.schema_version !== VERSION ||
      parsed?.encryption !== ENCRYPTION ||
      !parsed?.accounts ||
      typeof parsed.accounts !== 'object'
    ) {
      throw new Error('Invalid sealed credential store.');
    }
    return parsed;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {schema_version: VERSION, encryption: ENCRYPTION, accounts: {}};
    }
    throw error;
  }
}

export async function importCredential({
  sourcePath,
  storePath,
  target,
  consumerSecret,
  now = new Date(),
}) {
  const handle = normalizeHandle(target);
  const source = JSON.parse(await readFile(sourcePath, 'utf8'));
  if (String(source?.username || '').toLowerCase() !== handle) {
    throw new Error('Credential artifact account mismatch.');
  }
  if (!source?.userId || !source?.accessToken || !source?.accessTokenSecret) {
    throw new Error('Credential artifact is incomplete.');
  }
  const store = await loadStore(storePath);
  store.accounts[handle] = {
    username: handle,
    user_id: String(source.userId),
    updated_at: now.toISOString(),
    sealed: sealCredential(
      {
        accessToken: String(source.accessToken),
        accessTokenSecret: String(source.accessTokenSecret),
      },
      consumerSecret,
      handle,
    ),
  };
  await writeFile(storePath, JSON.stringify(store, null, 2) + '\n', 'utf8');
  return {username: handle, userId: String(source.userId)};
}

export async function loadCredential({storePath, target, consumerSecret}) {
  const handle = normalizeHandle(target);
  const store = await loadStore(storePath);
  const record = store.accounts[handle];
  if (!record) throw new Error('No sealed credential for @' + handle + '.');
  const secret = openCredential(record.sealed, consumerSecret, handle);
  if (!secret?.accessToken || !secret?.accessTokenSecret) {
    throw new Error('Decrypted credential is incomplete.');
  }
  return {
    username: handle,
    userId: record.user_id,
    accessToken: secret.accessToken,
    accessTokenSecret: secret.accessTokenSecret,
  };
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'import') {
    const result = await importCredential({
      sourcePath: process.env.SOURCE_TOKEN_FILE,
      storePath: process.env.CREDENTIALS_FILE || 'content/x-account-credentials.enc.json',
      target: process.env.TARGET_HANDLE,
      consumerSecret: process.env.NAOJUN_X_API_SECRET,
    });
    console.log('SEALED_USER=@' + result.username);
    return;
  }
  throw new Error('Mode must be import.');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => {
    console.error('X credential sealing failed: ' + error.message);
    process.exitCode = 1;
  });
}
