import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

/**
 * 站点统计：GET 只读数，POST 先打点（IP 哈希+当天去重）再读数。
 * 读数需要服务端 SUPABASE_SERVICE_ROLE_KEY；没配时返回 null，前端自动隐藏。
 * 打点只用 anon key + RLS insert 策略，不存原始 IP。
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 用户所在时区（芝加哥）的当天日期 YYYY-MM-DD */
function todayStr(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !key) return null;
  return createClient(URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getStats() {
  const svc = serviceClient();
  if (!svc) return { visitors: null, today: null, users: null };
  const today = todayStr();
  const [{ count: visitors }, { count: todayCount }] = await Promise.all([
    svc.from('site_visits').select('*', { count: 'exact', head: true }),
    svc.from('site_visits').select('*', { count: 'exact', head: true }).eq('visit_date', today),
  ]);
  // 注册用户总数（auth.admin 分页取，beta 阶段数据量小）
  let users = 0;
  let page = 1;
  for (;;) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 100 });
    if (error || !data || data.users.length === 0) break;
    users += data.users.length;
    if (data.users.length < 100) break;
    page += 1;
  }
  return { visitors: visitors ?? 0, today: todayCount ?? 0, users };
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
}

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await getStats()) });
  } catch {
    return NextResponse.json({ ok: false });
  }
}

export async function POST(req: NextRequest) {
  let trackError: string | null = null;
  try {
    if (URL && ANON) {
      const ipHash = createHash('sha256').update(clientIp(req)).digest('hex');
      const anon = createClient(URL, ANON, { auth: { persistSession: false } });
      const { error } = await anon.from('site_visits').upsert(
        { visit_date: todayStr(), ip_hash: ipHash },
        { onConflict: 'visit_date,ip_hash', ignoreDuplicates: true },
      );
      // 临时诊断：把写入错误直接返回（定位后删除）
      trackError = error ? `${error.code} | ${error.message}` : 'insert ok';
    } else {
      trackError = 'missing supabase env';
    }
  } catch (e) {
    trackError = `thrown: ${String(e)}`;
  }
  try {
    const stats = await getStats();
    return NextResponse.json({ ok: true, ...stats, trackError });
  } catch {
    return NextResponse.json({ ok: false, trackError });
  }
}
