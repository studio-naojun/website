(async function(){
  function loadScript(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.body.appendChild(s);});}
  try{
    if(window.StayAtlasSupabase?.configured()&&!window.supabase?.createClient){
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0');
    }
    await loadScript('./live-admin.js');
  }catch(error){
    const status=document.querySelector('#liveStatus');
    const note=document.querySelector('#connectionNote');
    if(status)status.textContent='ERROR';
    if(note)note.textContent=`Live Adminの初期化に失敗しました: ${error.message}`;
  }
})();
