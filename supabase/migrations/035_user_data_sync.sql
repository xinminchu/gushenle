-- 035_user_data_sync.sql
-- 用户数据云同步：持仓 / 自选 / 资金账户 / 昵称，一用户一行，登录后多设备自动同步。
-- 本地优先：没跑这个迁移或没登录时，app 照常用 localStorage，不受影响。

create table if not exists public.user_data (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  positions  jsonb       not null default '[]',
  watchlist  jsonb       not null default '{}',
  account    jsonb       not null default '{}',
  nickname   text        not null default '',
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

drop policy if exists "users manage own data" on public.user_data;
create policy "users manage own data"
  on public.user_data for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
