import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 习惯漏斗打点：POST { event, actor_id, actor_type, symbol?, meta? }
 * 用 anon key 写库，靠 RLS insert 策略放行（funnel_events 只开放 insert 给 anon）。
 * 校验 event 白名单；actor_id 必填。失败静默返回 ok:true，不干扰前端。
 */

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const EVENTS = new Set(['diagnosis_view', 'operation_log', 'review_view']);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const event = body?.event;
    const actor_id = String(body?.actor_id || '').slice(0, 128);
    if (!EVENTS.has(event) || !actor_id || !URL || !ANON) {
      return NextResponse.json({ ok: true });
    }
    const actor_type = body?.actor_type === 'user' ? 'user' : 'anon';
    const symbol = body?.symbol ? String(body.symbol).toUpperCase().slice(0, 16) : null;
    const meta = body?.meta && typeof body.meta === 'object' ? body.meta : {};
    const sb = createClient(URL, ANON, { auth: { persistSession: false } });
    await sb.from('funnel_events').insert({ event, actor_id, actor_type, symbol, meta });
  } catch {
    /* 静默 */
  }
  return NextResponse.json({ ok: true });
}
