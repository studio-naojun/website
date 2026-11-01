import {readFile} from 'node:fs/promises';
import {basename, dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadAccountCredentials} from './x_account_runtime.mjs';
import {enc,oauthHeader} from './x_account_oauth.mjs';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const API='https://api.x.com';
const CONFIG_PATH=resolve(ROOT,'content/x-profile-brand.json');
const STORE_PATH=resolve(ROOT,'content/x-account-credentials.enc.json');
const AVATAR_MAX_BYTES=700*1024;
const BANNER_MAX_BYTES=5*1024*1024;

function userCreds(creds){
  return {
    consumerKey:creds.key,
    consumerSecret:creds.secret,
    token:creds.token,
    tokenSecret:creds.tokenSecret,
  };
}

async function requestJson(method,endpoint,creds,{fetchImpl=fetch,form=null}={}){
  const response=await fetchImpl(endpoint,{
    method,
    headers:{Authorization:oauthHeader(method,endpoint,userCreds(creds))},
    ...(form?{body:form}:{}),
    signal:AbortSignal.timeout(30000),
  });
  const raw=await response.text();
  let payload=null;
  if(raw){
    try{payload=JSON.parse(raw);}catch{payload={raw:raw.slice(0,500)};}
  }
  if(!response.ok){
    const detail=payload?.errors?.[0]?.message||payload?.detail||payload?.title||raw.slice(0,240);
    throw new Error('X HTTP '+response.status+(detail?': '+detail:''));
  }
  return payload;
}

export async function readBrandConfig(path=CONFIG_PATH){
  const data=JSON.parse(await readFile(path,'utf8'));
  if(data?.schema_version!==1||!data?.profiles||typeof data.profiles!=='object'){
    throw new Error('Invalid X profile brand config.');
  }
  return data.profiles;
}

async function imageSpec(relativePath,{maximumBytes,kind}){
  const path=resolve(ROOT,relativePath);
  const bytes=await readFile(path);
  if(!bytes.length||bytes.length>maximumBytes){
    throw new Error(kind+' asset has invalid size: '+bytes.length+' bytes.');
  }
  if(bytes[0]!==0x89||bytes[1]!==0x50||bytes[2]!==0x4e||bytes[3]!==0x47){
    throw new Error(kind+' asset must be PNG.');
  }
  const width=bytes.readUInt32BE(16);
  const height=bytes.readUInt32BE(20);
  const expected=kind==='avatar'?[800,800]:[1500,500];
  if(width!==expected[0]||height!==expected[1]){
    throw new Error(kind+' dimensions must be '+expected.join('x')+'; got '+width+'x'+height+'.');
  }
  return {path,bytes,width,height};
}

export function validateProfile(handle,profile){
  if(!/^[a-z0-9_]{1,15}$/.test(handle)) throw new Error('Invalid X handle: '+handle);
  if(!profile||typeof profile!=='object') throw new Error('Missing profile config for @'+handle);
  if(!String(profile.name||'').trim()||[...String(profile.name)].length>50) throw new Error('Invalid display name for @'+handle);
  if(!String(profile.description||'').trim()||[...String(profile.description)].length>160) throw new Error('Invalid bio for @'+handle);
  if(!String(profile.avatar||'').startsWith('assets/x-profiles/'+handle+'/')) throw new Error('Unexpected avatar path for @'+handle);
  if(!String(profile.banner||'').startsWith('assets/x-profiles/'+handle+'/')) throw new Error('Unexpected banner path for @'+handle);
}

export async function verifyIdentity(handle,creds,{fetchImpl=fetch}={}){
  if(!creds.userId) throw new Error('Missing sealed X user id for @'+handle+'.');
  const endpoint=API+'/1.1/account/verify_credentials.json?include_entities=false&skip_status=true';
  const user=await requestJson('GET',endpoint,creds,{fetchImpl});
  if(String(user?.screen_name||'').toLowerCase()!==handle){
    throw new Error('Wrong X account; expected @'+handle+', got @'+String(user?.screen_name||'unknown')+'.');
  }
  if(creds.userId&&String(user?.id_str||user?.id||'')!==String(creds.userId)){
    throw new Error('Wrong X user id for @'+handle+'.');
  }
  return user;
}

function publicSnapshot(user){
  return {
    id:String(user?.id_str||user?.id||''),
    screen_name:String(user?.screen_name||''),
    name:String(user?.name||''),
    description:String(user?.description||''),
    profile_image_url_https:String(user?.profile_image_url_https||''),
    profile_banner_url:String(user?.profile_banner_url||''),
  };
}

