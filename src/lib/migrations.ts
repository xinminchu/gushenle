/**
 * 数据库迁移清单：内容与 supabase/migrations/*.sql 逐字一致。
 * 新增迁移时：先写 supabase/migrations/00X_xxx.sql，再把条目追加到 MIGRATIONS。
 *
 * 004_survey_guest_votes.sql 不在此列：游客投票的 RLS 过宽，
 * 待改成服务端读写方案后再决定是否纳入。
 */

export interface Migration {
  version: string;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: "001_game_stats",
    name: "\u6e38\u620f\u6218\u7ee9\u8868",
    sql: `-- 股神乐游戏战绩表：在 Supabase Dashboard → SQL Editor 里跑一遍即可
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
`,
  },
  {
    version: "002_family",
    name: "\u5bb6\u4eba\u5206\u4eab\u5708\uff08\u5e16\u5b50/\u70b9\u8d5e/\u6295\u7968\uff09",
    sql: `-- 家人分享圈：在 Supabase Dashboard → SQL Editor 里跑一遍即可
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
`,
  },
  {
    version: "003_site_stats",
    name: "\u7ad9\u70b9\u8bbf\u95ee\u7edf\u8ba1",
    sql: `-- 003 站点访问统计：按 IP 哈希 + 日期去重（只存哈希，不存原始 IP）
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visit_date date not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (visit_date, ip_hash)
);

alter table public.site_visits enable row level security;

-- 允许匿名写入打点，不开放读取（读取走服务端 service_role）
drop policy if exists "site_visits_insert" on public.site_visits;
create policy "site_visits_insert"
  on public.site_visits for insert
  to anon
  with check (true);
`,
  },
  {
    version: "005_game_wishes",
    name: "\u6e38\u620f\u8bb8\u613f\u6c60",
    sql: `-- 005_game_wishes.sql
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
`,
  },
  {
    version: "006_game_wishes_adopted",
    name: "\u8bb8\u613f\u6c60\u91c7\u7eb3\u6807\u8bb0",
    sql: `-- 006_game_wishes_adopted.sql
-- 许愿池：采纳标记。某条设想被做成游戏后，置 adopted=true，
-- 并在对应游戏的 credit 字段署名（格式如 "@昵称"）。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可

alter table game_wishes
  add column if not exists adopted boolean not null default false;
`,
  },
  {
    version: "007_dart_wish_adopted",
    name: "\u98de\u9556\u5efa\u8bae\u8bbe\u4e3a\u5df2\u91c7\u7eb3",
    sql: `-- 007_dart_wish_adopted.sql
-- "飞镖选股"游戏已根据许愿池建议开发上线，标记该条设想为已采纳。
-- 与 006 一起在 Supabase Dashboard -> SQL Editor 中执行即可。

update game_wishes
set adopted = true
where content = '有飞镖游戏吗？用昨日涨幅为半径，从观察列表里选5-10只股票排在圆盘上。';
`,
  },
  {
    version: "008_game_stats_game_ids",
    name: "\u6e38\u620f\u6218\u7ee9\u8868\uff1a\u653e\u5bbd game_id \u7ea6\u675f\u5230 9 \u4e2a\u6e38\u620f",
    sql: `-- 008_game_stats_game_ids.sql
-- 放宽 game_stats.game_id 的检查约束：001 建表时只写了 4 个老游戏，
-- 现在已有 9 个游戏（GameId），新游戏的云端战绩会被约束拦下。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

alter table public.game_stats drop constraint if exists game_stats_game_id_check;
alter table public.game_stats add constraint game_stats_game_id_check
  check (game_id in (
    'clipper', 'cool30', 'bigtech', 'kline',
    'cutloss', 'holdback', 'newstrap', 'dca', 'dart'
  ));
`,
  },
  {
    version: "009_wish_reply",
    name: "\u8bb8\u613f\u6c60\uff1a\u7ad9\u957f\u516c\u5f00\u56de\u590d",
    sql: `-- 009_wish_reply.sql
-- 许愿池：站长（Mas）公开回复。一条留言一条官方回复，所有人可见。
-- 写入只走服务端 /api/admin/wish-reply（service_role），RLS 不给普通用户 update 权限。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

alter table game_wishes
  add column if not exists reply_text text,
  add column if not exists replied_at timestamptz;
`,
  },
  {
    version: "010_game_stats_encyclopedia",
    name: "游戏战绩表：放宽 game_id 约束到 10 个游戏",
    sql: `-- 010_game_stats_encyclopedia.sql
-- 放宽 game_stats.game_id 的检查约束：加入股票大百科（encyclopedia）。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

alter table public.game_stats drop constraint if exists game_stats_game_id_check;
alter table public.game_stats add constraint game_stats_game_id_check
  check (game_id in (
    'clipper', 'cool30', 'bigtech', 'kline',
    'cutloss', 'holdback', 'newstrap', 'dca', 'dart', 'encyclopedia'
  ));
`,
  },
  {
    version: "011_encyclopedia_favorites",
    name: "股票大百科：我的知识库（收藏题目）",
    sql: `-- 011_encyclopedia_favorites.sql
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
`,
  },
  {
    version: "012_encyclopedia_suggestions",
    name: "股票大百科：题目修改建议",
    sql: `-- 012_encyclopedia_suggestions.sql
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
`,
  },
];
