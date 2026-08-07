-- NaoJun Stay Atlas v1 production persistence schema
-- Target: PostgreSQL / Supabase-compatible SQL
--
-- Security model:
-- - anonymous/public users can read only open/planned hotel rows and their verification records
-- - authenticated users are NOT administrators by default
-- - administrators require app_metadata.stay_atlas_role = "admin"
-- - all direct hotel updates automatically preserve the previous row in hotel_revisions
-- - restore creates a new revision event; history is never rewritten by the restore RPC

create extension if not exists pgcrypto;
create schema if not exists stay_atlas_private;

create table if not exists public.hotels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ja text not null,
  name_en text,
  chain text,
  brand text,
  portfolio text,
  status text not null default 'open' check (status in ('open','planned','closed','hidden')),
  opening_note text,
  official_url text,
  region text,
  prefecture text,
  city text,
  child_json jsonb not null default '{}'::jsonb,
  award_json jsonb not null default '{}'::jsonb,
  capacity_json jsonb not null default '{}'::jsonb,
  facilities_json jsonb not null default '{}'::jsonb,
  quality text not null default 'unverified' check (quality in ('verified','unverified','needs_review','missing','conflicting')),
  source_label text,
  source_url text,
  source_last_checked date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists hotels_prefecture_idx on public.hotels(prefecture);
create index if not exists hotels_region_idx on public.hotels(region);
create index if not exists hotels_chain_idx on public.hotels(chain);
create index if not exists hotels_quality_idx on public.hotels(quality);
create index if not exists hotels_status_idx on public.hotels(status);

create table if not exists public.hotel_revisions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  action text not null check (action in ('create','edit','restore','import','verify','hide')),
  snapshot jsonb not null,
  changes jsonb not null default '[]'::jsonb,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists hotel_revisions_hotel_created_idx on public.hotel_revisions(hotel_id,created_at desc);

create table if not exists public.field_verifications (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotels(id) on delete cascade,
  field_path text not null,
  value_snapshot jsonb,
  status text not null default 'unverified' check (status in ('verified','unverified','needs_review','conflicting')),
  source_label text,
  source_url text,
  checked_at timestamptz,
  checked_by uuid,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists field_verifications_hotel_field_idx on public.field_verifications(hotel_id,field_path,checked_at desc);

create table if not exists public.change_candidates (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references public.hotels(id) on delete cascade,
  field_path text not null,
  current_value jsonb,
  candidate_value jsonb,
  source_url text,
  detected_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','approved','rejected','superseded')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  note text
);

create index if not exists change_candidates_pending_idx on public.change_candidates(status,detected_at desc);

create table if not exists public.refresh_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  checked_count integer not null default 0,
  candidate_count integer not null default 0,
  error_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb
);

-- Keep authorization out of user-editable metadata. An administrator is an authenticated
-- user whose JWT app_metadata contains { "stay_atlas_role": "admin" }.
create or replace function stay_atlas_private.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'stay_atlas_role') = 'admin', false);
$$;

revoke all on schema stay_atlas_private from public;
grant usage on schema stay_atlas_private to authenticated;
revoke all on function stay_atlas_private.is_admin() from public;
grant execute on function stay_atlas_private.is_admin() to authenticated;

-- Top-level database diff. Application revisions may additionally keep finer JSON-path changes.
create or replace function stay_atlas_private.jsonb_diff(p_before jsonb, p_after jsonb)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'path', keys.key,
        'before', p_before -> keys.key,
        'after', p_after -> keys.key
      )
      order by keys.key
    ),
    '[]'::jsonb
  )
  from jsonb_object_keys(coalesce(p_before, '{}'::jsonb) || coalesce(p_after, '{}'::jsonb)) as keys(key)
  where (p_before -> keys.key) is distinct from (p_after -> keys.key);
$$;

revoke all on function stay_atlas_private.jsonb_diff(jsonb,jsonb) from public;

-- Every direct UPDATE preserves OLD before changing the current row. The restore RPC sets
-- transaction-local revision context so the trigger records action=restore instead of edit.
-- Trigger functions use SECURITY DEFINER so private revision helpers and revision inserts do
-- not need to be exposed to browser roles; RLS on hotels still authorizes the originating write.
create or replace function stay_atlas_private.capture_hotel_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action text;
  v_note text;
