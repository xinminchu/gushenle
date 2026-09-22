'use client';

import { useSearchParams } from 'next/navigation';
import RhythmChart, { type ChartType } from '@/components/RhythmChart';
import type { RhythmPoint } from '@/lib/rhythm';

/** 确定性伪随机，保证每次打开数据一致 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 写死 66 个交易日的 OHLC：形态接近 AAPL 近 3M（稳步上涨 + 波动） */
function hardcodedSeries(): RhythmPoint[] {
  const rand = mulberry32(20260922);
  const pts: RhythmPoint[] = [];
  let price = 296;
  const start = new Date(2026, 5, 17); // 2026-06-17
  let d = new Date(start);
  for (let i = 0; i < 66; i++) {
    // 跳过周末，模拟交易日
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    const drift = 0.0022 + Math.sin(i * 0.35) * 0.004;
    const shock = (rand() - 0.48) * 0.022;
    const close = price * (1 + drift + shock);
    const open = price * (1 + (rand() - 0.5) * 0.012);
    const high = Math.max(open, close) * (1 + rand() * 0.008);
    const low = Math.min(open, close) * (1 - rand() * 0.008);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    pts.push({
      date: `${yyyy}-${mm}-${dd}`,
      close: Number(close.toFixed(2)),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
    });
    price = close;
    d.setDate(d.getDate() + 1);
  }
  return pts;
}

const SERIES = hardcodedSeries();

const VARIANTS: Array<{ key: string; label: string; chartType: ChartType; showRangeHL: boolean }> = [
  { key: 'candle', label: 'A：纯K线', chartType: 'candle', showRangeHL: false },
  { key: 'candle-hl', label: 'B：K线+高低线', chartType: 'candle', showRangeHL: true },
  { key: 'line', label: 'C：收盘线(对照)', chartType: 'line', showRangeHL: false },
];

export default function TestChartInner() {
  const params = useSearchParams();
  const v = params.get('v') || 'candle';
  const active = VARIANTS.find((x) => x.key === v) ?? VARIANTS[0];

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>图表二分测试</h1>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
        当前：<b style={{ color: '#fff' }}>{active.label}</b>（数据写死，不调接口）
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {VARIANTS.map((x) => (
          <a
            key={x.key}
            href={`/test-chart?v=${x.key}`}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              fontSize: 13,
              background: x.key === active.key ? '#2563eb' : '#1e293b',
              color: '#fff',
              textDecoration: 'none',
            }}
          >
            {x.label}
          </a>
        ))}
      </div>
      <div style={{ background: '#020617', borderRadius: 12, padding: 8 }}>
        <RhythmChart series={SERIES} height={300} chartType={active.chartType} showRangeHL={active.showRangeHL} />
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        请逐个打开 A / B / C，记录哪个页面闪退（出现 This page couldn&apos;t load）。
      </p>
    </div>
  );
}
