import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, privateDecrypt, constants, createDecipheriv} from 'node:crypto';
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {exportSecrets} from './x_app_secret_export.mjs';

test('app credentials are emitted only as RSA-wrapped AES-GCM ciphertext', async () => {
  const root = await mkdtemp(join(tmpdir(), 'x-app-export-'));
  const {publicKey, privateKey} = generateKeyPairSync('rsa', {
    modulusLength:2048,
    publicKeyEncoding:{type:'spki',format:'pem'},
    privateKeyEncoding:{type:'pkcs8',format:'pem'},
  });
  const pub = join(root, 'public.pem');
  const out = join(root, 'handoff.json');
  await writeFile(pub, publicKey);
  await exportSecrets({
    env:{NAOJUN_X_API_KEY:'app-key',NAOJUN_X_API_SECRET:'app-secret'},
    publicKeyPath:pub,
    outputPath:out,
  });
  const raw = await readFile(out, 'utf8');
  assert.doesNotMatch(raw, /app-key|app-secret/);
  const sealed = JSON.parse(raw);
  const aesKey = privateDecrypt(
    {key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},
    Buffer.from(sealed.wrappedKey,'base64'),
  );
  const decipher = createDecipheriv('aes-256-gcm', aesKey, Buffer.from(sealed.iv,'base64'));
  decipher.setAuthTag(Buffer.from(sealed.tag,'base64'));
  const clear = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext,'base64')),
    decipher.final(),
  ]).toString('utf8');
  assert.deepEqual(JSON.parse(clear), {consumerKey:'app-key',consumerSecret:'app-secret'});
});
