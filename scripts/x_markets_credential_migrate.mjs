import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {sealCredential} from './x_account_credentials.mjs';
import {xRequest} from './x_markets_post.mjs';

const HANDLE='naojun_markets';

export async function migrateMarketsCredential({
  env=process.env,
  fetchImpl=fetch,
  storePath='content/x-account-credentials.enc.json',
  now=new Date(),
}={}){
  const key=env.NAOJUN_X_API_KEY;
  const secret=env.NAOJUN_X_API_SECRET;
  const token=env.NAOJUN_X_ACCESS_TOKEN;
  const tokenSecret=env.NAOJUN_X_ACCESS_TOKEN_SECRET;
  if([key,secret,token,tokenSecret].some(v=>!v)) throw new Error('Missing Markets X credentials.');

  const me=await xRequest('GET','/2/users/me',{key,secret,token,tokenSecret},{fetchImpl});
  if(me.data?.username?.toLowerCase()!==HANDLE || !me.data?.id){
    throw new Error('Wrong X account; expected @'+HANDLE+'.');
  }

  const store=JSON.parse(await readFile(storePath,'utf8'));
  if(store?.schema_version!==1 || store?.encryption!=='aes-256-gcm-hkdf-sha256' || typeof store?.accounts!=='object'){
    throw new Error('Invalid sealed credential store.');
  }
  store.accounts[HANDLE]={
    username:HANDLE,
    user_id:String(me.data.id),
    updated_at:now.toISOString(),
    sealed:sealCredential({accessToken:String(token),accessTokenSecret:String(tokenSecret)},secret,HANDLE),
  };
  await writeFile(storePath,JSON.stringify(store,null,2)+'\n','utf8');
  return {username:HANDLE,userId:String(me.data.id)};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  migrateMarketsCredential().then(
    r=>console.log('SEALED_MARKETS_USER=@'+r.username),
    e=>{console.error('Markets credential migration failed: '+e.message);process.exitCode=1;}
  );
}
