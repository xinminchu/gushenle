// src/app/api/forward-return/route.ts
// 给定标的 + 操作日，返回操作后第 5 / 20 个交易日的涨跌幅（用于操作复盘：卖飞/买高）
import { NextRequest, NextResponse } from 'next/server';
import { getFullSeries } from '@/lib/marketData';

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || '').toUpperCase();
  const date = req.nextUrl.searchParams.get('date') || ''; // YYYY-MM-DD
  if (!symbol || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '参数缺失' }, { status: 400 });
  }

  const { series, source } = await getFullSeries(symbol);
  if (source === 'simulated' || series.length === 0) {
    return NextResponse.json({ error: '无行情数据' }, { status: 404 });
  }

  // 找到操作日当天或之前最近的交易日
  let idx = -1;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i].date <= date) {
      idx = i;
      break;
    }
  }
  if (idx < 0) return NextResponse.json({ error: '日期超出范围' }, { status: 404 });

  const base = series[idx].close;
  const pct = (j: number): number | null => {
    if (idx + j >= series.length || base <= 0) return null;
    return ((series[j + idx].close - base) / base) * 100;
  };

  return NextResponse.json({
    symbol,
    date: series[idx].date,
    priceAt: Math.round(base * 100) / 100,
    r5: pct(5) == null ? null : Math.round(pct(5)! * 10) / 10,
    r20: pct(20) == null ? null : Math.round(pct(20)! * 10) / 10,
    tradingDaysAfter: series.length - 1 - idx,
  });
}

