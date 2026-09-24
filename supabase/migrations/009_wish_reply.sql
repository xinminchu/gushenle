-- 009_wish_reply.sql
-- 许愿池：站长（Mas）公开回复。一条留言一条官方回复，所有人可见。
-- 写入只走服务端 /api/admin/wish-reply（service_role），RLS 不给普通用户 update 权限。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

alter table game_wishes
  add column if not exists reply_text text,
  add column if not exists replied_at timestamptz;
