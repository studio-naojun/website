import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {migrateMarketsCredential} from './x_markets_credential_migrate.mjs';
import {loadCredential} from './x_account_credentials.mjs';

test('migrates verified Markets token into ciphertext-only account store',async()=>{
  const root=await mkdtemp(join(tmpdir(),'x-markets-migrate-'));
  const storePath=join(root,'credentials.json');
  await writeFile(storePath,JSON.stringify({
    schema_version:1,
    encryption:'aes-256-gcm-hkdf-sha256',
    accounts:{
      naojun_juken:{username:'naojun_juken',user_id:'j',updated_at:'2026-11-01T00:00:00Z',sealed:{version:1,iv:'a',tag:'b',ciphertext:'c'}},
    },
  }));
  const fetchImpl=async()=>new Response(JSON.stringify({data:{id:'m1',username:'naojun_markets'}}),{status:200});
  await migrateMarketsCredential({
    storePath,
    fetchImpl,
    now:new Date('2026-11-01T04:30:00.000Z'),
    env:{
      NAOJUN_X_API_KEY:'key',
      NAOJUN_X_API_SECRET:'consumer-secret',
      NAOJUN_X_ACCESS_TOKEN:'markets-access',
      NAOJUN_X_ACCESS_TOKEN_SECRET:'markets-secret',
    },
  });
  const raw=await readFile(storePath,'utf8');
  assert.doesNotMatch(raw,/markets-access|markets-secret/);
  const parsed=JSON.parse(raw);
  assert.ok(parsed.accounts.naojun_juken);
  assert.equal(parsed.accounts.naojun_markets.user_id,'m1');
  const loaded=await loadCredential({storePath,target:'naojun_markets',consumerSecret:'consumer-secret'});
  assert.equal(loaded.accessToken,'markets-access');
  assert.equal(loaded.accessTokenSecret,'markets-secret');
});

test('refuses to seal a token belonging to the wrong X account',async()=>{
  const root=await mkdtemp(join(tmpdir(),'x-markets-migrate-wrong-'));
  const storePath=join(root,'credentials.json');
  await writeFile(storePath,JSON.stringify({schema_version:1,encryption:'aes-256-gcm-hkdf-sha256',accounts:{}}));
  const fetchImpl=async()=>new Response(JSON.stringify({data:{id:'x',username:'naojun_juken'}}),{status:200});
  await assert.rejects(
    ()=>migrateMarketsCredential({
      storePath,
      fetchImpl,
      env:{
        NAOJUN_X_API_KEY:'key',
        NAOJUN_X_API_SECRET:'consumer-secret',
        NAOJUN_X_ACCESS_TOKEN:'wrong',
        NAOJUN_X_ACCESS_TOKEN_SECRET:'wrong-secret',
      },
    }),
    /expected @naojun_markets/,
  );
});
