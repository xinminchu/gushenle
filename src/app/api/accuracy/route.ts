// src/app/api/accuracy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { scoreAt, judgeFromScore } from '@/lib/rhythm';
import { getFullSeries } from '@/lib/marketData';

/**
 * 判断复盘：用历史数据做无未来函数的回测。
 * 对过去每一天 T：只用 T 及之前的数据算出综合分（与线上主判断同一算法），
 * 若分数 ≥80（过热）或 ≤20（超卖）则记一次"信号"，用 T+1 日的真实涨跌验证命中。
 *
 * 命中规则：
 * - 过热信号：次日涨幅 < 0.5% 算命中（涨不动了 = 别追的判断说中了）
 * - 超卖信号：次日跌幅 < 0.5% 算命中（没继续大跌 = 别慌的判断说中了）
 * - 中间分数不记信号（无明确判断）
 */

export interface Signal {
  date: string;
  score: number;
  status: string;
  type: 'overheat' | 'oversold';
  nextReturn: number;
  hit: boolean;
}

const accCache = new Map<string, { data: unknown; expires: number }>();

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'AAPL').toUpperCase();

  const hit = accCache.get(symbol);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  const { series, source } = await getFullSeries(symbol);
  if (source === 'simulated') {
    return NextResponse.json({
      symbol,
      available: false,
      reason: '当前为演示数据，不参与复盘。',
    });
  }

  const closes = series.map((p) => p.close);
  const dates = series.map((p) => p.date);
  const signals: Signal[] = [];

  // 复盘最近约 1 年的信号（每天需 ≥66 天历史做判断）
  const from = Math.max(65, closes.length - 2 - 365);
  for (let t = from; t <= closes.length - 2; t++) {
    const s = scoreAt(closes, t);
    if (!s) continue;
    let type: 'overheat' | 'oversold' | null = null;
    if (s.score >= 80) type = 'overheat';
    else if (s.score <= 20) type = 'oversold';
    if (!type) continue;
    const nextReturn = ((closes[t + 1] - closes[t]) / closes[t]) * 100;
    const ok = type === 'overheat' ? nextReturn < 0.5 : nextReturn > -0.5;
    signals.push({
      date: dates[t],
      score: s.score,
      status: judgeFromScore(s.score, s.trend).status,
      type,
      nextReturn: Math.round(nextReturn * 100) / 100,
      hit: ok,
    });
  }

  const rate = (list: Signal[]): number | null =>
    list.length ? Math.round((list.filter((s) => s.hit).length / list.length) * 1000) / 10 : null;
  const overheat = signals.filter((s) => s.type === 'overheat');
  const oversold = signals.filter((s) => s.type === 'oversold');

  const data = {
    symbol,
    available: true,
    stats: {
      total: signals.length,
      accuracy: rate(signals),
      overheat: { total: overheat.length, accuracy: rate(overheat) },
      oversold: { total: oversold.length, accuracy: rate(oversold) },
    },
    recent: [...signals].slice(-8).reverse(),
    rule: '过热信号（≥80分）次日涨幅 < 0.5% 算命中；超卖信号（≤20分）次日跌幅 < 0.5% 算命中；中间分数不记信号。',
    computedAt: new Date().toISOString(),
  };
  accCache.set(symbol, { data, expires: Date.now() + 3_600_000 });
  return NextResponse.json(data);
}
