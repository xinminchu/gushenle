// src/app/api/drawdown-history/route.ts
// 历史分位一句话：过去 N 年所有"单日大跌超阈值"之后 20 个交易日的表现分布。
// 只给 base rate（中位数 / 收涨占比），不预测、不建议。
import { NextRequest, NextResponse } from 'next/server';
import { getFullSeries } from '@/lib/marketData';

const DROP_THRESHOLD = -4; // 单日跌幅触发线（%）
const FWD_DAYS = 20;

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || '').toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 });
  }

  const { series, source } = await getFullSeries(symbol);
  if (source === 'simulated' || series.length < 60) {
    return NextResponse.json({ available: false, reason: 'no data' });
  }

  const fwds: number[] = [];
  for (let i = 1; i + FWD_DAYS < series.length; i++) {
    const prev = series[i - 1].close;
    const cur = series[i].close;
    if (!(prev > 0) || !(cur > 0)) continue;
    const drop = ((cur - prev) / prev) * 100;
    if (drop <= DROP_THRESHOLD) {
      fwds.push(((series[i + FWD_DAYS].close - cur) / cur) * 100);
    }
  }

  if (fwds.length === 0) {
    return NextResponse.json({ available: true, n: 0, threshold: DROP_THRESHOLD });
  }

  const sorted = [...fwds].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const median =
    sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  const positivePct = (sorted.filter((f) => f > 0).length / sorted.length) * 100;
  const years = (series.length / 252).toFixed(1);

  return NextResponse.json({
    available: true,
    symbol,
    threshold: DROP_THRESHOLD,
    fwdDays: FWD_DAYS,
    n: sorted.length,
    years,
    median20: Math.round(median * 10) / 10,
    positivePct: Math.round(positivePct),
  });
}
