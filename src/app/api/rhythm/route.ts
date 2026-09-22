// src/app/api/rhythm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  RANGE_DEFS,
  RANGE_MAP,
  ANCHOR_RANGE_ID,
  percentile,
  buildJudgment,
  type RhythmPoint,
  type RhythmResponse,
} from '@/lib/rhythm';
import { getFullSeries } from '@/lib/marketData';

/**
 * 设计说明：
 * ① 每个标的只拉一次多年日线（Nasdaq 3年 / Yahoo 3y），展示区间在服务端切片；
 * ② 主判断（judgment）永远基于全量数据锚定近 3 月，不随展示区间变化；
 * ③ availableRanges 告诉前端哪些区间选项可以显示（上市不足的不显示）。
 */

function sliceRange(full: RhythmPoint[], rangeId: string): RhythmPoint[] {
  const def = RANGE_MAP[rangeId] ?? RANGE_MAP[ANCHOR_RANGE_ID];
  return full.slice(-def.points);
}

function buildResponse(
  symbol: string,
  rangeId: string,
  full: RhythmPoint[],
  source: RhythmResponse['source'],
): RhythmResponse {
  const series = sliceRange(full, rangeId);
  const closes = series.map((p) => p.close);
  const last = closes[closes.length - 1];
  const first = closes[0];

  // 所选区间的分位低点/高点（5%/95% 分位数，抗离群点）
  const sorted = [...closes].sort((a, b) => a - b);
  const low = percentile(sorted, 5);
  const high = percentile(sorted, 95);
  const slicePos =
    closes.length >= 2 && high > low
      ? Math.round(Math.min(100, Math.max(0, ((last - low) / (high - low)) * 100)))
      : null;

  // 主判断：基于全量数据，锚定近 3 月
  const judgment = buildJudgment(full.map((p) => p.close));

  const availableRanges = RANGE_DEFS.filter((d) => full.length >= d.minPoints).map(
    (d) => d.id,
  );

  return {
    symbol,
    range: rangeId,
    price: Number(last.toFixed(2)),
    changePct: Number((((last - first) / first) * 100).toFixed(2)),
    low: Number(low.toFixed(2)),
    high: Number(high.toFixed(2)),
    slicePos,
    series,
    fullPoints: full.length,
    availableRanges,
    judgment,
    source,
    updatedAt: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'AAPL').toUpperCase();
  const range = req.nextUrl.searchParams.get('range') || ANCHOR_RANGE_ID;
  const debug = req.nextUrl.searchParams.get('debug') === '1';

  const { series, source, errors } = await getFullSeries(symbol);
  const data = buildResponse(symbol, range, series, source);
  if (debug) {
    return NextResponse.json({ ...data, _debug: { errors, fullPoints: series.length } });
  }
  return NextResponse.json(data);
}
