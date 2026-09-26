-- 031_market_scan_flow20d.sql
-- 给 market_scan 加近20天累计净流入列，供「今日信号」中间行过滤用：
-- 中间行只留近20天净流入为正的（买入多于卖出）；numeric 防大数溢出。
-- 口径：flows.ts 确定性估算（收盘涨记流入、跌记流出），非交易所逐笔数据。

alter table public.market_scan
  add column if not exists flow_20d numeric;
