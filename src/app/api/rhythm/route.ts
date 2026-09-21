// src/app/api/rhythm/route.ts
import { NextResponse } from 'next/server';
import yahooFinance from 'yahoo-finance2';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const range = searchParams.get('range') || '1M';

  // 根据 range 转换 query 时间范围
  let period1 = new Date();
  if (range === '1W') period1.setDate(period1.getDate() - 7);
  else if (range === '1M') period1.setMonth(period1.getMonth() - 1);
  else if (range === '3M') period1.setMonth(period1.getMonth() - 3);
  else if (range === '1Y') period1.setFullYear(period1.getFullYear() - 1);
  else period1.setMonth(period1.getMonth() - 1);

  try {
    // 1. 获取真实的 Yahoo Finance K线历史数据
    const queryOptions = {
      period1: period1.toISOString().split('T')[0],
      interval: (range === '1W' ? '1d' : '1d') as '1d',
    };
    
    const result = await yahooFinance.historical(symbol, queryOptions);

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'No data found' }, { status: 400 });
    }

    // 2. 真实计算“谷峰律动”
    const prices = result.map((item) => item.close);
    const highs = result.map((item) => item.high);
    const lows = result.map((item) => item.low);

    const latestPrice = Number(prices[prices.length - 1].toFixed(2));
    const peak = Number(Math.max(...highs).toFixed(2));
    const valley = Number(Math.min(...lows).toFixed(2));

    // 计算当前位置在谷峰区间的百分比 (%)
    const rangeSpan = peak - valley;
    const rhythmPos = rangeSpan > 0 
      ? Number((((latestPrice - valley) / rangeSpan) * 100).toFixed(1))
      : 50;

    // 组装历史数据供前端画图
    const series = result.map((item) => ({
      date: new Date(item.date).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }),
      close: Number(item.close.toFixed(2)),
      high: Number(item.high.toFixed(2)),
      low: Number(item.low.toFixed(2)),
    }));

    return NextResponse.json({
      symbol,
      range,
      latestPrice,
      peak,
      valley,
      rhythmPos,
      series,
    });
  } catch (error) {
    console.error(`Fetch error for ${symbol}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch real-time financial data' },
      { status: 500 }
    );
  }
}