begin
  if to_jsonb(old) is not distinct from to_jsonb(new) then
    return new;
  end if;

  v_action := coalesce(nullif(current_setting('stay_atlas.revision_action', true), ''), 'edit');
  if v_action not in ('edit','restore','import','verify','hide') then
    v_action := 'edit';
  end if;
  v_note := nullif(current_setting('stay_atlas.revision_note', true), '');

  insert into public.hotel_revisions(hotel_id, action, snapshot, changes, note, actor_id)
  values (
    old.id,
    v_action,
    to_jsonb(old),
    stay_atlas_private.jsonb_diff(to_jsonb(old), to_jsonb(new)),
    v_note,
    auth.uid()
  );

  new.updated_at := now();
  return new;
end;
$$;

create or replace function stay_atlas_private.capture_hotel_create_revision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.hotel_revisions(hotel_id, action, snapshot, changes, note, actor_id)
  values (
    new.id,
    'create',
    to_jsonb(new),
    jsonb_build_array(jsonb_build_object('path','*','before',null,'after',to_jsonb(new))),
    'Initial record',
    auth.uid()
  );
  return new;
end;
$$;

revoke all on function stay_atlas_private.capture_hotel_revision() from public;
revoke all on function stay_atlas_private.capture_hotel_create_revision() from public;

drop trigger if exists hotels_capture_revision_before_update on public.hotels;
create trigger hotels_capture_revision_before_update
before update on public.hotels
for each row execute function stay_atlas_private.capture_hotel_revision();

drop trigger if exists hotels_capture_revision_after_insert on public.hotels;
create trigger hotels_capture_revision_after_insert
after insert on public.hotels
for each row execute function stay_atlas_private.capture_hotel_create_revision();

-- RLS: direct browser access is safe only when these policies remain enabled.
alter table public.hotels enable row level security;
alter table public.hotel_revisions enable row level security;
alter table public.field_verifications enable row level security;
alter table public.change_candidates enable row level security;
alter table public.refresh_runs enable row level security;

drop policy if exists hotels_public_read on public.hotels;
create policy hotels_public_read
on public.hotels for select
to anon, authenticated
using (status in ('open','planned'));

drop policy if exists hotels_admin_read_all on public.hotels;
create policy hotels_admin_read_all
on public.hotels for select
to authenticated
using (stay_atlas_private.is_admin());

drop policy if exists hotels_admin_insert on public.hotels;
create policy hotels_admin_insert
on public.hotels for insert
to authenticated
with check (stay_atlas_private.is_admin());

drop policy if exists hotels_admin_update on public.hotels;
create policy hotels_admin_update
on public.hotels for update
to authenticated
using (stay_atlas_private.is_admin())
with check (stay_atlas_private.is_admin());

drop policy if exists hotels_admin_delete on public.hotels;
create policy hotels_admin_delete
on public.hotels for delete
to authenticated
using (stay_atlas_private.is_admin());

drop policy if exists revisions_admin_read on public.hotel_revisions;
create policy revisions_admin_read
on public.hotel_revisions for select
to authenticated
using (stay_atlas_private.is_admin());

drop policy if exists revisions_admin_insert on public.hotel_revisions;
create policy revisions_admin_insert
on public.hotel_revisions for insert
to authenticated
with check (stay_atlas_private.is_admin());

-- No UPDATE/DELETE policy is intentionally created for hotel_revisions.

drop policy if exists verifications_public_read on public.field_verifications;
create policy verifications_public_read
on public.field_verifications for select
to anon, authenticated
using (
  exists (
    select 1 from public.hotels h
    where h.id = field_verifications.hotel_id
      and h.status in ('open','planned')
  )
);

drop policy if exists verifications_admin_read_all on public.field_verifications;
create policy verifications_admin_read_all
on public.field_verifications for select
to authenticated
using (stay_atlas_private.is_admin());

drop policy if exists verifications_admin_insert on public.field_verifications;
create policy verifications_admin_insert
on public.field_verifications for insert
to authenticated
with check (stay_atlas_private.is_admin());

drop policy if exists verifications_admin_update on public.field_verifications;
create policy verifications_admin_update
on public.field_verifications for update
to authenticated
using (stay_atlas_private.is_admin())
with check (stay_atlas_private.is_admin());

