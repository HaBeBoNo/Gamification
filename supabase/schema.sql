-- Members-profiler
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  member_key text unique not null,
  email text,
  created_at timestamp with time zone default now()
);

-- Speldata per member
create table if not exists member_data (
  id uuid default gen_random_uuid() primary key,
  member_key text unique not null,
  data jsonb not null default '{}',
  updated_at timestamp with time zone default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table member_data enable row level security;

-- Policies — member ser bara sin egen data
create policy "Own profile only" on profiles
  for all using (auth.uid() = id);

create policy "Own data only" on member_data
  for all using (
    member_key = (
      select member_key from profiles where id = auth.uid()
    )
  );
