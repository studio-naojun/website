(async function(){
  const config = window.WORDPRESS_BLOG_SUPABASE_CONFIG || {};
  const status = document.querySelector('#live-status');
  const note = document.querySelector('#connection-note');

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  try{
    if(!config.enabled || !config.url || !config.publishableKey){
      if(status) status.textContent='NOT CONFIGURED';
      if(note) note.textContent='本番Database/Authは未接続です。実コメントデータは読み込まれません。';
      return;
    }
    if(!window.supabase?.createClient){
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0');
    }
    await loadScript('./live-admin.js');
  }catch(error){
    if(status) status.textContent='ERROR';
    if(note) note.textContent=`初期化に失敗しました: ${error.message}`;
  }
})();
