import {loadCredential} from './x_account_credentials.mjs';

export async function loadAccountCredentials({
  target,
  env=process.env,
  storePath='content/x-account-credentials.enc.json',
}={}){
  const handle=String(target||'').trim().replace(/^@/,'').toLowerCase();
  if(!handle) throw new Error('Missing X account handle.');
  const key=env.NAOJUN_X_API_KEY;
  const secret=env.NAOJUN_X_API_SECRET;
  if(!key||!secret) throw new Error('Missing shared X app credentials.');
  if(/[\r\n]/.test(key)||/[\r\n]/.test(secret)) throw new Error('Malformed shared X app credentials.');
  const account=await loadCredential({storePath,target:handle,consumerSecret:secret});
  return {
    key,
    secret,
    token:account.accessToken,
    tokenSecret:account.accessTokenSecret,
    userId:account.userId,
  };
}
