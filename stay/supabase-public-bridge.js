(function(){
  if(!window.StayAtlas||!window.StayAtlasSupabase)return;
  const legacyBootstrap=StayAtlas.bootstrapLegacy.bind(StayAtlas);
  const debugEnabled=new URLSearchParams(location.search).get('debug')==='1';
  let libraryPromise=null;

  function errorSummary(error){
    if(!error)return null;
    return {
      name:error.name||'',
      message:error.message||String(error),
      code:error.code||'',
      details:error.details||'',
      hint:error.hint||'',
      status:error.status||''
    };
  }

  function publishDiagnostic(state){
    const diagnostic={at:new Date().toISOString(),...state};
    window.STAY_ATLAS_PUBLIC_DIAGNOSTIC=diagnostic;
    if(!debugEnabled)return;
    const render=()=>{
      let panel=document.getElementById('stayAtlasDebug');
      if(!panel){
        panel=document.createElement('pre');
        panel.id='stayAtlasDebug';
        panel.setAttribute('role','status');
        Object.assign(panel.style,{position:'fixed',left:'12px',right:'12px',bottom:'12px',zIndex:'99999',maxHeight:'42vh',overflow:'auto',margin:'0',padding:'12px',background:'rgba(0,0,0,.92)',color:'#fff',font:'12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace',whiteSpace:'pre-wrap',borderRadius:'8px'});
        document.body.appendChild(panel);
      }
      panel.textContent='Stay Atlas public diagnostic\n'+JSON.stringify(diagnostic,null,2);
    };
    if(document.body)render();else window.addEventListener('DOMContentLoaded',render,{once:true});
  }

  function ensureSupabaseLibrary(){
    if(window.supabase?.createClient)return Promise.resolve();
    if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
      script.onload=()=>window.supabase?.createClient?resolve():reject(new Error('supabase-js loaded but createClient is unavailable'));
      script.onerror=()=>reject(new Error('Failed to load supabase-js from jsDelivr'));
      document.head.appendChild(script);
    });
    return libraryPromise;
  }

  StayAtlas.bootstrapLegacy=async function(){
    if(StayAtlasSupabase.configured()){
      try{
        publishDiagnostic({stage:'loading-supabase',configured:true,supabaseGlobal:Boolean(window.supabase?.createClient)});
        await ensureSupabaseLibrary();
        const live=await StayAtlasSupabase.loadHotels({admin:false});
        if(live.hotels?.length){
          publishDiagnostic({stage:'complete',source:'supabase',configured:true,hotelCount:live.hotels.length,supabaseGlobal:true});
          return live;
        }
        console.warn('Stay Atlas live database is empty; using bundled legacy dataset until bootstrap completes.');
        const bundled=await legacyBootstrap();
        publishDiagnostic({stage:'complete',source:'bundled',reason:'live-empty',configured:true,hotelCount:bundled.hotels?.length||0,supabaseGlobal:true});
        return bundled;
      }catch(error){
        console.warn('Stay Atlas live data unavailable; using bundled legacy dataset.',error);
        const bundled=await legacyBootstrap();
        publishDiagnostic({stage:'complete',source:'bundled',reason:'live-error',configured:true,hotelCount:bundled.hotels?.length||0,supabaseGlobal:Boolean(window.supabase?.createClient),error:errorSummary(error)});
        return bundled;
      }
    }
    const bundled=await legacyBootstrap();
    publishDiagnostic({stage:'complete',source:'bundled',reason:'not-configured',configured:false,hotelCount:bundled.hotels?.length||0,supabaseGlobal:Boolean(window.supabase?.createClient)});
    return bundled;
  };
})();
