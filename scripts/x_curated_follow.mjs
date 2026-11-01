import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadAccountCredentials} from './x_account_runtime.mjs';
import {enc,oauthHeader} from './x_account_oauth.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const CONFIG_PATH=resolve(ROOT,'content/x-curated-follows.json');
const STORE_PATH=resolve(ROOT,'content/x-account-credentials.enc.json');
const API='https://api.x.com';

function authCreds(creds){
  return {
    consumerKey:creds.key,
    consumerSecret:creds.secret,
    token:creds.token,
    tokenSecret:creds.tokenSecret,
  };
}

async function requestJson(method,endpoint,creds,{fetchImpl=fetch}={}){
  const response=await fetchImpl(endpoint,{
    method,
    headers:{Authorization:oauthHeader(method,endpoint,authCreds(creds))},
    signal:AbortSignal.timeout(30000),
  });
  const raw=await response.text();
  let payload=null;
  if(raw){
    try{payload=JSON.parse(raw);}catch{payload={raw:raw.slice(0,600)};}
  }
  if(!response.ok){
    const code=payload?.errors?.[0]?.code;
    const detail=payload?.errors?.[0]?.message||payload?.detail||payload?.title||raw.slice(0,240);
    const error=new Error('X HTTP '+response.status+(code?(' code '+code):'')+(detail?(': '+detail):''));
    error.status=response.status;
    error.code=code;
    throw error;
  }
  return payload;
}

export async function readConfig(path=CONFIG_PATH){
  const config=JSON.parse(await readFile(path,'utf8'));
  if(config?.schema_version!==1) throw new Error('Invalid curated follow config schema.');
  if(!Number.isInteger(config.max_new_per_account)||config.max_new_per_account<1||config.max_new_per_account>25){
    throw new Error('Invalid max_new_per_account.');
  }
  if(!Number.isInteger(config.delay_ms)||config.delay_ms<2000){
    throw new Error('delay_ms must be at least 2000.');
  }
  for(const handle of ['naojun_juken','naojun_security']){
    const candidates=config.accounts?.[handle];
    if(!Array.isArray(candidates)||candidates.length<config.max_new_per_account){
      throw new Error('Not enough candidates for @'+handle+'.');
    }
    const normalized=candidates.map(value=>candidateHandle(value));
    if(normalized.some(value=>!/^[a-z0-9_]{1,15}$/.test(value))) throw new Error('Invalid candidate handle for @'+handle+'.');
    if(new Set(normalized).size!==normalized.length) throw new Error('Duplicate candidate handle for @'+handle+'.');
    if(normalized.includes(handle)) throw new Error('Account cannot follow itself.');
    if(normalized.some(value=>value.startsWith('naojun_'))) throw new Error('Cross-account NAOJUN follows are not allowed.');
  }
  return config;
}

function candidateHandle(value){
  const raw=typeof value==='string'?value:value?.handle;
  return String(raw||'').trim().replace(/^@/,'').toLowerCase();
}

function candidateId(value){
  if(!value||typeof value==='string') return '';
  return String(value.id||'').trim();
}

async function verifyIdentity(handle,creds,{fetchImpl=fetch}={}){
  if(!creds.userId) throw new Error('Missing sealed X user id for @'+handle+'.');
  const endpoint=API+'/1.1/account/verify_credentials.json?include_entities=false&skip_status=true';
  const user=await requestJson('GET',endpoint,creds,{fetchImpl});
  if(String(user?.screen_name||'').toLowerCase()!==handle) throw new Error('Wrong X account for @'+handle+'.');
  if(String(user?.id_str||user?.id||'')!==String(creds.userId)) throw new Error('Wrong X user id for @'+handle+'.');
  return user;
}

async function lookupUsers(candidates,creds,{fetchImpl=fetch}={}){
  const endpoint=API+'/1.1/users/lookup.json?include_entities=false&screen_name='+enc(candidates.join(','));
  const users=await requestJson('GET',endpoint,creds,{fetchImpl});
  const map=new Map();
  for(const user of Array.isArray(users)?users:[]){
    const handle=String(user?.screen_name||'').toLowerCase();
    if(handle) map.set(handle,user);
  }
  return map;
}

async function lookupFriendships(candidates,creds,{fetchImpl=fetch}={}){
  const endpoint=API+'/1.1/friendships/lookup.json?screen_name='+enc(candidates.join(','));
  const relationships=await requestJson('GET',endpoint,creds,{fetchImpl});
  const map=new Map();
  for(const item of Array.isArray(relationships)?relationships:[]){
    const handle=String(item?.screen_name||'').toLowerCase();
    if(handle) map.set(handle,new Set(item.connections||[]));
  }
  return map;
}

