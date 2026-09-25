-- 017_wish_bonus_vipdongxia.sql
-- 许愿池：采纳奖励分。@vipdongxia 的"转转盘买股"设想已开发上线，
-- 置 adopted=true，公开回复随采纳一起写入。
-- 新规矩：许愿本身 +10（按条计数），被采纳额外 +40（bonus_points），合计 50。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

alter table public.game_wishes add column if not exists bonus_points integer not null default 0;
update public.game_wishes
  set adopted = true, bonus_points = 40,
      reply_text = '🎡 收到！转盘一转，买股全看缘分——站长已拍板开工，「转转盘买股」即将上线，署名@vipdongxia！掷骰子、酒鬼走位记在小本本上排队等宠幸。贡献值+50已到账，请查收～',
      replied_at = now()
  where nickname = 'vipdongxia' and content like '%转转盘%' and adopted is not true;
