-- 034_family_replies.sql
-- 资讯朋友圈：帖子回复 + 帖子允许本人编辑
-- 1) 回复表 family_post_replies（一条回复挂在一帖下，删帖级联删回复）
-- 2) family_posts 加 "本人可改" RLS（之前只有删没有改，顺带修了改昵称同步署名的 RLS 报错）

-- 1) 回复表
create table if not exists public.family_post_replies (
  id         bigint generated always as identity primary key,
  post_id    bigint      not null references public.family_posts(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  nickname   text        not null default '家人',
  content    text        not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);

alter table public.family_post_replies enable row level security;

drop policy if exists "replies readable by authenticated" on public.family_post_replies;
create policy "replies readable by authenticated"
  on public.family_post_replies for select
  using (auth.role() = 'authenticated');

drop policy if exists "replies insert own" on public.family_post_replies;
create policy "replies insert own"
  on public.family_post_replies for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "replies delete own" on public.family_post_replies;
create policy "replies delete own"
  on public.family_post_replies for delete
  using (auth.uid() = user_id);

-- 2) 帖子：本人可编辑（内容/标的/类型）
drop policy if exists "posts update own" on public.family_posts;
create policy "posts update own"
  on public.family_posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
