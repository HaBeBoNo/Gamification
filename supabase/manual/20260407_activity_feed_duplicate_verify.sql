-- Activity feed duplicate verification
-- Run this after the cleanup script.

drop table if exists tmp_activity_feed_duplicate_map;

create temporary table tmp_activity_feed_duplicate_map as
with ranked as (
  select
    id::text as feed_id,
    first_value(id::text) over activity_group as canonical_id,
    row_number() over activity_group as row_number_in_group
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
  feed_id as duplicate_id
from ranked
where row_number_in_group > 1;

select
  count(*) as duplicate_rows_remaining,
  count(distinct canonical_id) as duplicate_groups_remaining
from tmp_activity_feed_duplicate_map;

select
  (select count(*)
   from public.activity_feed child
   where coalesce(child.parent_feed_item_id, '') <> ''
     and not exists (
       select 1
       from public.activity_feed parent
       where parent.id::text = child.parent_feed_item_id
     )) as orphaned_comment_links,
  (select count(*)
   from public.feed_reactions reaction
   where not exists (
     select 1
     from public.activity_feed activity
     where activity.id::text = reaction.feed_item_id
   )) as orphaned_reaction_links,
  (select count(*)
   from public.feed_witnesses witness
   where not exists (
     select 1
     from public.activity_feed activity
     where activity.id::text = witness.feed_item_id
   )) as orphaned_witness_links,
  (select count(*)
   from public.notifications notification
   where coalesce(notification.feed_item_id, '') <> ''
     and not exists (
       select 1
       from public.activity_feed activity
       where activity.id::text = notification.feed_item_id
     )) as orphaned_notification_links;

select
  id,
  who,
  action,
  xp,
  created_at
from public.activity_feed
order by created_at desc
limit 25;
