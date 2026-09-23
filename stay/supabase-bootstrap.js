(function(){
  function getPath(obj,path){return String(path||'').split('.').reduce((v,k)=>v==null?undefined:v[k],obj);}
  async function bootstrapFromPreview(previewDb){
    const hotels=previewDb?.hotels||[];
    if(!hotels.length)throw new Error('Preview dataset is empty');
    const adapter=window.StayAtlasSupabase;
    if(!adapter?.configured())throw new Error('Supabase is not configured');
    const client=adapter.getClient();
    const {data:existing,error:existingError}=await client.from('hotels').select('id').limit(1);
    if(existingError)throw existingError;
    if(existing?.length)throw new Error('Live database already contains hotels; bootstrap is intentionally one-time only');

    const rows=hotels.map(h=>({slug:h.slug||h.id,...adapter.hotelToRecord(h)}));
    const {data:inserted,error:insertError}=await client.from('hotels').insert(rows).select('id,slug');
    if(insertError)throw insertError;
    const idBySlug=new Map((inserted||[]).map(r=>[r.slug,r.id]));
    const checks=[];
    hotels.forEach(h=>{
      const hotelId=idBySlug.get(h.slug||h.id);
      if(!hotelId)return;
      Object.entries(h.verifications||{}).forEach(([fieldPath,v])=>checks.push({
        hotel_id:hotelId,
        field_path:fieldPath,
        value_snapshot:v.value_snapshot??getPath(h,fieldPath)??null,
        status:v.status||'unverified',
        source_label:v.source_label||null,
        source_url:v.source_url||null,
        checked_at:v.checked_at||null,
        note:v.note||null
      }));
    });
    if(checks.length){const {error}=await client.from('field_verifications').insert(checks);if(error)throw error;}
    return{hotelCount:inserted?.length||0,verificationCount:checks.length};
  }
  window.StayAtlasSupabaseBootstrap={bootstrapFromPreview};
})();
