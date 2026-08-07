(async function(){
  const $=s=>document.querySelector(s);
  const cfg=window.STAY_ATLAS_SUPABASE_CONFIG||{};
  const status=$('#inviteStatus');
  const message=$('#inviteMessage');
  const detail=$('#inviteDetail');
  const form=$('#passwordForm');
  const complete=$('#completePanel');
  let client=null;

  function setStatus(text,kind=''){status.textContent=text;status.className=`pill ${kind}`.trim();}
  function configured(){return cfg.enabled===true&&/^https:\/\//.test(cfg.url||'')&&Boolean(cfg.publishableKey);}
  function hashParams(){return new URLSearchParams(location.hash.replace(/^#/,''));}
  function queryParams(){return new URLSearchParams(location.search);}
  function authError(){
    const hash=hashParams(),query=queryParams();
    return hash.get('error_description')||query.get('error_description')||hash.get('error')||query.get('error')||'';
  }
  function loadSupabase(){
    if(window.supabase?.createClient)return Promise.resolve();
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
      script.onload=resolve;
      script.onerror=()=>reject(new Error('Supabase library could not be loaded'));
      document.head.appendChild(script);
    });
  }
  async function sessionFromRedirect(){
    const code=queryParams().get('code');
    if(code){
      const exchanged=await client.auth.exchangeCodeForSession(code);
      if(exchanged.error)throw exchanged.error;
      if(exchanged.data?.session)return exchanged.data.session;
    }
    const first=await client.auth.getSession();
    if(first.error)throw first.error;
    if(first.data?.session)return first.data.session;
    return await new Promise((resolve,reject)=>{
      let settled=false;
      const timer=setTimeout(()=>{if(settled)return;settled=true;subscription.unsubscribe();resolve(null);},5000);
      const {data:{subscription}}=client.auth.onAuthStateChange((event,session)=>{
        if(settled)return;
        if(session&&(event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='PASSWORD_RECOVERY')){
          settled=true;clearTimeout(timer);subscription.unsubscribe();resolve(session);
        }
      });
    });
  }

  const redirectError=authError();
  if(redirectError){
    setStatus('INVITE ERROR');
    message.textContent='招待リンクを確認できませんでした。';
    detail.textContent=redirectError;
    return;
  }
  if(!configured()){
    setStatus('NOT CONFIGURED');
    message.textContent='Stay AtlasのSupabase接続はまだ有効化されていません。Project URLとPublishable Keyを設定してから、新しい招待メールを発行してください。';
    detail.textContent='このページにSecret key / service_role keyを設定することはありません。';
    return;
  }

  try{
    setStatus('CONNECTING');
    await loadSupabase();
    client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const session=await sessionFromRedirect();
    if(!session?.user){
      setStatus('INVITE REQUIRED');
      message.textContent='有効な招待Sessionを確認できませんでした。Supabaseから新しく発行した招待メールのリンクを開いてください。';
      detail.textContent='期限切れ・使用済み・別Browserで処理済みの招待リンクではPassword設定を開始できません。';
      return;
    }
    setStatus('INVITE VERIFIED','quality-verified');
    message.textContent=`${session.user.email||'招待ユーザー'} のメール確認が完了しています。新しいPasswordを設定してください。`;
    form.hidden=false;
  }catch(error){
    console.error(error);
    setStatus('AUTH ERROR');
    message.textContent='招待Sessionの確認中にエラーが発生しました。';
    detail.textContent=error.message||String(error);
    return;
  }

  form.addEventListener('submit',async event=>{
    event.preventDefault();
    const password=$('#newPassword').value;
    const confirmation=$('#confirmPassword').value;
    if(password.length<12){detail.textContent='Passwordは12文字以上にしてください。';return;}
    if(password!==confirmation){detail.textContent='2つのPasswordが一致していません。';return;}
    setStatus('SAVING');
    detail.textContent='Passwordを設定しています…';
    try{
      const {data,error}=await client.auth.updateUser({password});
      if(error)throw error;
      if(!data?.user)throw new Error('Password update did not return a user');
      form.hidden=true;
      complete.hidden=false;
      setStatus('COMPLETE','quality-verified');
      message.textContent='Password設定が完了しました。';
      detail.textContent='Live Adminで編集するには、別途 app_metadata.stay_atlas_role = admin の付与が必要です。';
      history.replaceState({},document.title,location.pathname);
    }catch(error){
      console.error(error);
      setStatus('SAVE ERROR');
      detail.textContent=`Password設定エラー: ${error.message||error}`;
    }
  });
})();
