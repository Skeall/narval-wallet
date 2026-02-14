-- Chasse au Trésor schema
-- Mini-jeu collectif: 1 carte 4x4 partagée jusqu'à découverte du trésor.

create table if not exists public.tresor_games (
  game_id uuid primary key default gen_random_uuid(),
  treasure_index integer not null check (treasure_index >= 0 and treasure_index < 16),
  statut text not null default 'active' check (statut in ('active', 'terminee')),
  joueur_gagnant_id uuid references public.users(uid) on delete set null,
  joueur_gagnant_pseudo text,
  reward integer,
  date_creation timestamptz not null default now(),
  date_fin timestamptz
);

create table if not exists public.tresor_attempts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.tresor_games(game_id) on delete cascade,
  user_id uuid not null references public.users(uid) on delete cascade,
  cell_index integer not null check (cell_index >= 0 and cell_index < 16),
  is_winner boolean not null default false,
  attempted_at timestamptz not null default now(),
  unique (game_id, cell_index)
);

create table if not exists public.user_daily_tresor_attempt (
  user_id uuid not null references public.users(uid) on delete cascade,
  date date not null,
  has_pari_accepted boolean not null default false,
  has_used_attempt boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (user_id, date)
);

create index if not exists idx_tresor_games_statut on public.tresor_games(statut, date_creation desc);
create unique index if not exists uniq_tresor_active_game on public.tresor_games(statut) where statut = 'active';
create index if not exists idx_tresor_attempts_game on public.tresor_attempts(game_id, attempted_at asc);
create index if not exists idx_user_daily_tresor_date on public.user_daily_tresor_attempt(date);

-- Garantit qu'une partie active existe en base.
insert into public.tresor_games (treasure_index, statut)
select floor(random() * 16)::int, 'active'
where not exists (
  select 1 from public.tresor_games where statut = 'active'
);

-- RLS
alter table public.tresor_games enable row level security;
alter table public.tresor_attempts enable row level security;
alter table public.user_daily_tresor_attempt enable row level security;

create policy if not exists tresor_games_select_all on public.tresor_games
  for select using (true);

create policy if not exists tresor_games_insert_authenticated on public.tresor_games
  for insert with check (auth.uid() is not null);

create policy if not exists tresor_games_update_authenticated on public.tresor_games
  for update using (auth.uid() is not null);

create policy if not exists tresor_attempts_select_all on public.tresor_attempts
  for select using (true);

create policy if not exists tresor_attempts_insert_own on public.tresor_attempts
  for insert with check (auth.uid() = user_id);

create policy if not exists user_daily_tresor_select_own on public.user_daily_tresor_attempt
  for select using (auth.uid() = user_id);

create policy if not exists user_daily_tresor_insert_own on public.user_daily_tresor_attempt
  for insert with check (auth.uid() is not null);

create policy if not exists user_daily_tresor_update_own on public.user_daily_tresor_attempt
  for update using (auth.uid() is not null);
