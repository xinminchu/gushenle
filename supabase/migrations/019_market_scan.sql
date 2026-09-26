-- 019_market_scan.sql
-- 每日收盘后批处理扫描精选池，把每只的律动分/信号/涨跌/估算资金流写入此表，
-- 首页「今日信号」和盘前盘后两报直接读表，不实时算。
-- 在 Supabase Dashboard -> SQL Editor 中执行一次即可，
-- 或用站内「管理」→ 数据库迁移一键执行。

create table if not exists public.market_scan (
  symbol text not null,
  scan_date date not null,
  name text not null default '',
  score integer not null default 50,
  status_key text not null default '',
  change_pct numeric,
  inflow_est numeric,
  updated_at timestamptz not null default now(),
  primary key (symbol, scan_date)
);

alter table public.market_scan enable row level security;

drop policy if exists "market_scan 公开读" on public.market_scan;
create policy "market_scan 公开读"
  on public.market_scan for select
  using (true);
-- 写操作只走 service_role（扫描 API 服务端直写），不给普通用户写权限。
