// app/api/rhythm/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol') || 'AAPL';
  const range = searchParams.get('range') || '1M';

  try {
    // 提示：真实环境中，如需使用 Python 的 yfinance 逻辑，
    // 可以在此调用你的 Python 接口，或者直接用 JS 模拟逻辑 / 调用 Yahoo Finance API
    
    // 这里以模拟返回符合谷峰律动的数据结构为例：
    const mockData = generateRhythmData(symbol, range);
    return NextResponse.json(mockData);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch rhythm data' }, { status: 500 });
  }
}

function generateRhythmData(symbol: string, range: string) {
  // 此处替换为你的真实计算/获取逻辑
  return {
    symbol,
    range,
    latestPrice: 185.50,
    peak: 192.00,
    valley: 178.00,
    rhythmPos: 53.5, // (185.5 - 178) / (192 - 178) * 100
    signal: 'HOLD',
    // series: [...] 历史数据数组
  };
}