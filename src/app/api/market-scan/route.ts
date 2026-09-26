// src/app/api/market-scan/route.ts
// 公开读：最新一次扫描的结果 + 汇总。首页「今日信号」两行、盘前盘后两报都走这里。
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface ScanItem {
  symbol: string;
  name: string;
  score: number;
  statusKey: string;
  changePct: number | null;
  inflowEst: number | null;
}

function anon() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !ANON) return null;
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET() {
  const sb = anon();
  if (!sb) return NextResponse.json({ ok: false, error: 'supabase 未配置' }, { status: 500 });
  try {
    const { data: latest, error: e1 } = await sb
      .from('market_scan')
      .select('scan_date')
      .order('scan_date', { ascending: false })
      .limit(1);
    if (e1) throw e1;
    if (!latest || latest.length === 0) {
      return NextResponse.json({ ok: true, empty: true });
    }
    const scanDate = latest[0].scan_date as string;
    const { data: rows, error: e2 } = await sb
      .from('market_scan')
      .select('symbol,name,score,status_key,change_pct,inflow_est')
      .eq('scan_date', scanDate);
    if (e2) throw e2;
    const items: ScanItem[] = (rows || []).map((r) => ({
      symbol: r.symbol,
      name: r.name,
      score: r.score,
      statusKey: r.status_key || '',
      changePct: r.change_pct,
      inflowEst: r.inflow_est,
    }));

    // 两行：涨得欢 / 跌得凶，各取 5
    const hot = items
      .filter((i) => i.statusKey === 'overheated')
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const cold = items
      .filter((i) => i.statusKey === 'oversoldBottom')
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    // 大盘
    const idx = (s: string) => items.find((i) => i.symbol === s) || null;

    // 昨日资金异动：估算净流入/流出各前 3（标"估算"）
    const withFlow = items.filter((i) => i.inflowEst != null);
    const inflowTop = [...withFlow].sort((a, b) => (b.inflowEst ?? 0) - (a.inflowEst ?? 0)).slice(0, 3);
    const outflowTop = [...withFlow].sort((a, b) => (a.inflowEst ?? 0) - (b.inflowEst ?? 0)).slice(0, 3);

    const counts: Record<string, number> = {};
    for (const i of items) counts[i.statusKey || 'unknown'] = (counts[i.statusKey || 'unknown'] || 0) + 1;

    return NextResponse.json({
      ok: true,
      scanDate,
      total: items.length,
      hot,
      cold,
      qqq: idx('QQQ'),
      spy: idx('SPY'),
      inflowTop,
      outflowTop,
      counts,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
