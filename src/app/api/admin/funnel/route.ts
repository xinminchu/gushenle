import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, serviceClient } from '@/lib/adminAuth';

/**
 * 习惯漏斗 v1：GET /api/admin/funnel?days=30（需管理员）
 *
 * 三步有序漏斗：diagnosis_view → operation_log → review_view。
 * 对每个 actor 按时间排序，只统计"按顺序走完"的转化（不是简单的各事件独立计数）。
 * 返回：每步人数、步间转化率、总人数、按天趋势。
 */

const STEPS = ['diagnosis_view', 'operation_log', 'review_view'] as const;

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(req);
  if (!admin) return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const svc = serviceClient();
  if (!svc) return NextResponse.json({ ok: false, error: 'no service key' }, { status: 500 });

  const days = Math.min(90, Math.max(1, parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30));
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await svc
    .from('funnel_events')
    .select('actor_id,event,created_at')
    .gte('created_at', since)
    .limit(20000);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // 按 actor 分组、按时间排序，求有序漏斗
  const rows = (data ?? []).slice().sort((a, b) =>
    String(a.created_at).localeCompare(String(b.created_at)),
  );
  const byActor = new Map<string, string[]>();
  for (const r of rows) {
    const arr = byActor.get(r.actor_id) || [];
    arr.push(r.event);
    byActor.set(r.actor_id, arr);
  }

  const stepCounts = [0, 0, 0];
  for (const seq of byActor.values()) {
    let stage = 0;
    for (const e of seq) {
      if (stage < 3 && e === STEPS[stage]) stage++;
    }
    for (let i = 0; i < stage; i++) stepCounts[i]++;
  }

  // 按天趋势：每天各事件去重人数
  const dayMap = new Map<string, Map<string, Set<string>>>();
  for (const r of rows) {
    const day = String(r.created_at).slice(0, 10);
    let m = dayMap.get(day);
    if (!m) { m = new Map(); dayMap.set(day, m); }
    let s = m.get(r.event);
    if (!s) { s = new Set(); m.set(r.event, s); }
    s.add(r.actor_id);
  }
  const daily = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, m]) => ({
      day,
      diagnosis_view: m.get('diagnosis_view')?.size ?? 0,
      operation_log: m.get('operation_log')?.size ?? 0,
      review_view: m.get('review_view')?.size ?? 0,
    }));

  const [s1, s2, s3] = stepCounts;
  return NextResponse.json({
    ok: true,
    days,
    totalActors: byActor.size,
    steps: [
      { event: 'diagnosis_view', label: '看了诊断', count: s1 },
      { event: 'operation_log', label: '记了一笔', count: s2, conv: s1 ? Math.round((s2 / s1) * 1000) / 10 : 0 },
      { event: 'review_view', label: '看了复盘', count: s3, conv: s2 ? Math.round((s3 / s2) * 1000) / 10 : 0 },
    ],
    daily,
  });
}
