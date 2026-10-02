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
import { getFullSeries, getLiveQuote, pickDisplayPrice, type LiveQuote } from '@/lib/marketData';
import type { Lang } from '@/lib/i18n';
import { toHantDeep } from '@/lib/hant';

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
  live: LiveQuote | null,
  lang: Lang,
): RhythmResponse {
  const series = sliceRange(full, rangeId);
  const closes = series.map((p) => p.close);
  const lastClose = closes[closes.length - 1];
  const first = closes[0];

  // 展示价：盘中/盘后/盘前用实时报价，否则用日线收盘价（见 marketData.pickDisplayPrice）。
  // 诊断（judgment）永远走日线收盘序列，不受影响。
  const dailyLastDate = full.length > 0 ? full[full.length - 1].date : '';
  const { price: displayPrice, session } = pickDisplayPrice(
    lastClose,
    dailyLastDate,
    live,
  );
  const priceSession: RhythmResponse['priceSession'] = session;

  // 所选区间的分位低点/高点（5%/95% 分位数，抗离群点）
  const sorted = [...closes].sort((a, b) => a - b);
  const low = percentile(sorted, 5);
  const high = percentile(sorted, 95);
  const slicePos =
    closes.length >= 2 && high > low
      ? Math.round(Math.min(100, Math.max(0, ((displayPrice - low) / (high - low)) * 100)))
      : null;

  // 主判断：基于全量数据，锚定近 3 月（?lang=en 时诊断文案走英文）
  const judgment = buildJudgment(
    full.map((p) => p.close),
    lang,
  );

  const availableRanges = RANGE_DEFS.filter((d) => full.length >= d.minPoints).map(
    (d) => d.id,
  );

  return {
    symbol,
    range: rangeId,
    price: Number(displayPrice.toFixed(2)),
    priceLive: priceSession !== 'close',
    priceSession,
    priceTime: priceSession !== 'close' ? live!.time || null : null,
    // 盘中/盘前/收盘后报价：报价接口自带的当日涨跌（相对昨收）；
    // 盘后：相对上一根日线收盘（即今日至今的涨跌，日线尚未发布今日 bar 时它是上周五收盘）。
    // 报价没用上时为 null，前端只显示"收盘价"。
    dayChangePct: priceSession === 'close'
      ? null
      : priceSession === 'after-hours'
        ? Number((((live!.price - lastClose) / lastClose) * 100).toFixed(2))
        : live!.dayChangePct,
    prevClose: Number(lastClose.toFixed(2)),
    changePct: Number((((displayPrice - first) / first) * 100).toFixed(2)),
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
  const lp = req.nextUrl.searchParams.get('lang');
  const lang: Lang = lp === 'en' ? 'en' : lp === 'hant' ? 'hant' : 'zh';
  const debug = req.nextUrl.searchParams.get('debug') === '1';

  const { series, source, errors } = await getFullSeries(symbol);
  // 实时报价失败不影响主流程，静默降级为日线收盘价
  const live = await getLiveQuote(symbol).catch(() => null);
  const data = buildResponse(symbol, range, series, source, live, lang);
  // 繁体：中文链路照常生成，输出前整包转繁体（键名不动，只转一次）
  if (debug) {
    const dbg = { ...data, _debug: { errors, fullPoints: series.length } };
    return NextResponse.json(lang === 'hant' ? toHantDeep(dbg) : dbg);
  }
  return NextResponse.json(lang === 'hant' ? toHantDeep(data) : data);
}
