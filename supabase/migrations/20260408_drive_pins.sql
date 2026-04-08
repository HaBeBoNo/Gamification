create table if not exists public.drive_pins (
  file_id text primary key,
  pinned_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists drive_pins_created_at_idx
  on public.drive_pins (created_at desc);

alter table public.drive_pins enable row level security;

drop policy if exists "Authenticated can read drive pins" on public.drive_pins;
create policy "Authenticated can read drive pins" on public.drive_pins
  for select using (auth.role() = 'authenticated');

drop policy if exists "Members can insert drive pins" on public.drive_pins;
create policy "Members can insert drive pins" on public.drive_pins
  for insert with check (pinned_by = public.current_member_key());

drop policy if exists "Authenticated can remove drive pins" on public.drive_pins;
create policy "Authenticated can remove drive pins" on public.drive_pins
  for delete using (auth.role() = 'authenticated');
