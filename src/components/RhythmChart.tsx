'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
} from 'lightweight-charts';
import type { CreatePriceLineOptions } from 'lightweight-charts';
import type { RhythmPoint } from '@/lib/rhythm';
import type { ColorScheme } from '@/lib/colorScheme';
import { upHex, downHex } from '@/lib/colorScheme';
import type { FibLevel } from '@/lib/fibonacci';
import { fibRatioLabel } from '@/lib/fibonacci';

export type ChartType = 'candle' | 'line' | 'ohlc';

interface RhythmChartProps {
  series: RhythmPoint[];
  height?: number;
  /** 3M 及以内默认 K线，长区间默认收盘线；用户可手动切换 */
  chartType: ChartType;
  /** 是否用虚线标出所选区间的最高 / 最低 */
  showRangeHL: boolean;
  /** 涨跌配色：cn=红涨绿跌，us=绿涨红跌 */
  scheme: ColorScheme;
  /** 黄金分割参考线（candle/line 图上画金色虚线） */
  fibLevels?: FibLevel[] | null;
  /** 喂给自动缩放的固定参考价集合：与所选组合无关，切换组合不跑比例尺 */
  fibScaleLevels?: FibLevel[] | null;
  /** 最后一根日线收盘线的标注：盘中=昨收，收盘后=收盘价（原来是图表库自动画的无名线，看着像实时价） */
  prevCloseLabel?: { price: number; text: string } | null;
}

/** 四线图图例颜色（中性色，不跟涨跌配色走） */
const OHLC_COLORS = {
  high: '#f43f5e', // 最高：玫红
  low: '#22c55e', // 最低：绿
  open: '#a78bfa', // 开盘：紫
  close: '#38bdf8', // 收盘：天蓝（主线，加粗）
};

/**
 * 谷峰律动价格走势图（lightweight-charts）
 * Attribution: charting library © TradingView (https://www.tradingview.com/),
 * lightweight-charts v5, Apache License 2.0.
 * 图内 attribution logo 已按库选项关闭，署名见页脚「版权与法律」。
 * K线：每天一根蜡烛，实体=开→收，影线=高低点；收盘线：面积图；
 * 四线：开/高/低/收四条曲线，看每天波动区间的变化。
 * 深色主题，随容器宽度自适应。
 */
