(function(){
  if(!window.StayAtlas||!window.StayAtlasSupabase)return;
  const legacyBootstrap=StayAtlas.bootstrapLegacy.bind(StayAtlas);
  StayAtlas.bootstrapLegacy=async function(){
    if(StayAtlasSupabase.configured()){
      try{return await StayAtlasSupabase.loadHotels({admin:false});}
      catch(error){console.warn('Stay Atlas live data unavailable; using bundled legacy dataset.',error);}
    }
    return legacyBootstrap();
  };
})();
