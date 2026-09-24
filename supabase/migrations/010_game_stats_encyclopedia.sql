-- 010_game_stats_encyclopedia.sql
-- 放宽 game_stats.game_id 的检查约束：加入股票大百科（encyclopedia）。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

alter table public.game_stats drop constraint if exists game_stats_game_id_check;
alter table public.game_stats add constraint game_stats_game_id_check
  check (game_id in (
    'clipper', 'cool30', 'bigtech', 'kline',
    'cutloss', 'holdback', 'newstrap', 'dca', 'dart', 'encyclopedia'
  ));
