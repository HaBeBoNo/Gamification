-- Align repo schema with the live Supabase shape without losing existing data.
-- This migration is intentionally additive first, then normalizes legacy columns.

alter table public.member_data
  add column if not exists endorsements jsonb;

alter table public.member_data
  add column if not exists mvp_badge boolean;

alter table public.activity_feed
  add column if not exists category text;

alter table public.activity_feed
  add column if not exists meta jsonb;

alter table public.activity_feed
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.activity_feed
set metadata = coalesce(meta, '{}'::jsonb)
where coalesce(metadata, '{}'::jsonb) = '{}'::jsonb
  and meta is not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'activity_feed'
      and column_name = 'type'
  ) then
    execute $sql$
      update public.activity_feed
      set category = coalesce(category, type)
      where type is not null
        and coalesce(category, '') = ''
    $sql$;

    execute 'alter table public.activity_feed drop column if exists type';
  end if;
end $$;

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

  if witnesses_udt is null then
    execute 'alter table public.activity_feed add column witnesses jsonb not null default ''[]''::jsonb';
  elsif witnesses_udt <> 'jsonb' then
    execute 'alter table public.activity_feed alter column witnesses drop default';
    execute 'alter table public.activity_feed alter column witnesses type jsonb using coalesce(to_jsonb(witnesses), ''[]''::jsonb)';
    execute 'alter table public.activity_feed alter column witnesses set default ''[]''::jsonb';
  end if;
end $$;

update public.activity_feed
set witnesses = '[]'::jsonb
where witnesses is null;

alter table public.activity_feed
  alter column witnesses set default '[]'::jsonb;

alter table public.activity_feed
  alter column witnesses set not null;

alter table public.push_subscriptions
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.sync_activity_feed_witnesses()
returns trigger
language plpgsql
as $$
declare
  target_feed_item_id text := coalesce(new.feed_item_id, old.feed_item_id);
begin
  update public.activity_feed
  set
    witnesses = coalesce((
      select to_jsonb(array_agg(member_key order by created_at, member_key))
      from public.feed_witnesses
      where feed_item_id = target_feed_item_id
    ), '[]'::jsonb),
    updated_at = now()
  where id::text = target_feed_item_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();
