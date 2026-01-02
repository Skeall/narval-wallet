-- XP module schema (v1)
-- Tables: user_xp_state, xp_events, xp_rewards
-- Idempotent: use IF NOT EXISTS

create table if not exists public.user_xp_state (
  user_id uuid primary key references public.users(uid) on delete cascade,
  xp integer not null default 0,
  last_daily_xp_at date,
  last_login_xp_at date
);

create table if not exists public.xp_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(uid) on delete cascade,
  type text not null,
  value integer not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_xp_events_user on public.xp_events(user_id);
create index if not exists idx_xp_events_type on public.xp_events(type);
create index if not exists idx_xp_events_created on public.xp_events(created_at);

create table if not exists public.xp_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(uid) on delete cascade,
  amount integer not null,
  status text not null default 'pending', -- pending | claimed
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists idx_xp_rewards_user_status on public.xp_rewards(user_id, status);

-- RLS
alter table public.user_xp_state enable row level security;
alter table public.xp_events enable row level security;
alter table public.xp_rewards enable row level security;

-- Policies: users can read/insert their own xp rows; no cross-user.
-- user_xp_state
create policy if not exists user_xp_state_select on public.user_xp_state
  for select using (auth.uid() = user_id);
create policy if not exists user_xp_state_upsert on public.user_xp_state
  for insert with check (auth.uid() = user_id);
create policy if not exists user_xp_state_update on public.user_xp_state
  for update using (auth.uid() = user_id);

-- xp_events
create policy if not exists xp_events_select on public.xp_events
  for select using (auth.uid() = user_id);
create policy if not exists xp_events_insert on public.xp_events
  for insert with check (auth.uid() = user_id);

-- xp_rewards
create policy if not exists xp_rewards_select on public.xp_rewards
  for select using (auth.uid() = user_id);
create policy if not exists xp_rewards_insert on public.xp_rewards
  for insert with check (auth.uid() = user_id);
create policy if not exists xp_rewards_update on public.xp_rewards
  for update using (auth.uid() = user_id);
