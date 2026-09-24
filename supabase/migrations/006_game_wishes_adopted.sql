-- 006_game_wishes_adopted.sql
-- 许愿池：采纳标记。某条设想被做成游戏后，置 adopted=true，
-- 并在对应游戏的 credit 字段署名（格式如 "@昵称"）。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可

alter table game_wishes
  add column if not exists adopted boolean not null default false;
