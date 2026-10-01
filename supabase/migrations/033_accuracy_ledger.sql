-- 033_accuracy_ledger.sql
-- 律动复盘台账：每天收盘后由 cron 自动跑回测，把结果按天存档。
-- 用途：攒"准确率随时间的变化"，给调参提供台账，而不是凭印象调。
-- 写入走服务端 service_role（/api/cron/accuracy-ledger），普通用户只读。

create table if not exists public.accuracy_ledger (
  day         date        not null,
  symbol      text        not null,
  status_key  text        not null,  -- 'all' = 总体；其余为四状态 hotStrong/overheated/weakLow/oversoldBottom
  signals     integer     not null,  -- 当日回测的信号样本数
  hits        integer     not null,  -- 命中数
  accuracy    numeric,               -- 命中率（%），样本为 0 时为 null
  baseline    numeric,               -- 同期基线（%）
  edge        numeric,               -- accuracy - baseline
  sample_days integer     not null,  -- 回测覆盖的交易日数
  created_at  timestamptz not null default now(),
  primary key (day, symbol, status_key)
);

alter table public.accuracy_ledger enable row level security;

drop policy if exists "public read ledger" on public.accuracy_ledger;
create policy "public read ledger"
  on public.accuracy_ledger for select
  using (true);
-- 不给 anon/authenticated 写权限：写入只走服务端 service_role
