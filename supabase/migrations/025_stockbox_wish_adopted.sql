-- 025_stockbox_wish_adopted.sql
-- 许愿池：采纳 @icey.bulbasa 的「CS 盲盒做成股票主题」设想，「股票盲盒」已开发上线。
-- 置 adopted=true，采纳奖励 +40（bonus_points），许愿本身 +10，合计 50。
-- 该设想由创始人转述补记：user_id 按邮箱从 auth.users 反查归属，确保贡献值计到他名下。
-- 公开回复不随迁移自动写：草稿在站长工具箱「回复草稿」里，站长过目后亲手发布。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

insert into public.game_wishes (user_id, nickname, kind, content, adopted, bonus_points)
select u.id, 'icey.bulbasa', 'idea',
  'CS 开箱盲盒很火，能不能做个股票主题的？开箱开出随机股票，按稀有度分级，出金直接加入自选。',
  true, 40
from auth.users u
where u.email = 'icey.bulbasaur@gmail.com'
  and not exists (
    select 1 from public.game_wishes w
    where w.nickname = 'icey.bulbasa' and w.adopted is true
  );
