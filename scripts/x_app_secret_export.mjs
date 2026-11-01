import {constants, createCipheriv, publicEncrypt, randomBytes} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export async function exportSecrets({
  env = process.env,
  publicKeyPath = process.env.PUBLIC_KEY_FILE,
  outputPath = process.env.OUTPUT_FILE,
} = {}) {
  const key = env.NAOJUN_X_API_KEY;
  const secret = env.NAOJUN_X_API_SECRET;
  if (!key || !secret) throw new Error('Missing X app credentials.');
  if (!publicKeyPath || !outputPath) throw new Error('Missing handoff paths.');

  const publicKey = await readFile(publicKeyPath, 'utf8');
  const aesKey = randomBytes(32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv);
  const plaintext = Buffer.from(JSON.stringify({consumerKey:key, consumerSecret:secret}), 'utf8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const wrappedKey = publicEncrypt(
    {
      key: publicKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    aesKey,
  );
  await writeFile(
    outputPath,
    JSON.stringify({
      version:1,
      wrappedKey:wrappedKey.toString('base64'),
      iv:iv.toString('base64'),
      tag:cipher.getAuthTag().toString('base64'),
      ciphertext:ciphertext.toString('base64'),
    }),
    'utf8',
  );
  return {ok:true};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  exportSecrets().then(
    () => console.log('APP_CREDENTIAL_HANDOFF_READY'),
    error => {
      console.error('X app credential handoff failed: ' + error.message);
      process.exitCode = 1;
    },
  );
}
