-- NaoJun Stay Atlas v1 production persistence schema
-- Target: PostgreSQL / Supabase-compatible SQL

create extension if not exists pgcrypto;

create table if not exists hotels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ja text not null,
  name_en text,
  chain text,
  brand text,
  portfolio text,
  status text not null default 'open' check (status in ('open','planned','closed','hidden')),
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

create index if not exists hotels_prefecture_idx on hotels(prefecture);
create index if not exists hotels_region_idx on hotels(region);
create index if not exists hotels_chain_idx on hotels(chain);
create index if not exists hotels_quality_idx on hotels(quality);
create index if not exists hotels_status_idx on hotels(status);

create table if not exists hotel_revisions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
  action text not null check (action in ('create','edit','restore','import','verify','hide')),
  snapshot jsonb not null,
  changes jsonb not null default '[]'::jsonb,
  note text,
  actor_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists hotel_revisions_hotel_created_idx on hotel_revisions(hotel_id,created_at desc);

create table if not exists field_verifications (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references hotels(id) on delete cascade,
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

create index if not exists field_verifications_hotel_field_idx on field_verifications(hotel_id,field_path,checked_at desc);

create table if not exists change_candidates (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
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

create index if not exists change_candidates_pending_idx on change_candidates(status,detected_at desc);

create table if not exists refresh_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','success','partial','failed')),
  checked_count integer not null default 0,
  candidate_count integer not null default 0,
  error_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb
);

-- Public clients should receive only published hotel data.
create or replace view public_hotels as
select * from hotels where status in ('open','planned');

-- Rollback policy: never delete or rewrite revision history.
-- A restore operation must first insert the current hotel snapshot into hotel_revisions,
-- then copy the selected historical snapshot into hotels as a new current state.
