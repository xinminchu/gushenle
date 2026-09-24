import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/adminAuth';

/**
 * 站长（Mas）公开回复许愿池留言，所有人可见。
 *
 * POST   { id, reply_text }  新增/修改回复（需站长登录）
 * DELETE { id }              删除回复（需站长登录）
 *
 * 写入走 service_role 直写，RLS 不开放普通用户 update，
 * 因此只有站长能留官方回复。
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '需要站长登录' }, { status: 403 });
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: '服务端未配置' }, { status: 500 });

  let body: { id?: string; reply_text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  const text = (body.reply_text || '').trim().slice(0, 500);
  if (!body.id || !text) {
    return NextResponse.json({ error: '回复内容不能为空' }, { status: 400 });
  }
  const { error } = await svc
    .from('game_wishes')
    .update({ reply_text: text, replied_at: new Date().toISOString() })
    .eq('id', body.id);
  if (error) {
    const missing =
      error.message.includes('reply_text') || error.message.includes('replied_at');
    return NextResponse.json(
      { error: missing ? '009 迁移还没执行：先去「管理」→ 数据库迁移一键运行' : error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ error: '需要站长登录' }, { status: 403 });
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ error: '服务端未配置' }, { status: 500 });

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }
  if (!body.id) return NextResponse.json({ error: '参数错误' }, { status: 400 });
  const { error } = await svc
    .from('game_wishes')
    .update({ reply_text: null, replied_at: null })
    .eq('id', body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
