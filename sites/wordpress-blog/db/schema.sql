-- u2memo Private Archive schema
-- Target: the existing Naojun / Stay Atlas Supabase project, logically isolated.
-- Repository definition only until explicitly applied to the selected production project.
-- Real WordPress exports and private comment bundles must never be committed here.

create table if not exists public.u2memo_legacy_comments (
  legacy_comment_id bigint primary key,
  legacy_post_id bigint not null,
  post_slug text not null,
  parent_legacy_comment_id bigint,
  author_display_name text not null default '',
  comment_body text not null,
  legacy_secret boolean,
  created_at timestamp without time zone,
  created_at_gmt timestamp without time zone,
  wordpress_status text,
  comment_type text,
  raw_chars bigint not null default 0,
  normalized_plain_text_chars bigint not null default 0,
  normalized_plain_text_sha256 text not null,
  imported_at timestamptz not null default now(),
  constraint u2memo_legacy_comments_sha256_format
    check (normalized_plain_text_sha256 ~ '^[0-9a-f]{64}$')
);

comment on table public.u2memo_legacy_comments is
  'Private archive of migrated pocca.net/u2memo comments. No anonymous/public read policy.';

create index if not exists u2memo_legacy_comments_post_slug_idx
  on public.u2memo_legacy_comments (post_slug);
create index if not exists u2memo_legacy_comments_legacy_post_id_idx
  on public.u2memo_legacy_comments (legacy_post_id);
create index if not exists u2memo_legacy_comments_created_at_idx
  on public.u2memo_legacy_comments (created_at desc);

alter table public.u2memo_legacy_comments enable row level security;

revoke all on table public.u2memo_legacy_comments from anon;
revoke all on table public.u2memo_legacy_comments from authenticated;
grant select on table public.u2memo_legacy_comments to authenticated;

drop policy if exists "u2memo archive admin can read legacy comments" on public.u2memo_legacy_comments;
create policy "u2memo archive admin can read legacy comments"
on public.u2memo_legacy_comments
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'u2memo_archive_role') = 'admin');

create table if not exists public.u2memo_migration_runs (
  id bigint generated always as identity primary key,
  source_name text not null,
  source_sha256 text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  source_posts_total bigint,
  source_pages_total bigint,
  source_attachments_total bigint,
  source_comments_total bigint,
  source_approved_comments_total bigint,
  imported_posts_total bigint,
  imported_pages_total bigint,
  imported_comments_total bigint,
  source_content_raw_chars bigint,
  source_content_normalized_plain_text_chars bigint,
  source_comments_raw_chars bigint,
  source_comments_normalized_plain_text_chars bigint,
  warning_count bigint not null default 0,
  verified boolean not null default false,
  verification_note text
);

alter table public.u2memo_migration_runs enable row level security;

revoke all on table public.u2memo_migration_runs from anon;
revoke all on table public.u2memo_migration_runs from authenticated;
grant select on table public.u2memo_migration_runs to authenticated;

drop policy if exists "u2memo archive admin can read migration runs" on public.u2memo_migration_runs;
create policy "u2memo archive admin can read migration runs"
on public.u2memo_migration_runs
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'u2memo_archive_role') = 'admin');

-- There is intentionally no authenticated INSERT/UPDATE/DELETE policy.
-- Initial migration writes are performed only from a trusted server-side/admin path,
-- never from browser JavaScript.
--
-- Intentionally omitted from the archive schema:
-- commenter email, IP address, User-Agent, legacy PASS values/password hashes, and
-- other private WordPress fields that are not required for the retained archive purpose.
