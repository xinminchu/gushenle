'use client';

import { useEffect, useRef } from 'react';
import { AreaSeries, ColorType, createChart } from 'lightweight-charts';
import type { RhythmPoint } from '@/lib/rhythm';

interface RhythmChartProps {
  series: RhythmPoint[];
  height?: number;
}

/**
 * 谷峰律动价格走势图（lightweight-charts）
 * 深色主题面积图，随容器宽度自适应。
 */
export default function RhythmChart({ series, height = 220 }: RhythmChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || series.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(100, 116, 139, 0.12)' },
        horzLines: { color: 'rgba(100, 116, 139, 0.12)' },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: false },
      crosshair: {
        vertLine: { color: 'rgba(16, 185, 129, 0.4)', labelBackgroundColor: '#10b981' },
        horzLine: { color: 'rgba(16, 185, 129, 0.4)', labelBackgroundColor: '#10b981' },
      },
    });

    const area = chart.addSeries(AreaSeries, {
      lineColor: '#10b981',
      lineWidth: 2,
      topColor: 'rgba(16, 185, 129, 0.35)',
      bottomColor: 'rgba(16, 185, 129, 0.02)',
      priceLineVisible: true,
      lastValueVisible: true,
    });
    area.setData(series.map((p) => ({ time: p.date, value: p.close })));
    chart.timeScale().fitContent();

    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) chart.applyOptions({ width: w });
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, [series, height]);

  if (series.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-500 text-sm bg-slate-900 rounded-2xl border border-slate-800"
        style={{ height }}
      >
        暂无走势数据
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height }} />;
}
