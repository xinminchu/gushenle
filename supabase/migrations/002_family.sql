-- 家人分享圈：在 Supabase Dashboard → SQL Editor 里跑一遍即可
-- 表：family_posts（帖子）、family_post_likes（点赞）、family_survey_votes（持仓总览意愿投票）

-- 1) 帖子
create table if not exists public.family_posts (
  id         bigint generated always as identity primary key,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  nickname   text        not null default '家人',
  post_type  text        not null check (post_type in ('thesis', 'lesson')),
  symbol     text        not null default '',
  content    text        not null check (char_length(content) between 2 and 500),
  created_at timestamptz not null default now()
);

alter table public.family_posts enable row level security;

drop policy if exists "posts readable by authenticated" on public.family_posts;
create policy "posts readable by authenticated"
  on public.family_posts for select
  using (auth.role() = 'authenticated');

drop policy if exists "posts insert own" on public.family_posts;
create policy "posts insert own"
  on public.family_posts for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "posts delete own" on public.family_posts;
create policy "posts delete own"
  on public.family_posts for delete
  using (auth.uid() = user_id);

-- 2) 点赞（每人每帖一次）
create table if not exists public.family_post_likes (
  post_id    bigint      not null references public.family_posts(id) on delete cascade,
  user_id    uuid        not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

alter table public.family_post_likes enable row level security;

drop policy if exists "likes readable by authenticated" on public.family_post_likes;
create policy "likes readable by authenticated"
  on public.family_post_likes for select
  using (auth.role() = 'authenticated');

drop policy if exists "likes insert own" on public.family_post_likes;
create policy "likes insert own"
  on public.family_post_likes for insert
  with check (auth.role() = 'authenticated' and auth.uid() = user_id);

drop policy if exists "likes delete own" on public.family_post_likes;
create policy "likes delete own"
  on public.family_post_likes for delete
  using (auth.uid() = user_id);

-- 3) 持仓总览意愿投票（每人一票，可改）
create table if not exists public.family_survey_votes (
  user_id    uuid        primary key references auth.users(id) on delete cascade,
  choice     text        not null check (choice in ('yes', 'maybe', 'no')),
  updated_at timestamptz not null default now()
);

alter table public.family_survey_votes enable row level security;

drop policy if exists "votes readable by authenticated" on public.family_survey_votes;
create policy "votes readable by authenticated"
  on public.family_survey_votes for select
  using (auth.role() = 'authenticated');

drop policy if exists "votes upsert own" on public.family_survey_votes;
create policy "votes upsert own"
  on public.family_survey_votes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
