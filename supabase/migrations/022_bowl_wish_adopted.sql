-- 022_bowl_wish_adopted.sql
-- 许愿池：采纳 @路过 的"三个碗猜股票"设想，「猜碗选股」已开发上线。
-- 置 adopted=true，采纳奖励 +40（bonus_points），许愿本身 +10，合计 50。
-- 公开回复不随迁移自动写：草稿在站长工具箱「回复草稿」里，站长过目后亲手发布。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

update public.game_wishes
  set adopted = true, bonus_points = 40
  where nickname = '路过' and content like '%三个碗%' and adopted is not true;
