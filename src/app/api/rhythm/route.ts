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
import { getFullSeries, getLiveQuote, type LiveQuote } from '@/lib/marketData';

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

const MONTH_NUM: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * 从报价时间串里抠出美东日历日期（YYYY-MM-DD）。
 * Nasdaq 格式如 "Sep 28, 2026 7:59 PM ET" 或 "Sep 28, 2026"；串里已经是美东时间，直接取日期部分，
 * 不做时区换算。解析失败返回 null（调用方按"不比日线新"处理）。
 */
function quoteDateISO(time: string): string | null {
  const m = /([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/.exec(time || '');
  if (!m) return null;
  const mon = MONTH_NUM[m[1]];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`;
}

function buildResponse(
  symbol: string,
  rangeId: string,
  full: RhythmPoint[],
  source: RhythmResponse['source'],
  live: LiveQuote | null,
  lang: 'zh' | 'en',
): RhythmResponse {
  const series = sliceRange(full, rangeId);
  const closes = series.map((p) => p.close);
  const lastClose = closes[closes.length - 1];
  const first = closes[0];

  // 价格来源：
  // ① 盘中用实时价；② 盘后用报价接口（夜盘价）；
  // ③ 盘前用报价接口（盘前价）；
  // ④ 收盘后~日线发布今日 bar 之前（约美东 20:00~次日），报价接口已有今日常规收盘价
  //    （如 SKHY 周一 21:56 ET 时报价 $181.92，日线还停在上周五 $191.56），此时也用报价，
  //    否则页面会整晚停在上一个交易日的收盘价。
  // 诊断（judgment）永远走日线收盘序列，不受影响。
  const quoteOk = !!live && live.price > 0;
  const afterHours =
    quoteOk && !live!.marketOpen && live!.marketStatus === 'After-Hours';
  const preMarket =
    quoteOk && !live!.marketOpen && live!.marketStatus === 'Pre-Market';
  const dailyLastDate = full.length > 0 ? full[full.length - 1].date : '';
  const qDate = quoteOk ? quoteDateISO(live!.time) : null;
  const quoteFresher = !!(qDate && dailyLastDate && qDate > dailyLastDate);
  const useQuote =
    quoteOk && (live!.marketOpen || afterHours || preMarket || quoteFresher);
  const priceSession: RhythmResponse['priceSession'] = !useQuote
    ? 'close'
    : live!.marketOpen
      ? 'live'
      : afterHours
        ? 'after-hours'
        : preMarket
          ? 'pre-market'
          : 'close';
  const displayPrice = useQuote ? live!.price : lastClose;

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
    priceLive: useQuote,
    priceSession,
    priceTime: useQuote ? live!.time || null : null,
    // 盘中/盘前/收盘后报价：报价接口自带的当日涨跌（相对昨收）；
    // 盘后：相对上一根日线收盘（即今日至今的涨跌，日线尚未发布今日 bar 时它是上周五收盘）。
    // 报价没用上时为 null，前端只显示"收盘价"。
    dayChangePct: !useQuote
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
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'zh';
  const debug = req.nextUrl.searchParams.get('debug') === '1';

  const { series, source, errors } = await getFullSeries(symbol);
  // 实时报价失败不影响主流程，静默降级为日线收盘价
  const live = await getLiveQuote(symbol).catch(() => null);
  const data = buildResponse(symbol, range, series, source, live, lang);
  if (debug) {
    return NextResponse.json({ ...data, _debug: { errors, fullPoints: series.length } });
  }
  return NextResponse.json(data);
}
