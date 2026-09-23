-- 003 站点访问统计：按 IP 哈希 + 日期去重（只存哈希，不存原始 IP）
create table if not exists public.site_visits (
  id bigint generated always as identity primary key,
  visit_date date not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  unique (visit_date, ip_hash)
);

alter table public.site_visits enable row level security;

-- 允许匿名写入打点，不开放读取（读取走服务端 service_role）
drop policy if exists "site_visits_insert" on public.site_visits;
create policy "site_visits_insert"
  on public.site_visits for insert
  to anon
  with check (true);
