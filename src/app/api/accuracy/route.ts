// src/app/api/accuracy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { statusLabel } from '@/lib/rhythm';
import type { Lang } from '@/lib/i18n';
import { toHantDeep } from '@/lib/hant';
import { computeAccuracy } from '@/lib/accuracy';
import type { SignalStatusKey } from '@/lib/rhythm';
import { createClient } from '@supabase/supabase-js';

/**
 * 判断复盘 v2：无未来函数回测 + 口径修正。
 * 计算逻辑在 @/lib/accuracy（与每日台账 cron 共用），这里只负责语言与缓存。
 * ?view=ledger&symbol=X：读 accuracy_ledger 台账（近60天），供趋势展示。
 */

const accCache = new Map<string, { data: unknown; expires: number }>();

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'AAPL').toUpperCase();

  // 台账视图：不走回测计算，直接读表
  if (req.nextUrl.searchParams.get('view') === 'ledger') {
    const svc = serviceClient();
    if (!svc) return NextResponse.json({ symbol, ledger: [], reason: 'supabase not configured' });
    const { data, error } = await svc
      .from('accuracy_ledger')
      .select('day,symbol,status_key,signals,hits,accuracy,baseline,edge,sample_days')
      .eq('symbol', symbol)
      .order('day', { ascending: true })
      .limit(300);
    if (error) return NextResponse.json({ symbol, ledger: [], reason: error.message });
    return NextResponse.json({ symbol, ledger: data ?? [] });
  }

  const lp = req.nextUrl.searchParams.get('lang');
  const lang: Lang = lp === 'en' ? 'en' : lp === 'hant' ? 'hant' : 'zh';
  const en = lang === 'en';
  // 繁体：中文链路照常生成，输出前整包转繁体（键名不动）；缓存 key 已含 lang，各语言独立缓存
  const out = (d: unknown) => NextResponse.json(lang === 'hant' ? toHantDeep(d) : d);

  const cacheKey = `${symbol}:${lang}`;
  const hit = accCache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return out(hit.data);

  const r = await computeAccuracy(symbol);
  if (!r.available) {
    return out({
      symbol,
      available: false,
      reason: en ? 'Demo data — excluded from backtests.' : '当前为演示数据，不参与复盘。',
    });
  }

  const { stats, signals } = r;
  const statuses = {} as Record<SignalStatusKey, { label: string; total: number; accuracy: number | null; baseline: number | null; edge: number | null }>;
  (Object.keys(stats.statuses) as SignalStatusKey[]).forEach((key) => {
    statuses[key] = { label: statusLabel(key, lang), ...stats.statuses[key] };
  });

  const data = {
    symbol,
    available: true,
    stats: {
      total: stats.total,
      accuracy: stats.accuracy,
      sampleDays: stats.sampleDays,
      baseline: stats.baseline,
      statuses,
    },
    recent: [...signals]
      .slice(-8)
      .reverse()
      .map((s) => ({
        date: s.date,
        score: s.score,
        status: statusLabel(s.statusKey, lang),
        statusKey: s.statusKey,
        tier: s.tier,
        nextReturn: s.nextReturn,
        hit: s.hit,
      })),
    rule: en
      ? 'Four states verified separately: overheated/strong-near-top/still-sliding (don\u2019t-chase semantics) count as hits when next-day gain < +0.5%; oversold (bounce-bet semantics) counts when next-day gain > -0.5%. Middle scores are not signals. Baseline = natural hit rate across all trading days in the same period.'
      : '四状态分别验证：涨太猛了/高位稳着涨/还在往下跌（别追、别抄底语义）次日涨幅<+0.5%算命中；跌过头了（赌反弹语义）次日涨幅>-0.5%算命中；中间分数不记信号。基线为同期全部交易日的天然命中率。',
    computedAt: new Date().toISOString(),
  };
  // 缓存存原文（简体），每次响应时再转繁体，保证只转一次
  accCache.set(cacheKey, { data, expires: Date.now() + 3_600_000 });
  return out(data);
}
