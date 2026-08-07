-- Stay Atlas live admin RPCs
-- Apply after schema.sql.

create or replace function public.update_hotel_record(
  p_hotel_id uuid,
  p_record jsonb,
  p_note text default null
)
returns public.hotels
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_result public.hotels%rowtype;
  v_name_ja text;
begin
  if not stay_atlas_private.is_admin() then
    raise exception 'Stay Atlas administrator role required' using errcode = '42501';
  end if;

  v_name_ja := nullif(btrim(p_record ->> 'name_ja'), '');
  if v_name_ja is null then
    raise exception 'name_ja is required' using errcode = '23502';
  end if;

  perform set_config('stay_atlas.revision_action', 'edit', true);
  perform set_config(
    'stay_atlas.revision_note',
    coalesce(nullif(btrim(p_note), ''), 'Live Admin edit'),
    true
  );

  update public.hotels h
  set
    name_ja = v_name_ja,
    name_en = nullif(p_record ->> 'name_en', ''),
    chain = nullif(p_record ->> 'chain', ''),
    brand = nullif(p_record ->> 'brand', ''),
    portfolio = nullif(p_record ->> 'portfolio', ''),
    status = coalesce(nullif(p_record ->> 'status', ''), h.status),
    opening_note = nullif(p_record ->> 'opening_note', ''),
    official_url = nullif(p_record ->> 'official_url', ''),
    region = nullif(p_record ->> 'region', ''),
    prefecture = nullif(p_record ->> 'prefecture', ''),
    city = nullif(p_record ->> 'city', ''),
    child_json = coalesce(p_record -> 'child_json', '{}'::jsonb),
    award_json = coalesce(p_record -> 'award_json', '{}'::jsonb),
    capacity_json = coalesce(p_record -> 'capacity_json', '{}'::jsonb),
    facilities_json = coalesce(p_record -> 'facilities_json', '{}'::jsonb),
    quality = coalesce(nullif(p_record ->> 'quality', ''), h.quality),
    source_label = nullif(p_record ->> 'source_label', ''),
    source_url = nullif(p_record ->> 'source_url', ''),
    source_last_checked = nullif(p_record ->> 'source_last_checked', '')::date
  where h.id = p_hotel_id
  returning h.* into v_result;

  if not found then
    raise exception 'Hotel not found' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.update_hotel_record(uuid,jsonb,text) from public;
grant execute on function public.update_hotel_record(uuid,jsonb,text) to authenticated;
