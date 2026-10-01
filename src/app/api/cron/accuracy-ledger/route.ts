// src/app/api/cron/accuracy-ledger/route.ts
// 每日台账：收盘后自动跑核心股票的复盘回测，结果按天写入 accuracy_ledger。
// 由 Vercel Cron 每天触发（vercel.json：每天 13:00 UTC = 美东夏令时 9:00），用 ?secret=CRON_SECRET 鉴权。
// 手动触发：/api/cron/accuracy-ledger?secret=xxx&symbols=AAPL,NVDA

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { computeAccuracy, SIGNAL_KEYS } from '@/lib/accuracy';
import type { SignalStatusKey } from '@/lib/rhythm';

export const maxDuration = 60;

/** 台账覆盖的核心股票：默认自选 6 巨头 + IBM（用户真实持仓） */
const UNIVERSE = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'COIN', 'MSTR', 'IBM'];

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  // 鉴权：Vercel Cron 在配了 CRON_SECRET 后会自动带 Authorization: Bearer 头；
  // 手动触发可用 ?secret= 同值。
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const querySecret = req.nextUrl.searchParams.get('secret');
  const ok =
    !!process.env.CRON_SECRET &&
    (bearer === process.env.CRON_SECRET || querySecret === process.env.CRON_SECRET);
  if (!ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const svc = serviceClient();
  if (!svc) {
    return NextResponse.json({ error: 'supabase not configured' }, { status: 500 });
  }

  const param = (req.nextUrl.searchParams.get('symbols') || '').toUpperCase();
  const list = (param ? param.split(',').map((s) => s.trim()).filter(Boolean) : UNIVERSE).slice(0, 12);
  const day = new Date().toISOString().slice(0, 10); // UTC 日期：cron 定在美东早 8 点跑
  const results: Array<Record<string, unknown>> = [];

  for (const symbol of list) {
    try {
      const r = await computeAccuracy(symbol);
      if (!r.available) {
        results.push({ symbol, skipped: r.reason });
        continue;
      }
      const { stats } = r;
      const rows = [
        {
          day,
          symbol,
          status_key: 'all',
          signals: stats.total,
          hits: stats.hits,
          accuracy: stats.accuracy,
          baseline: null,
          edge: null,
          sample_days: stats.sampleDays,
        },
        ...(Object.keys(stats.statuses) as SignalStatusKey[])
          .filter((k) => (SIGNAL_KEYS as readonly string[]).includes(k))
          .map((k) => ({
            day,
            symbol,
            status_key: k,
            signals: stats.statuses[k].total,
            hits: stats.statuses[k].hits,
            accuracy: stats.statuses[k].accuracy,
            baseline: stats.statuses[k].baseline,
            edge: stats.statuses[k].edge,
            sample_days: stats.sampleDays,
          })),
      ];
      const { error } = await svc.from('accuracy_ledger').upsert(rows, {
        onConflict: 'day,symbol,status_key',
      });
      results.push({ symbol, ok: !error, rows: rows.length, error: error?.message ?? null });
    } catch (e) {
      results.push({ symbol, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ day, results });
}
