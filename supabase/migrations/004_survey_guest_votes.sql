-- 004 投票放开给游客：voter_key（浏览器本地 UUID，一设备一票，可改）
alter table public.family_survey_votes
  add column if not exists voter_key text,
  add column if not exists id bigint generated always as identity;

-- 主键从 user_id 换成自增 id，user_id 改为可空
alter table public.family_survey_votes drop constraint if exists family_survey_votes_pkey;
alter table public.family_survey_votes alter column user_id drop not null;
alter table public.family_survey_votes add primary key (id);

-- user_id 与 voter_key 二选一，不能同时空也不能同时有
alter table public.family_survey_votes drop constraint if exists survey_one_identity;
alter table public.family_survey_votes add constraint survey_one_identity
  check ((user_id is null) <> (voter_key is null));

-- 部分唯一索引：一人（或一设备）一票，可改
create unique index if not exists survey_user_unique
  on public.family_survey_votes (user_id) where user_id is not null;
create unique index if not exists survey_voter_unique
  on public.family_survey_votes (voter_key) where voter_key is not null;

-- RLS 重写
drop policy if exists "votes readable by authenticated" on public.family_survey_votes;
drop policy if exists "votes upsert own" on public.family_survey_votes;
drop policy if exists "votes select public" on public.family_survey_votes;
drop policy if exists "votes insert" on public.family_survey_votes;
drop policy if exists "votes update own" on public.family_survey_votes;
drop policy if exists "votes delete own" on public.family_survey_votes;

-- 计票所有人可见（含游客）
create policy "votes select public"
  on public.family_survey_votes for select
  using (true);

-- 写入：登录用户只能写自己的 user_id 行；游客只能写 voter_key 行
create policy "votes insert"
  on public.family_survey_votes for insert
  with check (
    (user_id = auth.uid() and voter_key is null)
    or (auth.uid() is null and user_id is null and voter_key is not null)
  );

create policy "votes update own"
  on public.family_survey_votes for update
  using (
    (user_id = auth.uid())
    or (auth.uid() is null and user_id is null and voter_key is not null)
  )
  with check (
    (user_id = auth.uid() and voter_key is null)
    or (auth.uid() is null and user_id is null and voter_key is not null)
  );

create policy "votes delete own"
  on public.family_survey_votes for delete
  using (
    (user_id = auth.uid())
    or (auth.uid() is null and user_id is null and voter_key is not null)
  );
