-- 012_encyclopedia_suggestions.sql
-- 股票大百科：题目修改建议 / 新题投稿。
-- 游客建议只存本地队列；登录用户写入这张表。读取与采纳走 service_role
-- （后续站长审核页），普通用户只有插入权限，且不能冒充他人 user_id。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

create table if not exists public.encyclopedia_suggestions (
  id                bigint generated always as identity primary key,
  user_id           uuid references auth.users(id) on delete set null,
  nickname          text        not null default '匿名股友',
  question_id       text        not null,
  question_snapshot text        not null default '',
  suggestion        text        not null check (char_length(suggestion) between 2 and 500),
  status            text        not null default 'pending'
                    check (status in ('pending', 'adopted', 'rejected')),
  created_at        timestamptz not null default now()
);

alter table public.encyclopedia_suggestions enable row level security;

drop policy if exists "anyone can suggest" on public.encyclopedia_suggestions;
create policy "anyone can suggest"
  on public.encyclopedia_suggestions for insert
  with check (user_id is null or user_id = auth.uid());
