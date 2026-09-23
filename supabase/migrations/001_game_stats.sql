-- 股神乐游戏战绩表：在 Supabase Dashboard → SQL Editor 里跑一遍即可
-- 表：game_stats（每用户每游戏一行）

create table if not exists public.game_stats (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  game_id    text        not null check (game_id in ('clipper','cool30','bigtech','kline')),
  plays       integer     not null default 0,
  total_score integer     not null default 0,
  best_score  integer     not null default 0,
  banked      integer     not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (user_id, game_id)
);

alter table public.game_stats enable row level security;

drop policy if exists "users manage own stats" on public.game_stats;
create policy "users manage own stats"
  on public.game_stats for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
