create or replace function public.create_member_notifications(
  target_member_keys text[],
  notification_type text,
  notification_title text default null,
  notification_body text default null,
  related_feed_item_id text default null,
  notification_dedupe_key text default null,
  notification_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_key text := public.current_member_key();
  target_key text;
begin
  if actor_key is null or array_length(target_member_keys, 1) is null then
    return;
  end if;

  foreach target_key in array target_member_keys loop
    perform public.create_social_notification(
      target_key,
      actor_key,
      notification_type,
      notification_title,
      notification_body,
      related_feed_item_id,
      notification_dedupe_key,
      coalesce(notification_payload, '{}'::jsonb)
    );
  end loop;
end;
$$;

grant execute on function public.create_member_notifications(
  text[],
  text,
  text,
  text,
  text,
  text,
  jsonb
) to authenticated;