export default function RhythmChart({
  series,
  height = 220,
  chartType,
  showRangeHL,
  scheme,
  fibLevels,
  fibScaleLevels,
  prevCloseLabel,
}: RhythmChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const UP = upHex(scheme);
  const DOWN = downHex(scheme);
  // 区间高低点数值：画在左上角 HTML 图例里，避免压住右侧价格轴
  const [hl, setHl] = useState<{ hi: number; lo: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || series.length === 0) return;

    const chart = createChart(el, {
      width: el.clientWidth,
      height,
      layout: {
        // 关掉图内 TradingView 小图标跳转；署名按库许可要求放到页脚（版权与法律）
        attributionLogo: false,
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

    const hlOf = (pick: (p: RhythmPoint) => number | undefined) => {
      const vals = series.map((p) => pick(p) ?? p.close);
      return { hi: Math.max(...vals), lo: Math.min(...vals) };
    };

    /** 黄金分割参考线：金色虚线，轴上标比例 */
    const drawFibLines = (s: {
      createPriceLine: (opts: CreatePriceLineOptions) => unknown;
    }) => {
      if (!fibLevels || fibLevels.length === 0) return;
      for (const lv of fibLevels) {
        s.createPriceLine({
          price: lv.price,
          color: 'rgba(212, 160, 23, 0.6)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: fibRatioLabel(lv),
        });
      }
    };

    /** 最后一根日线收盘线：玫瑰红虚线，轴上标价，左上角图例给名字 */
    const drawPrevCloseLine = (s: {
      createPriceLine: (opts: CreatePriceLineOptions) => unknown;
    }) => {
      if (!prevCloseLabel) return;
      s.createPriceLine({
        price: prevCloseLabel.price,
        color: 'rgba(244, 63, 94, 0.55)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: prevCloseLabel.text,
      });
    };

    if (chartType === 'candle') {
      const candles = chart.addSeries(CandlestickSeries, {
        upColor: UP,
        downColor: DOWN,
        wickUpColor: UP,
        wickDownColor: DOWN,
        borderVisible: false,
        // 关掉库自动的无名"最新价"线，换成下面带"昨收/收盘价"标注的线
        priceLineVisible: false,
        lastValueVisible: false,
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
        const { hi, lo } = hlOf((p) => p.high);
        const loV = hlOf((p) => p.low).lo;
        candles.createPriceLine({
          price: hi,
          color: 'rgba(244, 63, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '区间最高',
        });
        candles.createPriceLine({
          price: loV,
          color: 'rgba(34, 197, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '区间最低',
        });
        setHl({ hi, lo: loV });
      } else {
        setHl(null);
      }
      drawFibLines(candles);
      drawPrevCloseLine(candles);
    } else if (chartType === 'ohlc') {
      // 四线：开/高/低/收。极值线本身已展示区间上下沿，不再画虚线。
      const mk = (key: 'open' | 'high' | 'low' | 'close', color: string, width: 1 | 2) => {
        const s = chart.addSeries(LineSeries, {
          color,
          lineWidth: width,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: key === 'close',
        });
        s.setData(series.map((p) => ({ time: p.date, value: p[key] ?? p.close })));
        return s;
      };
      mk('high', OHLC_COLORS.high, 1);
      mk('low', OHLC_COLORS.low, 1);
      mk('open', OHLC_COLORS.open, 1);
      const closeSeries = mk('close', OHLC_COLORS.close, 2);
      drawPrevCloseLine(closeSeries);
      setHl(null);
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
        // 关掉库自动的无名"最新价"线，换成带"昨收/收盘价"标注的线
        priceLineVisible: false,
        lastValueVisible: false,
      });
      area.setData(series.map((p) => ({ time: p.date, value: p.close })));
      if (showRangeHL && series.length > 0) {
        const { hi, lo } = hlOf((p) => p.close);
        area.createPriceLine({
          price: hi,
          color: 'rgba(244, 63, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '区间最高',
        });
        area.createPriceLine({
          price: lo,
          color: 'rgba(34, 197, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '区间最低',
        });
        setHl({ hi, lo });
      } else {
        setHl(null);
      }
      drawFibLines(area);
      drawPrevCloseLine(area);
    }
    // 黄金分割线画出可视范围时，把价格轴缩放到能看见它们。
    // lightweight-charts 的 priceLine 不参与自动缩放，所以用一条全透明的线
    // 把各参考价"喂"给缩放逻辑（颜色透明、不画价格线、不响应十字线）。
    // 注意：喂的是固定的 fibScaleLevels（完整五线+扩展目标并集），
    // 与当前选中的组合无关——切换组合只换画的线，比例尺不动。
    const scaleLevels = fibScaleLevels && fibScaleLevels.length > 0 ? fibScaleLevels : fibLevels;
    if (scaleLevels && scaleLevels.length > 0 && series.length > 1) {
      const scaler = chart.addSeries(LineSeries, {
        color: 'rgba(0, 0, 0, 0)',
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      const n = series.length;
      const used = new Set<number>();
      const scalerData: { time: string; value: number }[] = [];
      scaleLevels.forEach((lv, i) => {
        const j = Math.min(n - 1, Math.floor(((i + 1) * n) / (scaleLevels.length + 1)));
        if (used.has(j)) return;
        used.add(j);
        scalerData.push({ time: series[j].date, value: lv.price });
      });
      if (scalerData.length > 0) scaler.setData(scalerData);
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
  }, [series, height, chartType, showRangeHL, fibLevels, fibScaleLevels, scheme, UP, DOWN, prevCloseLabel]);

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

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {/* 区间高低点图例：放左上角，不压右侧价格轴 */}
      {(hl || (fibLevels && fibLevels.length > 0) || prevCloseLabel) && chartType !== 'ohlc' && (
        <div className="absolute top-1 left-1 flex items-center gap-2 text-[10px] text-slate-500 bg-slate-900/70 rounded px-1.5 py-0.5 pointer-events-none">
          {prevCloseLabel && (
            <span>
              <span className="inline-block w-2.5 h-0 border-t border-dashed border-rose-500/70 mr-1 align-middle" />
              {prevCloseLabel.text} {prevCloseLabel.price.toFixed(2)}
            </span>
          )}
          {hl && (
            <>
              <span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500/70 mr-1" />
                区间最高 {hl.hi.toFixed(2)}
              </span>
              <span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500/70 mr-1" />
                区间最低 {hl.lo.toFixed(2)}
              </span>
            </>
          )}
          {fibLevels && fibLevels.length > 0 && (
            <span>
              <span className="inline-block w-2.5 h-0 border-t border-dashed border-yellow-600/80 mr-1 align-middle" />
              黄金分割
            </span>
          )}
        </div>
      )}
      {/* 四线图例 */}
      {chartType === 'ohlc' && (
        <div className="absolute top-1 left-1 flex items-center gap-2 text-[10px] text-slate-500 bg-slate-900/70 rounded px-1.5 py-0.5 pointer-events-none">
          {(
            [
              ['最高', OHLC_COLORS.high],
              ['最低', OHLC_COLORS.low],
              ['开盘', OHLC_COLORS.open],
              ['收盘', OHLC_COLORS.close],
            ] as const
          ).map(([label, color]) => (
            <span key={label}>
              <span
                className="inline-block w-2.5 h-[2px] rounded mr-1 align-middle"
                style={{ background: color }}
              />
              {label}
            </span>
          ))}
          {prevCloseLabel && (
            <span>
              <span className="inline-block w-2.5 h-0 border-t border-dashed border-rose-500/70 mr-1 align-middle" />
              {prevCloseLabel.text} {prevCloseLabel.price.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
