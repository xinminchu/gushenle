-- 020_market_scan_prev_change.sql
-- 给 market_scan 加前一日涨跌幅列，供「低分捡漏」用：
-- 捡漏规则 = 律动分≤30 且 前日跌 (prev_change_pct<0)，
-- 再看当日：涨→反弹，跌→连跌。

alter table public.market_scan
  add column if not exists prev_change_pct numeric;
