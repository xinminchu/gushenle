-- 011_encyclopedia_favorites.sql
-- 股票大百科：我的知识库（收藏题目）。
-- 游客用 localStorage，登录用户同步到这张表（每用户每题一行）。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

create table if not exists public.encyclopedia_favorites (
  user_id     uuid        not null references auth.users(id) on delete cascade,
  question_id text        not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

alter table public.encyclopedia_favorites enable row level security;

drop policy if exists "users manage own favorites" on public.encyclopedia_favorites;
create policy "users manage own favorites"
  on public.encyclopedia_favorites for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
