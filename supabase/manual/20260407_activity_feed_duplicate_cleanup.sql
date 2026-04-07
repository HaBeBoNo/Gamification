-- Activity feed duplicate cleanup
-- Run this only after reviewing the audit.
-- Scope: top-level activity rows only. Comment rows are intentionally excluded.
-- This script repoints dependent rows before deleting duplicate activity rows.

begin;

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
  count(*) as duplicate_rows_to_delete,
  count(distinct canonical_id) as canonical_groups
from tmp_activity_feed_duplicate_map;

update public.activity_feed child
set
  parent_feed_item_id = map.canonical_id,
  metadata = case
    when coalesce(child.metadata->>'parentFeedItemId', '') = map.duplicate_id
      then jsonb_set(child.metadata, '{parentFeedItemId}', to_jsonb(map.canonical_id), true)
    else child.metadata
  end,
  updated_at = now()
from tmp_activity_feed_duplicate_map map
where child.parent_feed_item_id = map.duplicate_id;

update public.feed_reactions reaction
set feed_item_id = map.canonical_id
from tmp_activity_feed_duplicate_map map
where reaction.feed_item_id = map.duplicate_id
  and not exists (
    select 1
    from public.feed_reactions existing
    where existing.feed_item_id = map.canonical_id
      and existing.member_key = reaction.member_key
      and existing.emoji = reaction.emoji
  );

delete from public.feed_reactions reaction
using tmp_activity_feed_duplicate_map map
where reaction.feed_item_id = map.duplicate_id;

update public.feed_witnesses witness
set feed_item_id = map.canonical_id
from tmp_activity_feed_duplicate_map map
where witness.feed_item_id = map.duplicate_id
  and not exists (
    select 1
    from public.feed_witnesses existing
    where existing.feed_item_id = map.canonical_id
      and existing.member_key = witness.member_key
  );

delete from public.feed_witnesses witness
using tmp_activity_feed_duplicate_map map
where witness.feed_item_id = map.duplicate_id;

update public.notifications notification
set
  feed_item_id = coalesce(
    (
      select map.canonical_id
      from tmp_activity_feed_duplicate_map map
      where map.duplicate_id = notification.feed_item_id
      limit 1
    ),
    notification.feed_item_id
  ),
  payload = (
    with mapped as (
      select
        (
          select map.canonical_id
          from tmp_activity_feed_duplicate_map map
          where map.duplicate_id = coalesce(notification.payload->>'feedItemId', '')
          limit 1
        ) as mapped_feed_item_id,
        (
          select map.canonical_id
          from tmp_activity_feed_duplicate_map map
          where map.duplicate_id = coalesce(notification.payload->>'parentFeedItemId', '')
          limit 1
        ) as mapped_parent_feed_item_id
    ),
    step_one as (
      select
        case
          when mapped.mapped_feed_item_id is not null
            then jsonb_set(notification.payload, '{feedItemId}', to_jsonb(mapped.mapped_feed_item_id), true)
          else notification.payload
        end as payload_value,
        mapped.mapped_parent_feed_item_id
      from mapped
    )
    select
      case
        when step_one.mapped_parent_feed_item_id is not null
          then jsonb_set(step_one.payload_value, '{parentFeedItemId}', to_jsonb(step_one.mapped_parent_feed_item_id), true)
        else step_one.payload_value
      end
    from step_one
  ),
  updated_at = now()
where notification.feed_item_id in (
    select duplicate_id from tmp_activity_feed_duplicate_map
  )
   or coalesce(notification.payload->>'feedItemId', '') in (
    select duplicate_id from tmp_activity_feed_duplicate_map
  )
   or coalesce(notification.payload->>'parentFeedItemId', '') in (
    select duplicate_id from tmp_activity_feed_duplicate_map
  );

drop table if exists tmp_duplicate_notification_ids;

create temporary table tmp_duplicate_notification_ids as
with ranked as (
  select
    notification.id,
    row_number() over (
      partition by
        notification.member_key,
        coalesce(notification.actor_member_key, ''),
        notification.type,
        coalesce(notification.feed_item_id, ''),
        coalesce(notification.body, ''),
        coalesce(notification.payload->>'emoji', ''),
        coalesce(notification.payload->>'feedEventId', ''),
        date_trunc('second', notification.created_at)
      order by coalesce(notification.read, false) asc, notification.created_at asc, notification.id asc
    ) as row_number_in_group
  from public.notifications notification
  where notification.feed_item_id in (
      select canonical_id from tmp_activity_feed_duplicate_map
      union
      select duplicate_id from tmp_activity_feed_duplicate_map
    )
     or coalesce(notification.payload->>'feedItemId', '') in (
      select canonical_id from tmp_activity_feed_duplicate_map
      union
      select duplicate_id from tmp_activity_feed_duplicate_map
    )
     or coalesce(notification.payload->>'parentFeedItemId', '') in (
      select canonical_id from tmp_activity_feed_duplicate_map
      union
      select duplicate_id from tmp_activity_feed_duplicate_map
    )
)
select id
from ranked
where row_number_in_group > 1;

delete from public.notifications notification
using tmp_duplicate_notification_ids duplicate_notification
where notification.id = duplicate_notification.id;

do $$
declare
  witnesses_udt text;
begin
  select columns.udt_name
  into witnesses_udt
  from information_schema.columns columns
  where columns.table_schema = 'public'
    and columns.table_name = 'activity_feed'
    and columns.column_name = 'witnesses'
  limit 1;

  if witnesses_udt = 'jsonb' then
    execute $sql$
      update public.activity_feed canonical
      set
        reactions = coalesce((
          select jsonb_object_agg(reaction_group.emoji, to_jsonb(reaction_group.members))
          from (
            select
              reaction.emoji,
              array_agg(reaction.member_key order by reaction.created_at, reaction.member_key) as members
            from public.feed_reactions reaction
            where reaction.feed_item_id = canonical.id::text
            group by reaction.emoji
          ) as reaction_group
        ), '{}'::jsonb),
        witnesses = coalesce((
          select to_jsonb(array_agg(witness.member_key order by witness.created_at, witness.member_key))
          from public.feed_witnesses witness
          where witness.feed_item_id = canonical.id::text
        ), '[]'::jsonb),
        updated_at = now()
      where canonical.id::text in (
        select distinct canonical_id
        from tmp_activity_feed_duplicate_map
      )
    $sql$;
  else
    execute $sql$
      update public.activity_feed canonical
      set
        reactions = coalesce((
          select jsonb_object_agg(reaction_group.emoji, to_jsonb(reaction_group.members))
          from (
            select
              reaction.emoji,
              array_agg(reaction.member_key order by reaction.created_at, reaction.member_key) as members
            from public.feed_reactions reaction
            where reaction.feed_item_id = canonical.id::text
            group by reaction.emoji
          ) as reaction_group
        ), '{}'::jsonb),
        witnesses = coalesce((
          select array_agg(witness.member_key order by witness.created_at, witness.member_key)
          from public.feed_witnesses witness
          where witness.feed_item_id = canonical.id::text
        ), '{}'::text[]),
        updated_at = now()
      where canonical.id::text in (
        select distinct canonical_id
        from tmp_activity_feed_duplicate_map
      )
    $sql$;
  end if;
end $$;

delete from public.activity_feed activity
using tmp_activity_feed_duplicate_map map
where activity.id::text = map.duplicate_id;

commit;
