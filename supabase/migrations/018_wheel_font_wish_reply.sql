-- 018_wheel_font_wish_reply.sql
-- 许愿池：@大魔法师 反馈「转转盘买股」字太小、老年人看不清，转盘字号已放大加粗，
-- 站长公开回复随修复一起写入。幂等：只处理尚未回复过的留言。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

update public.game_wishes
set reply_text = '👀 收到！转盘的字已经放大加粗了，照顾咱老股友的眼睛。转着玩，眼睛可不能累着～',
    replied_at = now()
where nickname = '大魔法师' and content like '%费眼睛%' and replied_at is null;
