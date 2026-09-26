-- 030_market_scan_streaks.sql
-- 给 market_scan 加连涨/连跌天数列，供「今日信号」N连涨/N连跌标签用：
-- 口径 = 从最新一根日线往前数，连续收涨（收跌）天数；平盘（0%）打断；两者互斥。
-- 前端只在天数≥3 时显示标签，不足 3 天不标记。

alter table public.market_scan
  add column if not exists up_streak integer,
  add column if not exists down_streak integer;
