-- 028_wish_claims.sql
-- 许愿池昵称认领：匿名留言（user_id 为空但填了昵称）可被登录用户认领，
-- 站长审批后，该昵称下所有未认领留言的 user_id 回填为认领人，贡献值自动重算。
-- 规则：归属主键永远是 user_id，nickname 只是显示标签；
-- 完全匿名（昵称「匿名股友」）不可认领；同一昵称同时只能有一条待审申请。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

create table if not exists public.wish_claims (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  claimer_user_id uuid not null references auth.users(id) on delete cascade,
  claimer_nickname text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists idx_wish_claims_status on public.wish_claims (status);
create index if not exists idx_wish_claims_nickname on public.wish_claims (nickname);

alter table public.wish_claims enable row level security;

-- 所有人可看（认领记录公开，防暗箱）
drop policy if exists "wish_claims public read" on public.wish_claims;
create policy "wish_claims public read"
  on public.wish_claims for select using (true);

-- 登录用户可为自己提交认领申请（状态只能是 pending）
drop policy if exists "wish_claims own insert" on public.wish_claims;
create policy "wish_claims own insert"
  on public.wish_claims for insert
  with check (auth.uid() is not null and auth.uid() = claimer_user_id and status = 'pending');

-- 修改/删除只走 service_role（站长服务端审批），RLS 不开放