export function selectCandidates(orderedCandidates,userMap,relationshipMap,maxNew){
  const selected=[];
  const skipped=[];
  for(const raw of orderedCandidates){
    const handle=candidateHandle(raw);
    const pinnedId=candidateId(raw);
    const user=userMap.get(handle);
    if(!user){
      skipped.push({handle,reason:'not-resolved'});
      continue;
    }
    if(user.protected){
      skipped.push({handle,reason:'protected'});
      continue;
    }
    const connections=relationshipMap.get(handle)||new Set();
    if(connections.has('following')){
      skipped.push({handle,reason:'already-following'});
      continue;
    }
    if(connections.has('blocking')||connections.has('blocked_by')){
      skipped.push({handle,reason:'blocked'});
      continue;
    }
    selected.push({
      handle:String(user.screen_name),
      id:String(user.id_str||user.id||''),
      pinnedId,
      name:String(user.name||''),
      description:String(user.description||'').replace(/\s+/g,' ').slice(0,220),
      followers:Number(user.followers_count||0),
    });
    if(selected.length>=maxNew) break;
  }
  return {selected,skipped};
}

async function followOne(target,creds,{fetchImpl=fetch}={}){
  const endpoint=API+'/1.1/friendships/create.json?user_id='+enc(target.id);
  const user=await requestJson('POST',endpoint,creds,{fetchImpl});
  if(String(user?.id_str||user?.id||'')!==String(target.id)){
    throw new Error('Follow response user id mismatch for @'+target.handle+'.');
  }
  if(String(user?.screen_name||'').toLowerCase()!==target.handle.toLowerCase()){
    throw new Error('Follow response handle mismatch for @'+target.handle+'.');
  }
  return user;
}

export async function planAccount(handle,candidates,maxNew,{
  env=process.env,
  fetchImpl=fetch,
  log=console.log,
}={}){
  const creds=await loadAccountCredentials({target:handle,env,storePath:STORE_PATH});
  const self=await verifyIdentity(handle,creds,{fetchImpl});
  log('IDENTITY @'+handle+' id='+String(self.id_str||self.id));
  const normalized=candidates.map(value=>candidateHandle(value));
  const users=await lookupUsers(normalized,creds,{fetchImpl});
  const resolved=[...users.keys()];
  const relationships=resolved.length?await lookupFriendships(resolved,creds,{fetchImpl}):new Map();
  const plan=selectCandidates(normalized,users,relationships,maxNew);
  for(const item of plan.selected){
    log('SELECT @'+handle+' -> @'+item.handle+' id='+item.id+' | '+item.name+' | followers='+item.followers+' | '+item.description);
  }
  for(const item of plan.skipped){
    log('SKIP @'+handle+' -> @'+item.handle+' reason='+item.reason);
  }
  log('PLAN @'+handle+' selected='+plan.selected.length+' resolved='+resolved.length+' candidates='+normalized.length);
  return {handle,creds,plan};
}

export async function run({
  env=process.env,
  fetchImpl=fetch,
  mode=process.env.X_FOLLOW_MODE||'plan',
  sleep=ms=>new Promise(resolveSleep=>setTimeout(resolveSleep,ms)),
  log=console.log,
}={}){
  const config=await readConfig();
  const order=['naojun_juken','naojun_security'];
  const plans=[];
  for(const handle of order){
    plans.push(await planAccount(handle,config.accounts[handle],config.max_new_per_account,{env,fetchImpl,log}));
  }
  if(mode==='plan') return plans.map(({handle,plan})=>({handle,plan}));
  if(mode!=='apply') throw new Error('Unsupported follow mode: '+mode);
  for(const {handle,plan} of plans){
    for(const target of plan.selected){
      if(!target.pinnedId) throw new Error('Apply requires pinned user id for @'+handle+' -> @'+target.handle+'. Run plan and pin reviewed ids first.');
      if(target.pinnedId!==target.id) throw new Error('Pinned user id mismatch for @'+handle+' -> @'+target.handle+'.');
    }
  }
  for(let accountIndex=0;accountIndex<plans.length;accountIndex++){
    const {handle,creds,plan}=plans[accountIndex];
    let followed=0;
    let attempt=0;
    for(const target of plan.selected){
      attempt++;
      try{
        await followOne(target,creds,{fetchImpl});
        followed++;
        log('FOLLOWED @'+handle+' -> @'+target.handle+' ('+followed+'/'+config.max_new_per_account+')');
      }catch(error){
        log('FOLLOW_FAILED @'+handle+' -> @'+target.handle+' '+error.message);
        const fatal=
          !error.status||
          error.status===401||
          error.status===429||
          error.status>=500||
          error.code===64||
          error.code===89||
          error.code===161||
          error.code===226||
          error.code===326||
          (error.status===403&&error.code!==160&&error.code!==162);
        if(fatal) throw error;
      }
      if(attempt<plan.selected.length) await sleep(config.delay_ms);
    }
    log('DONE @'+handle+' followed='+followed+' planned='+plan.selected.length);
    if(accountIndex<plans.length-1) await sleep(5000);
  }
  return plans.map(({handle,plan})=>({handle,plan}));
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  run().catch(error=>{
    console.error('X curated follow failed: '+error.message);
    process.exitCode=1;
  });
}
