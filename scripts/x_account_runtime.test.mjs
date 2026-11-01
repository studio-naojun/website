import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sealCredential} from './x_account_credentials.mjs';
import {loadAccountCredentials} from './x_account_runtime.mjs';

async function store(){
  const root=await mkdtemp(join(tmpdir(),'x-account-runtime-'));
  const path=join(root,'credentials.json');
  await writeFile(path,JSON.stringify({
    schema_version:1,
    encryption:'aes-256-gcm-hkdf-sha256',
    accounts:{
      naojun_markets:{
        username:'naojun_markets',
        user_id:'m1',
        updated_at:'2026-11-01T00:00:00Z',
        sealed:sealCredential(
          {accessToken:'markets-token',accessTokenSecret:'markets-token-secret'},
          'shared-secret',
          'naojun_markets',
        ),
      },
    },
  }));
  return path;
}

test('loads per-account OAuth1 token using only shared app secrets',async()=>{
  const storePath=await store();
  const creds=await loadAccountCredentials({
    target:'naojun_markets',
    storePath,
    env:{NAOJUN_X_API_KEY:'shared-key',NAOJUN_X_API_SECRET:'shared-secret'},
  });
  assert.deepEqual(creds,{
    key:'shared-key',
    secret:'shared-secret',
    token:'markets-token',
    tokenSecret:'markets-token-secret',
  });
});

test('missing account or shared secret fails before API use',async()=>{
  const storePath=await store();
  await assert.rejects(
    ()=>loadAccountCredentials({target:'naojun_security',storePath,env:{NAOJUN_X_API_KEY:'k',NAOJUN_X_API_SECRET:'shared-secret'}}),
    /No sealed credential/,
  );
  await assert.rejects(
    ()=>loadAccountCredentials({target:'naojun_markets',storePath,env:{NAOJUN_X_API_KEY:'k'}}),
    /shared X app credentials/,
  );
});
