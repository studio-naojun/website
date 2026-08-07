-- Run only after the private archive schema and real comment import are complete.
-- Compare these results with the generated migration-report.json / wp_migration_run.json.

select
  count(*) as comments_total,
  count(*) filter (where wordpress_status = '1') as approved_comments_total,
  count(distinct legacy_comment_id) as distinct_comment_ids,
  count(distinct legacy_post_id) as posts_with_comments,
  coalesce(sum(raw_chars), 0) as comments_raw_chars,
  coalesce(sum(normalized_plain_text_chars), 0) as comments_normalized_plain_text_chars,
  count(*) filter (where normalized_plain_text_sha256 !~ '^[0-9a-f]{64}$') as invalid_hash_rows
from public.wp_legacy_comments;

select
  wordpress_status,
  count(*) as rows
from public.wp_legacy_comments
group by wordpress_status
order by wordpress_status;

select
  coalesce(nullif(comment_type, ''), 'comment') as comment_type,
  count(*) as rows
from public.wp_legacy_comments
group by coalesce(nullif(comment_type, ''), 'comment')
order by comment_type;

select
  legacy_post_id,
  post_slug,
  count(*) as comments_total,
  coalesce(sum(normalized_plain_text_chars), 0) as normalized_plain_text_chars
from public.wp_legacy_comments
group by legacy_post_id, post_slug
order by legacy_post_id;

-- Privacy invariant: the retained schema itself contains no commenter email/IP/User-Agent columns.
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'wp_legacy_comments'
order by ordinal_position;
