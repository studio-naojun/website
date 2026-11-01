import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {loadCredential} from './x_account_credentials.mjs';
import {xRequest} from './x_markets_post.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function verifyAccount({
  target = process.env.TARGET_HANDLE,
  env = process.env,
  fetchImpl = fetch,
  storePath = resolve(ROOT, 'content/x-account-credentials.enc.json'),
} = {}) {
  const handle = String(target || '').trim().replace(/^@/, '').toLowerCase();
  const credential = await loadCredential({
    storePath,
    target:handle,
    consumerSecret:env.NAOJUN_X_API_SECRET,
  });
  const result = await xRequest(
    'GET',
    '/2/users/me',
    {
      key:env.NAOJUN_X_API_KEY,
      secret:env.NAOJUN_X_API_SECRET,
      token:credential.accessToken,
      tokenSecret:credential.accessTokenSecret,
    },
    {fetchImpl},
  );
  if (result.data?.username?.toLowerCase() !== handle) {
    throw new Error('Wrong X account; expected @' + handle + '.');
  }
  return {username:result.data.username,id:result.data.id};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  verifyAccount().then(
    result => console.log('VERIFIED_USER=@' + result.username),
    error => {
      console.error('X account verification failed: ' + error.message);
      process.exitCode = 1;
    },
  );
}
