-- 005_game_wishes.sql
-- 游戏许愿池：玩家反馈评价 / 提出游戏设想，可匿名；登录留言计贡献值
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可

create table if not exists game_wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  nickname text not null default '匿名股友',
  kind text not null check (kind in ('idea', 'review')),
  content text not null check (char_length(content) >= 1 and char_length(content) <= 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_game_wishes_created on game_wishes (created_at desc);
create index if not exists idx_game_wishes_user on game_wishes (user_id);

alter table game_wishes enable row level security;

-- 所有人可看
drop policy if exists "game_wishes public read" on game_wishes;
create policy "game_wishes public read"
  on game_wishes for select using (true);

-- 所有人可留言；user_id 只能填空（匿名）或自己的 id（防冒领贡献值）
drop policy if exists "game_wishes anyone insert" on game_wishes;
create policy "game_wishes anyone insert"
  on game_wishes for insert
  with check (user_id is null or user_id = auth.uid());

-- 登录用户可删自己的留言
drop policy if exists "game_wishes own delete" on game_wishes;
create policy "game_wishes own delete"
  on game_wishes for delete
  using (auth.uid() is not null and auth.uid() = user_id);
