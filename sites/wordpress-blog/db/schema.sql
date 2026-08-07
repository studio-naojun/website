-- WordPress Blog Private Archive prototype schema
-- Phase 1 only: repository definition. Do not treat this file as applied production state.

create table if not exists public.wp_legacy_comments (
  legacy_comment_id bigint primary key,
  legacy_post_id bigint not null,
  post_slug text not null,
  parent_legacy_comment_id bigint,
  author_display_name text not null default '',
  comment_body text not null,
  created_at timestamptz,
  wordpress_status text,
  imported_at timestamptz not null default now()
);

comment on table public.wp_legacy_comments is
  'Private archive of migrated WordPress comments. No public read policy.';

alter table public.wp_legacy_comments enable row level security;

revoke all on table public.wp_legacy_comments from anon;
revoke all on table public.wp_legacy_comments from authenticated;
grant select on table public.wp_legacy_comments to authenticated;

create policy "wordpress blog admin can read legacy comments"
on public.wp_legacy_comments
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'wordpress_blog_role') = 'admin');

create table if not exists public.wp_migration_runs (
  id bigint generated always as identity primary key,
  source_name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  source_posts_total bigint,
  source_pages_total bigint,
  source_comments_total bigint,
  source_approved_comments_total bigint,
  imported_posts_total bigint,
  imported_pages_total bigint,
  imported_comments_total bigint,
  source_raw_content_chars bigint,
  imported_normalized_plain_text_chars bigint,
  verified boolean not null default false,
  verification_note text
);

alter table public.wp_migration_runs enable row level security;

revoke all on table public.wp_migration_runs from anon;
revoke all on table public.wp_migration_runs from authenticated;
grant select on table public.wp_migration_runs to authenticated;

create policy "wordpress blog admin can read migration runs"
on public.wp_migration_runs
for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'wordpress_blog_role') = 'admin');

-- Intentionally omitted from the archive schema:
-- comment author email, IP address, User-Agent, password hashes, or other private
-- WordPress fields that are not required for the retained archive purpose.
