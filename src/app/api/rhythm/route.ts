// src/app/api/rhythm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import type { RhythmPoint, RhythmResponse } from '@/lib/rhythm';

const RANGE_MAP: Record<string, string> = {
  '1W': '5d',
  '1M': '1mo',
  '3M': '3mo',
  '1Y': '1y',
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

/** 各标的的基准价：Yahoo 不可用时，用它做模拟曲线的起点，保证价格看起来真实 */
const BASE_PRICES: Record<string, number> = {
  AAPL: 228.45,
  NVDA: 118.2,
  TSLA: 238.1,
  MSFT: 432.6,
};

// 简单内存缓存，避免频繁请求 Yahoo
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

/** Yahoo 不可用时的兜底：围绕基准价生成一条平滑模拟曲线，保证页面不白屏 */
function simulated(symbol: string, range: string): RhythmResponse {
  const base = BASE_PRICES[symbol] ?? 150;
  const points = 30;
  const now = Date.now();
  const series: RhythmPoint[] = [];
  let price = base * 0.96;
  for (let i = points - 1; i >= 0; i--) {
    price = price * (1 + (Math.sin(i * 0.7) * 0.5 + (Math.random() - 0.48)) * 0.02);
    series.push({
      date: isoDate(new Date(now - i * 86400000)),
      close: Number(price.toFixed(2)),
    });
  }
  return buildResponse(symbol, range, series, 'simulated');
}

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'AAPL').toUpperCase();
  const range = req.nextUrl.searchParams.get('range') || '1M';
  const yahooRange = RANGE_MAP[range] || '1mo';
  const cacheKey = `${symbol}:${range}`;

  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol,
    )}?range=${yahooRange}&interval=1d`;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 60 }, // 缓存 60 秒，避免频繁调用被限制
    });
    if (!res.ok) throw new Error(`Yahoo API responded with status: ${res.status}`);

    const json = (await res.json()) as YahooChartResponse;
    const result = json.chart?.result?.[0];
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error(json.chart?.error?.description || 'Invalid data structure from Yahoo API');
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
    if (series.length < 2) throw new Error('No valid price points available');

    const data = buildResponse(symbol, range, series, 'yahoo');
    cache.set(cacheKey, { data, expires: Date.now() + 60_000 });
    return NextResponse.json(data);
  } catch (error) {
    console.error(`Fetch rhythm error for ${symbol}:`, error instanceof Error ? error.message : error);
    return NextResponse.json(simulated(symbol, range));
  }
}
