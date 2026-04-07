create extension if not exists pgcrypto;

create or replace function public.current_member_key()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select member_key
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.activity_feed (
  id uuid default gen_random_uuid() primary key,
  who text not null,
  action text not null,
  xp integer not null default 0,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.activity_feed add column if not exists category text;
alter table public.activity_feed add column if not exists interaction_type text not null default 'activity';
alter table public.activity_feed add column if not exists parent_feed_item_id text;
alter table public.activity_feed add column if not exists context_label text;
alter table public.activity_feed add column if not exists comment_body text;
alter table public.activity_feed add column if not exists target_member_key text;
alter table public.activity_feed add column if not exists meta jsonb;
alter table public.activity_feed add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table public.activity_feed add column if not exists reactions jsonb not null default '{}'::jsonb;
alter table public.activity_feed add column if not exists witnesses jsonb not null default '[]'::jsonb;
alter table public.activity_feed add column if not exists updated_at timestamptz not null default now();

create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  member_key text not null,
  actor_member_key text,
  type text not null,
  title text,
  body text,
  read boolean not null default false,
  read_at timestamptz,
  dedupe_key text,
  feed_item_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feed_reactions (
  id uuid default gen_random_uuid() primary key,
  feed_item_id text not null,
  member_key text not null,
  emoji text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_witnesses (
  id uuid default gen_random_uuid() primary key,
  feed_item_id text not null,
  member_key text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.member_presence (
  member_key text primary key,
  current_surface text,
  is_online boolean not null default true,
  last_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  member_key text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists notifications_member_dedupe_idx
  on public.notifications (member_key, dedupe_key);
create unique index if not exists feed_reactions_unique_idx
  on public.feed_reactions (feed_item_id, member_key, emoji);
create unique index if not exists feed_witnesses_unique_idx
  on public.feed_witnesses (feed_item_id, member_key);
create index if not exists activity_feed_created_at_idx
  on public.activity_feed (created_at desc);
create index if not exists activity_feed_parent_idx
  on public.activity_feed (parent_feed_item_id);
create index if not exists activity_feed_target_member_idx
  on public.activity_feed (target_member_key);
create index if not exists notifications_member_read_created_idx
  on public.notifications (member_key, read, created_at desc);
create index if not exists feed_reactions_feed_item_idx
  on public.feed_reactions (feed_item_id, created_at desc);
create index if not exists feed_witnesses_feed_item_idx
  on public.feed_witnesses (feed_item_id, created_at desc);
create index if not exists member_presence_last_seen_idx
  on public.member_presence (last_seen_at desc);

create or replace function public.sync_feed_comment_fields()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.parent_feed_item_id, '') <> '' or coalesce(new.comment_body, '') <> '' then
    new.interaction_type = 'comment';
    new.context_label = coalesce(new.context_label, 'aktivitet');
  end if;
  return new;
end;
$$;

create or replace function public.sync_activity_feed_reactions()
returns trigger
language plpgsql
as $$
declare
  target_feed_item_id text := coalesce(new.feed_item_id, old.feed_item_id);
begin
  update public.activity_feed
  set
    reactions = coalesce((
      select jsonb_object_agg(reaction_group.emoji, to_jsonb(reaction_group.members))
      from (
        select emoji, array_agg(member_key order by created_at, member_key) as members
        from public.feed_reactions
        where feed_item_id = target_feed_item_id
        group by emoji
      ) as reaction_group
    ), '{}'::jsonb),
    updated_at = now()
  where id::text = target_feed_item_id;

  return coalesce(new, old);
end;
$$;

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

create or replace function public.create_social_notification(
  target_member_key text,
  actor_member_key text,
  notification_type text,
  notification_title text,
  notification_body text,
  related_feed_item_id text,
  notification_dedupe_key text,
  notification_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_member_key is null or actor_member_key is null or target_member_key = actor_member_key then
    return;
  end if;

  insert into public.notifications (
    member_key,
    actor_member_key,
    type,
    title,
    body,
    feed_item_id,
    dedupe_key,
    payload
  )
  values (
    target_member_key,
    actor_member_key,
    notification_type,
    notification_title,
    notification_body,
    related_feed_item_id,
    notification_dedupe_key,
    coalesce(notification_payload, '{}'::jsonb)
  )
  on conflict (member_key, dedupe_key)
  do update set
    title = excluded.title,
    body = excluded.body,
    payload = excluded.payload,
    updated_at = now();
end;
$$;

create or replace function public.notify_feed_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  related_feed_item_id text := coalesce(new.parent_feed_item_id, new.id::text);
begin
  if coalesce(new.interaction_type, 'activity') <> 'comment' then
    return new;
  end if;

  perform public.create_social_notification(
    new.target_member_key,
    new.who,
    'feed_comment',
    null,
    new.comment_body,
    related_feed_item_id,
    'comment:' || new.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'contextLabel', coalesce(new.context_label, 'aktivitet'),
      'comment', new.comment_body,
      'feedEventId', new.id::text,
      'feedItemId', related_feed_item_id,
      'parentFeedItemId', related_feed_item_id
    ))
  );

  return new;
end;
$$;

create or replace function public.notify_feed_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.activity_feed%rowtype;
begin
  select *
  into item
  from public.activity_feed
  where id::text = new.feed_item_id
  limit 1;

  if not found then
    return new;
  end if;

  perform public.create_social_notification(
    item.who,
    new.member_key,
    'feed_reaction',
    null,
    null,
    new.feed_item_id,
    'reaction:' || new.feed_item_id || '|' || new.emoji || '|' || new.member_key,
    jsonb_strip_nulls(jsonb_build_object(
      'emoji', new.emoji,
      'contextLabel', coalesce(item.context_label, 'aktivitet'),
      'feedItemId', new.feed_item_id
    ))
  );

  return new;
end;
$$;

create or replace function public.notify_feed_witness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.activity_feed%rowtype;
begin
  select *
  into item
  from public.activity_feed
  where id::text = new.feed_item_id
  limit 1;

  if not found then
    return new;
  end if;

  perform public.create_social_notification(
    item.who,
    new.member_key,
    'feed_witness',
    null,
    null,
    new.feed_item_id,
    'witness:' || new.feed_item_id || '|' || new.member_key,
    jsonb_strip_nulls(jsonb_build_object(
      'contextLabel', coalesce(item.context_label, 'aktivitet'),
      'feedItemId', new.feed_item_id
    ))
  );

  return new;
end;
$$;

drop trigger if exists activity_feed_touch_updated_at on public.activity_feed;
create trigger activity_feed_touch_updated_at
before update on public.activity_feed
for each row execute function public.touch_updated_at();

drop trigger if exists notifications_touch_updated_at on public.notifications;
create trigger notifications_touch_updated_at
before update on public.notifications
for each row execute function public.touch_updated_at();

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
before update on public.push_subscriptions
for each row execute function public.touch_updated_at();

drop trigger if exists member_presence_touch_updated_at on public.member_presence;
create trigger member_presence_touch_updated_at
before update on public.member_presence
for each row execute function public.touch_updated_at();

drop trigger if exists feed_comment_fields_trigger on public.activity_feed;
create trigger feed_comment_fields_trigger
before insert or update on public.activity_feed
for each row execute function public.sync_feed_comment_fields();

drop trigger if exists feed_reactions_sync_trigger on public.feed_reactions;
create trigger feed_reactions_sync_trigger
after insert or delete on public.feed_reactions
for each row execute function public.sync_activity_feed_reactions();

drop trigger if exists feed_witnesses_sync_trigger on public.feed_witnesses;
create trigger feed_witnesses_sync_trigger
after insert or delete on public.feed_witnesses
for each row execute function public.sync_activity_feed_witnesses();

drop trigger if exists feed_comment_notify_trigger on public.activity_feed;
create trigger feed_comment_notify_trigger
after insert on public.activity_feed
for each row execute function public.notify_feed_comment();

drop trigger if exists feed_reaction_notify_trigger on public.feed_reactions;
create trigger feed_reaction_notify_trigger
after insert on public.feed_reactions
for each row execute function public.notify_feed_reaction();

drop trigger if exists feed_witness_notify_trigger on public.feed_witnesses;
create trigger feed_witness_notify_trigger
after insert on public.feed_witnesses
for each row execute function public.notify_feed_witness();

alter table public.activity_feed enable row level security;
alter table public.notifications enable row level security;
alter table public.feed_reactions enable row level security;
alter table public.feed_witnesses enable row level security;
alter table public.member_presence enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Authenticated can read activity feed" on public.activity_feed;
create policy "Authenticated can read activity feed" on public.activity_feed
  for select using (auth.role() = 'authenticated');

drop policy if exists "Members can insert own activity" on public.activity_feed;
create policy "Members can insert own activity" on public.activity_feed
  for insert with check (who = public.current_member_key());

drop policy if exists "Members can update own activity" on public.activity_feed;
create policy "Members can update own activity" on public.activity_feed
  for update using (who = public.current_member_key());

drop policy if exists "Members can read own notifications" on public.notifications;
create policy "Members can read own notifications" on public.notifications
  for select using (member_key = public.current_member_key());

drop policy if exists "Members can update own notifications" on public.notifications;
create policy "Members can update own notifications" on public.notifications
  for update using (member_key = public.current_member_key());

drop policy if exists "Authenticated can read reactions" on public.feed_reactions;
create policy "Authenticated can read reactions" on public.feed_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists "Members can toggle own reactions" on public.feed_reactions;
create policy "Members can toggle own reactions" on public.feed_reactions
  for insert with check (member_key = public.current_member_key());

drop policy if exists "Members can remove own reactions" on public.feed_reactions;
create policy "Members can remove own reactions" on public.feed_reactions
  for delete using (member_key = public.current_member_key());

drop policy if exists "Authenticated can read witnesses" on public.feed_witnesses;
create policy "Authenticated can read witnesses" on public.feed_witnesses
  for select using (auth.role() = 'authenticated');

drop policy if exists "Members can insert own witnesses" on public.feed_witnesses;
create policy "Members can insert own witnesses" on public.feed_witnesses
  for insert with check (member_key = public.current_member_key());

drop policy if exists "Members can remove own witnesses" on public.feed_witnesses;
create policy "Members can remove own witnesses" on public.feed_witnesses
  for delete using (member_key = public.current_member_key());

drop policy if exists "Authenticated can read presence" on public.member_presence;
create policy "Authenticated can read presence" on public.member_presence
  for select using (auth.role() = 'authenticated');

drop policy if exists "Members can upsert own presence" on public.member_presence;
create policy "Members can upsert own presence" on public.member_presence
  for insert with check (member_key = public.current_member_key());

drop policy if exists "Members can update own presence" on public.member_presence;
create policy "Members can update own presence" on public.member_presence
  for update using (member_key = public.current_member_key());

drop policy if exists "Members can manage own push subscriptions" on public.push_subscriptions;
create policy "Members can manage own push subscriptions" on public.push_subscriptions
  for all using (member_key = public.current_member_key())
  with check (member_key = public.current_member_key());
