import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/adminAuth';

/**
 * 站长审批昵称认领（EaaS v0 身份绑定）：
 *
 * POST { claim_id, action: 'approve' | 'reject' }（需站长登录）
 * - approve：把该昵称下所有未认领留言（user_id 为空）的 user_id 回填为认领人，
 *   认领记录记 approved；贡献值按 user_id 自动重算。
 * - reject：认领记录记 rejected。
 */

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: '需要站长登录' }, { status: 403 });
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ ok: false, error: '服务端未配置' }, { status: 500 });

  let body: { claim_id?: string; action?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }
  const { claim_id, action } = body;
  if (!claim_id || (action !== 'approve' && action !== 'reject')) {
    return NextResponse.json({ ok: false, error: '参数错误' }, { status: 400 });
  }

  const { data: claim, error: e0 } = await svc
    .from('wish_claims')
    .select('*')
    .eq('id', claim_id)
    .single();
  if (e0 || !claim) return NextResponse.json({ ok: false, error: '申请不存在' }, { status: 404 });
  if (claim.status !== 'pending') {
    return NextResponse.json({ ok: false, error: '这条申请已经处理过了' }, { status: 400 });
  }

  if (action === 'approve') {
    // 回填该昵称下所有未认领留言
    const { error: e1 } = await svc
      .from('game_wishes')
      .update({ user_id: claim.claimer_user_id })
      .eq('nickname', claim.nickname)
      .is('user_id', null);
    if (e1) return NextResponse.json({ ok: false, error: e1.message }, { status: 500 });
  }

  const { error: e2 } = await svc
    .from('wish_claims')
    .update({ status: action === 'approve' ? 'approved' : 'rejected', decided_at: new Date().toISOString() })
    .eq('id', claim_id);
  if (e2) return NextResponse.json({ ok: false, error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
