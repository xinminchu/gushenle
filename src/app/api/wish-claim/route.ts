import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireUser } from '@/lib/adminAuth';

/**
 * 许愿池昵称认领（EaaS v0 身份绑定）：
 * 匿名留言（user_id 为空但填了昵称）可被登录用户认领，站长审批后回填 user_id。
 *
 * GET  -> 认领申请列表（公开读；?status=pending 过滤）
 * POST -> { nickname } 提交认领申请（需登录；同一昵称同时只能有一条待审）
 */

const ANON_NICK = '匿名股友';

function anon() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !ANON) return null;
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  const sb = anon();
  if (!sb) return NextResponse.json({ ok: false, error: 'supabase 未配置' }, { status: 500 });
  const status = new URL(req.url).searchParams.get('status');
  let q = sb.from('wish_claims').select('*').order('created_at', { ascending: false }).limit(200);
  if (status === 'pending' || status === 'approved' || status === 'rejected') {
    q = q.eq('status', status);
  }
  const { data, error } = await q;
  if (error) {
    const missing = error.message.includes('wish_claims');
    return NextResponse.json(
      { ok: false, error: missing ? '028 迁移还没执行：先去「管理」→ 数据库迁移一键运行' : error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, claims: data || [] });
}

export async function POST(req: NextRequest) {
  const user = await requireUser(req);
  if (!user) return NextResponse.json({ ok: false, error: '请先登录再认领' }, { status: 401 });
  const sb = anon();
  if (!sb) return NextResponse.json({ ok: false, error: 'supabase 未配置' }, { status: 500 });

  let body: { nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }
  const nickname = (body.nickname || '').trim().slice(0, 20);
  if (!nickname || nickname === ANON_NICK) {
    return NextResponse.json({ ok: false, error: '这个昵称不能认领' }, { status: 400 });
  }

  try {
    // 必须有可认领的留言：该昵称下存在 user_id 为空的留言
    const w = await sb
      .from('game_wishes')
      .select('id', { count: 'exact', head: true })
      .eq('nickname', nickname)
      .is('user_id', null);
    if (w.error) throw w.error;
    if (!w.count) {
      return NextResponse.json({ ok: false, error: '这个昵称没有可认领的留言' }, { status: 400 });
    }
    // 同一昵称同时只能有一条待审
    const p = await sb
      .from('wish_claims')
      .select('id', { count: 'exact', head: true })
      .eq('nickname', nickname)
      .eq('status', 'pending');
    if (p.error) throw p.error;
    if (p.count) {
      return NextResponse.json({ ok: false, error: '这个昵称已在审核中' }, { status: 400 });
    }
    // 认领人自己的昵称快照（备查）
    const { data: me } = await sb.from('game_wishes')
      .select('nickname')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1);
    const snap = (me && me[0]?.nickname) || '';
    const ins = await sb.from('wish_claims').insert({
      nickname,
      claimer_user_id: user.id,
      claimer_nickname: snap,
      status: 'pending',
    });
    if (ins.error) throw ins.error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const missing = msg.includes('wish_claims');
    return NextResponse.json(
      { ok: false, error: missing ? '028 迁移还没执行：先去「管理」→ 数据库迁移一键运行' : msg },
      { status: 500 },
    );
  }
}
