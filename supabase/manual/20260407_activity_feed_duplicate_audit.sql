-- Activity feed duplicate audit
-- Run this first in Supabase SQL Editor.
-- Scope: top-level activity rows only. Comment rows are intentionally excluded.

drop table if exists tmp_activity_feed_duplicate_map;

create temporary table tmp_activity_feed_duplicate_map as
with ranked as (
  select
    id::text as feed_id,
    first_value(id::text) over activity_group as canonical_id,
    row_number() over activity_group as row_number_in_group,
    count(*) over activity_group as group_size,
    who,
    action,
    xp,
    date_trunc('second', created_at) as created_second
  from public.activity_feed
  where coalesce(interaction_type, 'activity') = 'activity'
    and coalesce(parent_feed_item_id, '') = ''
  window activity_group as (
    partition by who, action, xp, date_trunc('second', created_at)
    order by created_at asc, id asc
  )
)
select
  canonical_id,
  feed_id as duplicate_id,
  group_size,
  who,
  action,
  xp,
  created_second
from ranked
where row_number_in_group > 1;

select
  count(*) as duplicate_rows,
  count(distinct canonical_id) as duplicate_groups
from tmp_activity_feed_duplicate_map;

select
  canonical_id,
  group_size,
  who,
  action,
  xp,
  created_second,
  array_agg(duplicate_id order by duplicate_id) as duplicate_ids
from tmp_activity_feed_duplicate_map
group by canonical_id, group_size, who, action, xp, created_second
order by created_second desc, group_size desc, who asc
limit 100;

select
  (select count(*)
   from public.activity_feed child
   join tmp_activity_feed_duplicate_map map
     on child.parent_feed_item_id = map.duplicate_id) as comment_links_to_repoint,
  (select count(*)
   from public.feed_reactions reaction
   join tmp_activity_feed_duplicate_map map
     on reaction.feed_item_id = map.duplicate_id) as reaction_links_to_repoint,
  (select count(*)
   from public.feed_witnesses witness
   join tmp_activity_feed_duplicate_map map
     on witness.feed_item_id = map.duplicate_id) as witness_links_to_repoint,
  (select count(*)
   from public.notifications notification
   join tmp_activity_feed_duplicate_map map
     on notification.feed_item_id = map.duplicate_id
     or coalesce(notification.payload->>'feedItemId', '') = map.duplicate_id
     or coalesce(notification.payload->>'parentFeedItemId', '') = map.duplicate_id) as notification_links_to_repoint;
