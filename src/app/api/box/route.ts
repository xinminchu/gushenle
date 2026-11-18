// src/app/api/box/route.ts
// 箱体律动数据：全量日线（收盘）+ 系统侦测的候选箱 + 这只股的出箱史统计。
// 用户自定箱存在本机，触边史由前端用同一份 closes 计算（口径与 lib/box 一致）。
import { NextRequest, NextResponse } from 'next/server';
import { getFullSeries } from '@/lib/marketData';
import { detectBoxes, breakoutHistory, type SeriesPoint } from '@/lib/box';

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || '').toUpperCase();
  if (!symbol) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 });
  }
  const { series, source } = await getFullSeries(symbol);
  if (source === 'simulated' || series.length < 40) {
    return NextResponse.json({ error: '无行情数据' }, { status: 404 });
  }
  const points: SeriesPoint[] = series.map((p) => ({ date: p.date, close: p.close }));
  const suggested = detectBoxes(points).slice(-3);
  const history = breakoutHistory(points);
  return NextResponse.json({
    symbol,
    points,
    suggested,
    history,
  });
}
