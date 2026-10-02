-- 036_family_post_type_sell.sql
-- 朋友圈新增"卖出逻辑"类型：卖出 ≠ 避坑（止盈/调仓是正当逻辑，不该硬塞进"避坑经验"）。
-- post_type 新增 'sell'，原有 'thesis'（买入逻辑）/'lesson'（避坑经验）不动。

do $$
declare
  cname text;
begin
  -- 找到 post_type 上的旧检查约束（兼容默认命名与改名后的情况），删掉重建
  select conname into cname
  from pg_constraint
  where conrelid = 'public.family_posts'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%post_type%';
  if cname is not null then
    execute format('alter table public.family_posts drop constraint %I', cname);
  end if;
  alter table public.family_posts
    add constraint family_posts_post_type_check
    check (post_type in ('thesis', 'sell', 'lesson'));
end
$$;
