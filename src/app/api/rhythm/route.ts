// src/app/api/rhythm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { RhythmPoint, RhythmResponse } from '@/lib/rhythm';

const RANGE_MAP: Record<string, string> = {
  '1W': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '1Y': '1y',
};

/** 各区间在 Stooq 日线里需要保留的最近天数 */
const RANGE_DAYS: Record<string, number> = {
  '1W': 7,
  '1M': 32,
  '3M': 95,
  '1Y': 370,
};

interface YahooChartResult {
  timestamp: number[];
  indicators: {
    quote: Array<{
      close: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
    }>;
  };
}

interface YahooChartResponse {
  chart: {
    result?: YahooChartResult[];
    error?: { code: string; description: string };
  };
}

/** 各标的的基准价：兜底模拟曲线用，保证价格看起来真实 */
const BASE_PRICES: Record<string, number> = {
  AAPL: 228.45,
  NVDA: 118.2,
  TSLA: 238.1,
  MSFT: 432.6,
};

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 简单内存缓存（单实例内有效，Vercel 多实例下主要靠下面 fetch 的 Data Cache）
const cache = new Map<string, { data: RhythmResponse; expires: number }>();

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildResponse(
  symbol: string,
  range: string,
  series: RhythmPoint[],
  source: RhythmResponse['source'],
): RhythmResponse {
  const closes = series.map((p) => p.close);
  const peakPrice = Math.max(...closes);
  const valleyPrice = Math.min(...closes);
  const last = closes[closes.length - 1];
  const first = closes[0];
  const span = peakPrice - valleyPrice;
  return {
    symbol,
    range,
    price: Number(last.toFixed(2)),
    changePct: Number((((last - first) / first) * 100).toFixed(2)),
    peak: {
      price: Number(peakPrice.toFixed(2)),
      date: series[closes.indexOf(peakPrice)].date,
    },
    valley: {
      price: Number(valleyPrice.toFixed(2)),
      date: series[closes.indexOf(valleyPrice)].date,
    },
    rhythmPos: span > 0 ? Math.round(((last - valleyPrice) / span) * 100) : 50,
    series,
    source,
    updatedAt: new Date().toISOString(),
  };
}

/* ---------- 确定性随机数：兜底数据每天、每标的、每区间全网一致 ---------- */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 全部真实源都不可用时的兜底：同一天内任何设备拿到的数据完全一致 */
function simulated(symbol: string, range: string): RhythmResponse {
  const base = BASE_PRICES[symbol] ?? 150;
  const rand = mulberry32(hashSeed(`${symbol}:${range}:${isoDate(new Date())}`));
  const points = 30;
  const now = Date.now();
  const series: RhythmPoint[] = [];
  let price = base * 0.96;
  for (let i = points - 1; i >= 0; i--) {
    price = price * (1 + (Math.sin(i * 0.7) * 0.5 + (rand() - 0.48)) * 0.02);
    series.push({
      date: isoDate(new Date(now - i * 86400000)),
      close: Number(price.toFixed(2)),
    });
  }
  return buildResponse(symbol, range, series, 'simulated');
}

/* ---------- 数据源 ---------- */

/** Yahoo Finance 日线。next.revalidate 让 Vercel Data Cache 在多实例间共享，
 *  大幅降低请求频率，避免被 Yahoo 限流。 */
async function fetchYahoo(symbol: string, yahooRange: string): Promise<RhythmPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=${yahooRange}&interval=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Yahoo status ${res.status}`);
  const json = (await res.json()) as YahooChartResponse;
  const result = json.chart?.result?.[0];
  if (!result?.timestamp || !result.indicators?.quote?.[0]) {
    throw new Error(json.chart?.error?.description || 'bad Yahoo payload');
  }
  const quotes = result.indicators.quote[0];
  const series: RhythmPoint[] = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    const close = quotes.close[i];
    if (close != null) {
      series.push({
        date: isoDate(new Date(result.timestamp[i] * 1000)),
        close: Number(close.toFixed(2)),
      });
    }
  }
  if (series.length < 2) throw new Error('Yahoo returned too few points');
  return series;
}

/** Stooq 免费日线 CSV（无 key），Yahoo 被限流时的备用真实源 */
async function fetchStooq(symbol: string, range: string): Promise<RhythmPoint[]> {
  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&i=d`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Stooq status ${res.status}`);
  const text = await res.text();
  const rows = text.trim().split('\n').slice(1);
  const days = RANGE_DAYS[range] ?? 32;
  const series: RhythmPoint[] = [];
  for (const row of rows) {
    const cols = row.split(',');
    const close = Number(cols[4]);
    if (cols[0] && Number.isFinite(close)) {
      series.push({ date: cols[0], close: Number(close.toFixed(2)) });
    }
  }
  const sliced = series.slice(-days);
  if (sliced.length < 2) throw new Error('Stooq returned too few points');
  return sliced;
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'AAPL').toUpperCase();
  const range = req.nextUrl.searchParams.get('range') || '1M';
  const cacheKey = `${symbol}:${range}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  let series: RhythmPoint[] | null = null;
  let source: RhythmResponse['source'] = 'simulated';

  try {
    series = await fetchYahoo(symbol, RANGE_MAP[range] || '1mo');
    source = 'yahoo';
  } catch (e1) {
    console.error(`Yahoo failed for ${symbol}:`, e1 instanceof Error ? e1.message : e1);
    try {
      series = await fetchStooq(symbol, range);
      source = 'stooq';
    } catch (e2) {
      console.error(`Stooq failed for ${symbol}:`, e2 instanceof Error ? e2.message : e2);
    }
  }

  const data = series ? buildResponse(symbol, range, series, source) : simulated(symbol, range);
  cache.set(cacheKey, { data, expires: Date.now() + 60_000 });
  return NextResponse.json(data);
}
