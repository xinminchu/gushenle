-- 015_game_stats_display_name.sql
-- game_stats 加 display_name 列：英雄榜展示用，客户端同步战绩时随行 upsert。
-- 老数据该列为 NULL，接口层兜底显示为"股友"。

alter table public.game_stats add column if not exists display_name text;