export function verifyReadback(before,after,profile,handle){
  if(after.name!==profile.name) throw new Error('Display name readback mismatch for @'+handle);
  if(after.description!==profile.description) throw new Error('Bio readback mismatch for @'+handle);
  if(!after.profile_image_url_https||after.profile_image_url_https===before.profile_image_url_https){
    throw new Error('Profile image readback did not change for @'+handle);
  }
  if(!after.profile_banner_url||after.profile_banner_url===before.profile_banner_url){
    throw new Error('Profile banner readback did not change for @'+handle);
  }
  return true;
}

async function updateText(handle,profile,creds,{fetchImpl=fetch}={}){
  const endpoint=API+'/1.1/account/update_profile.json'
    +'?name='+enc(profile.name)
    +'&description='+enc(profile.description)
    +'&include_entities=false&skip_status=true';
  const user=await requestJson('POST',endpoint,creds,{fetchImpl});
  if(String(user?.screen_name||'').toLowerCase()!==handle) throw new Error('Profile update returned wrong account.');
  return user;
}

async function uploadAsset(endpointPath,fieldName,asset,creds,{fetchImpl=fetch}={}){
  const endpoint=API+endpointPath;
  const form=new FormData();
  form.append(fieldName,new Blob([asset.bytes],{type:'image/png'}),basename(asset.path));
  return requestJson('POST',endpoint,creds,{fetchImpl,form});
}

export async function applyProfile(handle,profile,{
  env=process.env,
  fetchImpl=fetch,
  mode='apply',
  sleep=ms=>new Promise(resolveSleep=>setTimeout(resolveSleep,ms)),
  log=console.log,
}={}){
  validateProfile(handle,profile);
  const avatar=await imageSpec(profile.avatar,{maximumBytes:AVATAR_MAX_BYTES,kind:'avatar'});
  const banner=await imageSpec(profile.banner,{maximumBytes:BANNER_MAX_BYTES,kind:'banner'});
  const creds=await loadAccountCredentials({target:handle,env,storePath:STORE_PATH});
  const before=await verifyIdentity(handle,creds,{fetchImpl});
  log?.('BEFORE @'+handle+' '+JSON.stringify(publicSnapshot(before)));
  if(mode==='verify'){
    return {handle,status:'verified',before};
  }
  if(mode!=='apply') throw new Error('Unsupported profile mode: '+mode);

  let step='text';
  try{
    await updateText(handle,profile,creds,{fetchImpl});
    step='avatar';
    await uploadAsset('/1.1/account/update_profile_image.json','image',avatar,creds,{fetchImpl});
    step='banner';
    await uploadAsset('/1.1/account/update_profile_banner.json','banner',banner,creds,{fetchImpl});
  }catch(error){
    throw new Error('@'+handle+' failed during '+step+' update: '+error.message);
  }

  let after=null;
  let lastError=null;
  for(let attempt=1;attempt<=6;attempt++){
    await sleep(5000);
    try{
      const candidate=await verifyIdentity(handle,creds,{fetchImpl});
      verifyReadback(before,candidate,profile,handle);
      after=candidate;
      break;
    }catch(error){
      lastError=error;
    }
  }
  if(!after) throw new Error('@'+handle+' readback failed after image processing window: '+lastError?.message);
  log?.('AFTER @'+handle+' '+JSON.stringify(publicSnapshot(after)));
  return {
    handle,
    status:'applied',
    before:{
      name:before.name,
      description:before.description,
      profile_image_url_https:before.profile_image_url_https,
      profile_banner_url:before.profile_banner_url,
    },
    after:{
      name:after.name,
      description:after.description,
      profile_image_url_https:after.profile_image_url_https,
      profile_banner_url:after.profile_banner_url,
    },
  };
}

export async function runAll({
  env=process.env,
  fetchImpl=fetch,
  mode=process.env.X_PROFILE_MODE||'verify',
  sleep,
  log=console.log,
}={}){
  const profiles=await readBrandConfig();
  const order=['naojun_markets','naojun_juken','naojun_security'];
  const results=[];
  if(mode==='apply'){
    for(const handle of order){
      await applyProfile(handle,profiles[handle],{env,fetchImpl,mode:'verify',sleep,log});
      log('PREFLIGHT VERIFIED @'+handle);
    }
  }
  for(const handle of order){
    const result=await applyProfile(handle,profiles[handle],{env,fetchImpl,mode,sleep,log});
    results.push(result);
    log((mode==='apply'?'APPLIED':'VERIFIED')+' @'+handle+' name='+profiles[handle].name);
  }
  return results;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
  runAll().catch(error=>{
    console.error('X profile brand apply failed: '+error.message);
    process.exitCode=1;
  });
}
