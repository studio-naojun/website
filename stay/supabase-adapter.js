(function(){
  let client=null;
  const config=()=>window.STAY_ATLAS_SUPABASE_CONFIG||{};
  function configured(){const c=config();return c.enabled===true&&/^https:\/\//.test(c.url||'')&&Boolean(c.publishableKey);}
  function getClient(){
    if(!configured())throw new Error('Supabase is not configured');
    if(!window.supabase?.createClient)throw new Error('supabase-js is not loaded');
    if(!client){const c=config();client=window.supabase.createClient(c.url,c.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});}
    return client;
  }
  function dateOnly(value){return value?String(value).slice(0,10):null;}
  function verificationMap(rows){
    const byHotel={};
    (rows||[]).forEach(v=>{
      byHotel[v.hotel_id] ||= {};
      if(byHotel[v.hotel_id][v.field_path])return;
      byHotel[v.hotel_id][v.field_path]={
        label:v.field_path,
        status:v.status,
        source_label:v.source_label||'',
        source_url:v.source_url||'',
        checked_at:dateOnly(v.checked_at),
        note:v.note||'',
        value_snapshot:v.value_snapshot??null
      };
    });
    return byHotel;
  }
  function rowToHotel(row,verifications={}){
    return {
      id:row.id,
      slug:row.slug,
      name_ja:row.name_ja||'',
      name_en:row.name_en||'',
      chain:row.chain||'',
      brand:row.brand||'',
      portfolio:row.portfolio||'',
      status:row.status||'open',
      opening_note:row.opening_note||'',
      official_url:row.official_url||'',
      region:row.region||'',
      prefecture:row.prefecture||'',
      city:row.city||'',
      child:row.child_json||{},
      award:row.award_json||{},
      capacity:row.capacity_json||{},
      facilities:row.facilities_json||{},
      quality:row.quality||'unverified',
      source:{label:row.source_label||'',url:row.source_url||'',last_checked:dateOnly(row.source_last_checked)},
      verifications,
      created_at:row.created_at,
      updated_at:row.updated_at
    };
  }
  function hotelToRecord(h){
    return {
      name_ja:h.name_ja||'',
      name_en:h.name_en||null,
      chain:h.chain||null,
      brand:h.brand||null,
      portfolio:h.portfolio||null,
      status:h.status||'open',
      opening_note:h.opening_note||null,
      official_url:h.official_url||null,
      region:h.region||null,
      prefecture:h.prefecture||null,
      city:h.city||null,
      child_json:h.child||{},
      award_json:h.award||{},
      capacity_json:h.capacity||{},
      facilities_json:h.facilities||{},
      quality:h.quality||'unverified',
      source_label:h.source?.label||null,
      source_url:h.source?.url||null,
      source_last_checked:h.source?.last_checked||null
    };
  }
  async function authState(){
    if(!configured())return{configured:false,user:null,isAdmin:false};
    const {data,error}=await getClient().auth.getUser();
    if(error&&error.name!=='AuthSessionMissingError')throw error;
    const user=data?.user||null;
    return{configured:true,user,isAdmin:user?.app_metadata?.stay_atlas_role==='admin'};
  }
  async function signIn(email,password){
    const {data,error}=await getClient().auth.signInWithPassword({email,password});
    if(error)throw error;
    const user=data?.user||null;
    return{user,isAdmin:user?.app_metadata?.stay_atlas_role==='admin'};
  }
  async function signOut(){const {error}=await getClient().auth.signOut();if(error)throw error;}
  async function loadHotels({admin=false}={}){
    let hotelQuery=getClient().from('hotels').select('*');
    if(!admin)hotelQuery=hotelQuery.in('status',['open','planned']);
    const {data:hotelRows,error:hotelError}=await hotelQuery.order('prefecture',{ascending:true}).order('name_ja',{ascending:true});
    if(hotelError)throw hotelError;
    const {data:checks,error:checkError}=await getClient().from('field_verifications').select('*').order('checked_at',{ascending:false});
    if(checkError)throw checkError;
    const grouped=verificationMap(checks);
    return{schemaVersion:1,datasetVersion:3,curationVersion:null,source:'supabase',hotels:(hotelRows||[]).map(r=>rowToHotel(r,grouped[r.id]||{}))};
  }
  async function loadRevisions(hotelId){
    const {data,error}=await getClient().from('hotel_revisions').select('*').eq('hotel_id',hotelId).order('created_at',{ascending:false});
    if(error)throw error;
    return(data||[]).map(r=>({id:r.id,hotelId:r.hotel_id,action:r.action,note:r.note||'',timestamp:r.created_at,changes:r.changes||[],snapshot:r.snapshot||{}}));
  }
  async function updateHotel(hotelId,hotel,note){
    const {data,error}=await getClient().rpc('update_hotel_record',{p_hotel_id:hotelId,p_record:hotelToRecord(hotel),p_note:note||null});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    return row?rowToHotel(row,hotel.verifications||{}):null;
  }
  async function restoreRevision(revisionId,note){
    const {data,error}=await getClient().rpc('restore_hotel_revision',{p_revision_id:revisionId,p_note:note||null});
    if(error)throw error;
    const row=Array.isArray(data)?data[0]:data;
    return row?rowToHotel(row,{}):null;
  }
  function onAuthStateChange(callback){if(!configured())return{unsubscribe(){}};const{data}=getClient().auth.onAuthStateChange((_event,session)=>callback(session?.user||null));return data.subscription;}
  window.StayAtlasSupabase={configured,getClient,rowToHotel,hotelToRecord,authState,signIn,signOut,loadHotels,loadRevisions,updateHotel,restoreRevision,onAuthStateChange};
})();
