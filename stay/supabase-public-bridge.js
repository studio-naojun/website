(function(){
  if(!window.StayAtlas||!window.StayAtlasSupabase)return;
  const legacyBootstrap=StayAtlas.bootstrapLegacy.bind(StayAtlas);
  let libraryPromise=null;
  function ensureSupabaseLibrary(){
    if(window.supabase?.createClient)return Promise.resolve();
    if(libraryPromise)return libraryPromise;
    libraryPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.111.0';
      script.onload=()=>resolve();
      script.onerror=()=>reject(new Error('Failed to load supabase-js'));
      document.head.appendChild(script);
    });
    return libraryPromise;
  }
  StayAtlas.bootstrapLegacy=async function(){
    if(StayAtlasSupabase.configured()){
      try{
        await ensureSupabaseLibrary();
        const live=await StayAtlasSupabase.loadHotels({admin:false});
        if(live.hotels?.length)return live;
        console.warn('Stay Atlas live database is empty; using bundled legacy dataset until bootstrap completes.');
      }catch(error){console.warn('Stay Atlas live data unavailable; using bundled legacy dataset.',error);}
    }
    return legacyBootstrap();
  };
})();