drop policy if exists verifications_admin_delete on public.field_verifications;
create policy verifications_admin_delete
on public.field_verifications for delete
to authenticated
using (stay_atlas_private.is_admin());

drop policy if exists candidates_admin_all on public.change_candidates;
create policy candidates_admin_all
on public.change_candidates for all
to authenticated
using (stay_atlas_private.is_admin())
with check (stay_atlas_private.is_admin());

drop policy if exists refresh_runs_admin_all on public.refresh_runs;
create policy refresh_runs_admin_all
on public.refresh_runs for all
to authenticated
using (stay_atlas_private.is_admin())
with check (stay_atlas_private.is_admin());

-- A security-invoker view keeps the convenience of a public endpoint while preserving
-- hotels RLS. Do not replace this with a default security-definer view.
drop view if exists public.public_hotels;
create view public.public_hotels with (security_invoker = true) as
select * from public.hotels where status in ('open','planned');

-- Restore a historical hotel snapshot. The UPDATE trigger records the current row as a new
-- restore revision before the historical snapshot becomes current.
create or replace function public.restore_hotel_revision(p_revision_id uuid, p_note text default null)
returns public.hotels
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision public.hotel_revisions%rowtype;
  v_snapshot jsonb;
  v_result public.hotels%rowtype;
begin
  if not stay_atlas_private.is_admin() then
    raise exception 'Stay Atlas administrator role required' using errcode = '42501';
  end if;

  select * into v_revision
  from public.hotel_revisions
  where id = p_revision_id;

  if not found then
    raise exception 'Revision not found' using errcode = 'P0002';
  end if;

  v_snapshot := v_revision.snapshot;
  perform set_config('stay_atlas.revision_action', 'restore', true);
  perform set_config(
    'stay_atlas.revision_note',
    coalesce(p_note, 'Restore from revision ' || p_revision_id::text),
    true
  );

  update public.hotels h
  set
    slug = v_snapshot ->> 'slug',
    name_ja = v_snapshot ->> 'name_ja',
    name_en = v_snapshot ->> 'name_en',
    chain = v_snapshot ->> 'chain',
    brand = v_snapshot ->> 'brand',
    portfolio = v_snapshot ->> 'portfolio',
    status = v_snapshot ->> 'status',
    opening_note = v_snapshot ->> 'opening_note',
    official_url = v_snapshot ->> 'official_url',
    region = v_snapshot ->> 'region',
    prefecture = v_snapshot ->> 'prefecture',
    city = v_snapshot ->> 'city',
    child_json = coalesce(v_snapshot -> 'child_json', '{}'::jsonb),
    award_json = coalesce(v_snapshot -> 'award_json', '{}'::jsonb),
    capacity_json = coalesce(v_snapshot -> 'capacity_json', '{}'::jsonb),
    facilities_json = coalesce(v_snapshot -> 'facilities_json', '{}'::jsonb),
    quality = v_snapshot ->> 'quality',
    source_label = v_snapshot ->> 'source_label',
    source_url = v_snapshot ->> 'source_url',
    source_last_checked = nullif(v_snapshot ->> 'source_last_checked', '')::date,
    updated_at = now()
  where h.id = v_revision.hotel_id
  returning h.* into v_result;

  if not found then
    raise exception 'Hotel for revision not found' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.restore_hotel_revision(uuid,text) from public;
grant execute on function public.restore_hotel_revision(uuid,text) to authenticated;

-- Explicit API grants. RLS remains the final authorization boundary.
grant select on public.hotels, public.public_hotels, public.field_verifications to anon, authenticated;
grant insert, update, delete on public.hotels to authenticated;
grant select, insert on public.hotel_revisions to authenticated;
grant insert, update, delete on public.field_verifications to authenticated;
grant select, insert, update, delete on public.change_candidates, public.refresh_runs to authenticated;
revoke all on public.hotel_revisions, public.change_candidates, public.refresh_runs from anon;

-- Verification policy:
-- each field_verifications row records one field/value/source/check event.
-- Conflicting sources remain explicit; do not silently select a winner.
--
-- Rollback policy:
-- never delete or rewrite revision history. restore_hotel_revision() updates the current hotel
-- only after the trigger has recorded the pre-restore state as a new revision.