-- 027_rosemary_review_adopted.sql
-- 许愿池：采纳 @Rosemary 的玩家评价「掷骰子选股候选太少，玩几次就腻，期待更丰富的范围」，
-- 「掷骰子买股」已按此扩容上线：1/2 颗骰子可选（6/12 只候选）、4 款骰子皮肤、「换一批」从律动扫描池随机抽。
-- 评价类采纳奖励 +20（bonus_points），留言本身 +10，合计 30。
-- 定价档：留言 10 / 评价采纳 30 / 设想采纳 50。
-- 公开回复不随迁移自动写：草稿在站长工具箱「回复草稿」里，站长过目后亲手发布。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

update public.game_wishes
set adopted = true, bonus_points = 20
where nickname = '@Rosemary'
  and kind = 'review'
  and content like '%候选太少%'
  and adopted is distinct from true;
