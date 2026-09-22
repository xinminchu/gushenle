'use client';

import { useEffect, useRef } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import type { RhythmPoint } from '@/lib/rhythm';
import type { ColorScheme } from '@/lib/colorScheme';
import { upHex, downHex } from '@/lib/colorScheme';

export type ChartType = 'candle' | 'line';

interface RhythmChartProps {
  series: RhythmPoint[];
  height?: number;
  /** 3M 及以内默认 K线，长区间默认收盘线；用户可手动切换 */
  chartType: ChartType;
  /** 是否用虚线标出所选区间的最高 / 最低 */
  showRangeHL: boolean;
  /** 涨跌配色：cn=红涨绿跌，us=绿涨红跌 */
  scheme: ColorScheme;
}

/**
 * 谷峰律动价格走势图（lightweight-charts）
 * K线：每天一根蜡烛，实体=开→收，影线=高低点；收盘线：面积图。
 * 深色主题，随容器宽度自适应。
 */
export default function RhythmChart({
  series,
  height = 220,
  chartType,
  showRangeHL,
  scheme,
}: RhythmChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const UP = upHex(scheme);
  const DOWN = downHex(scheme);

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

    if (chartType === 'candle') {
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        borderVisible: false,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      candles.setData(
        series.map((p) => ({
          time: p.date,
          open: p.open ?? p.close,
          high: p.high ?? p.close,
          low: p.low ?? p.close,
          close: p.close,
        })),
      );
      if (showRangeHL && series.length > 0) {
        const hi = Math.max(...series.map((p) => p.high ?? p.close));
        const lo = Math.min(...series.map((p) => p.low ?? p.close));
        candles.createPriceLine({
          price: hi,
          color: 'rgba(244, 63, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '区间最高',
        });
        candles.createPriceLine({
          price: lo,
          color: 'rgba(34, 197, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '区间最低',
        });
      }
    } else {
      // 收盘线颜色跟随区间净涨跌 + 当前配色方案
      const first = series[0]?.close ?? 0;
      const last = series[series.length - 1]?.close ?? 0;
      const line = last >= first ? UP : DOWN;
      const area = chart.addSeries(AreaSeries, {
        lineColor: line,
        lineWidth: 2,
        topColor: `${line}59`,
        bottomColor: `${line}05`,
        priceLineVisible: true,
        lastValueVisible: true,
      });
      area.setData(series.map((p) => ({ time: p.date, value: p.close })));
      if (showRangeHL && series.length > 0) {
        const hi = Math.max(...series.map((p) => p.close));
        const lo = Math.min(...series.map((p) => p.close));
        area.createPriceLine({
          price: hi,
          color: 'rgba(244, 63, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '区间最高',
        });
        area.createPriceLine({
          price: lo,
          color: 'rgba(34, 197, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: '区间最低',
        });
      }
    }
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
  }, [series, height, chartType, showRangeHL, scheme]);

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
