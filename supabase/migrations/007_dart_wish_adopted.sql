-- 007_dart_wish_adopted.sql
-- "飞镖选股"游戏已根据许愿池建议开发上线，标记该条设想为已采纳。
-- 与 006 一起在 Supabase Dashboard -> SQL Editor 中执行即可。

update game_wishes
set adopted = true
where content = '有飞镖游戏吗？用昨日涨幅为半径，从观察列表里选5-10只股票排在圆盘上。';
