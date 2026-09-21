// src/app/api/rhythm/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const range = searchParams.get('range') || '1M';

  // 映射前端 range 到 Yahoo API 参数
  let rangeParam = '1mo';
  if (range === '1W') rangeParam = '5d';
  if (range === '3M') rangeParam = '3mo';
  if (range === '1Y') rangeParam = '1y';

  try {
    // 使用 Yahoo Finance 原生 v8 API 接口，并携带 User-Agent 伪装
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=${rangeParam}&interval=1d`;

    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      next: { revalidate: 60 }, // 缓存 60 秒，避免频繁调用被限制
    });

    if (!res.ok) {
      throw new Error(`Yahoo API responded with status: ${res.status}`);
    }

    const json = await res.json();
    const result = json.chart?.result?.[0];

    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error('Invalid data structure from Yahoo API');
    }

    const quotes = result.indicators.quote[0];
    const timestamps = result.timestamp;

    // 过滤掉空值数据
    const validData: Array<{ close: number; high: number; low: number; date: string }> = [];

    for (let i = 0; i < timestamps.length; i++) {
      const close = quotes.close[i];
      const high = quotes.high[i];
      const low = quotes.low[i];

      if (close != null && high != null && low != null) {
        validData.push({
          close,
          high,
          low,
          date: new Date(timestamps[i] * 1000).toLocaleDateString('zh-CN', {
            month: '2-digit',
            day: '2-digit',
          }),
        });
      }
    }

    if (validData.length === 0) {
      throw new Error('No valid price points available');
    }

    // 计算实时与谷峰律动数据
    const prices = validData.map((d) => d.close);
    const highs = validData.map((d) => d.high);
    const lows = validData.map((d) => d.low);

    const latestPrice = Number(prices[prices.length - 1].toFixed(2));
    const peak = Number(Math.max(...highs).toFixed(2));
    const valley = Number(Math.min(...lows).toFixed(2));

    const span = peak - valley;
    const rhythmPos =
      span > 0 ? Number((((latestPrice - valley) / span) * 100).toFixed(1)) : 50;

    return NextResponse.json({
      symbol,
      range,
      latestPrice,
      peak,
      valley,
      rhythmPos,
      series: validData,
    });
  } catch (error: any) {
    console.error(`Fetch rhythm error for ${symbol}:`, error?.message || error);

    // 备用兜底逻辑：如果外部 API 临时超时，返回基于前一日的基准模拟数据，确保前端界面绝不留空
    const basePrices: Record<string, number> = {
      AAPL: 228.45,
      NVDA: 118.20,
      TSLA: 238.10,
      MSFT: 432.60,
    };
    const base = basePrices[symbol] || 150.0;
    const mockPeak = Number((base * 1.08).toFixed(2));
    const mockValley = Number((base * 0.92).toFixed(2));
    const mockPos = Number((((base - mockValley) / (mockPeak - mockValley)) * 100).toFixed(1));

    return NextResponse.json({
      symbol,
      range,
      latestPrice: base,
      peak: mockPeak,
      valley: mockValley,
      rhythmPos: mockPos,
      series: [],
      isFallback: true,
    });
  }
}