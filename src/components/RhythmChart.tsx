'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  LineSeries,
  LineStyle,
  createChart,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { CreatePriceLineOptions, IChartApi, ISeriesApi, MouseEventParams, SeriesMarker, SeriesType, Time } from 'lightweight-charts';
import type { RhythmPoint } from '@/lib/rhythm';
import type { ColorScheme } from '@/lib/colorScheme';
import { upHex, downHex } from '@/lib/colorScheme';
import type { FibLevel } from '@/lib/fibonacci';
import { fibRatioLabel } from '@/lib/fibonacci';
import type { KeyLevel } from '@/lib/brief';
import type { Lang } from '@/lib/i18n';
import { tx } from '@/lib/hant';

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
  /** 关键价位线：年高 / 年低 / MA50 / 黄金分割回撤（细虚线 + 轴上小标签） */
  keyLevels?: KeyLevel[] | null;
  /** 是否显示关键价位线 */
  showKeyLevels?: boolean;
  /** 事件标记：财报 / 宏观事件（议息/CPI/非农）在图上的小圆点，点圆点看事件详情 */
  eventMarkers?: ChartEventMarker[] | null;
  /** 点中事件圆点时的回调（轻量图表库的圆点本身不可点，用整图 click 按时间匹配） */
  onEventMarkerClick?: (m: ChartEventMarker) => void;
  lang?: Lang;
}

/** 图上事件圆点：财报 / 宏观事件（议息/CPI/非农），点圆点看事件详情 */
export interface ChartEventMarker {
  time: string;
  kind: 'earnings' | 'macro';
  /** 宏观事件细分：fomc=议息，cpi=CPI，nonfarm=非农（决定弹窗图标与一句话说明） */
  macroKind?: 'fomc' | 'cpi' | 'nonfarm';
  title: string;
  titleEn: string;
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
  keyLevels,
  showKeyLevels = false,
  eventMarkers,
  onEventMarkerClick,
  lang = 'zh',
}: RhythmChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  // 用户双指缩放/拖动过图表后，露出「重置缩放」按钮（之前有人放大后找不到缩回去的办法）
  const [zoomed, setZoomed] = useState(false);
  const UP = upHex(scheme);
  const DOWN = downHex(scheme);
  // 区间高低点数值：画在左上角 HTML 图例里，避免压住右侧价格轴
  const [hl, setHl] = useState<{ hi: number; lo: number } | null>(null);
  const hasMarkers = !!eventMarkers && eventMarkers.length > 0;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || series.length === 0) return;
    setZoomed(false);

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
        // 上方（压力/上行目标）用涨色块，下方（支撑/下行目标）用跌色块；
        // 线保持金色虚线（黄金分割的身份），只给轴标签方块按方向上色。
        const pill = lv.kind === 'resistance' || lv.kind === 'target-up' ? UP : DOWN;
        s.createPriceLine({
          price: lv.price,
          color: 'rgba(212, 160, 23, 0.6)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          axisLabelColor: pill,
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

    /** 关键价位线：细虚线 + 轴上小标签，不参与自动缩放（超出可视范围就自然裁掉） */
    const drawKeyLevels = (s: {
      createPriceLine: (opts: CreatePriceLineOptions) => unknown;
    }) => {
      if (!showKeyLevels || !keyLevels || keyLevels.length === 0) return;
      for (const k of keyLevels) {
        s.createPriceLine({
          price: k.price,
          color: k.color,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: k.label,
        });
      }
    };

    /** 事件标记：小圆点落在对应 bar 上方（v5 走 series-markers 插件）。
     * 圆点本身不可点：整图订阅 click，按时间匹配到圆点后走 onEventMarkerClick。
     * 时间必须精确命中一根 bar，否则标记画不出来，所以先过滤。 */
    const applyEventMarkers = <T extends SeriesType>(s: ISeriesApi<T, Time>) => {
      if (!eventMarkers || eventMarkers.length === 0) return;
      const inRange = new Set(series.map((p) => p.date));
      const ms: SeriesMarker<Time>[] = [];
      for (const m of eventMarkers) {
        if (!inRange.has(m.time)) continue;
        const isEarn = m.kind === 'earnings';
        ms.push({
          time: m.time,
          position: 'aboveBar',
          shape: 'circle',
          color: isEarn ? 'rgba(167, 139, 250, 0.95)' : 'rgba(245, 158, 11, 0.95)',
          size: 2.2,
        });
      }
      if (ms.length > 0) createSeriesMarkers(s, ms);
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
          title: tx(lang, 'Range high', '区间最高'),
        });
        candles.createPriceLine({
          price: loV,
          color: 'rgba(34, 197, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: tx(lang, 'Range low', '区间最低'),
        });
        setHl({ hi, lo: loV });
      } else {
        setHl(null);
      }
      drawFibLines(candles);
      drawPrevCloseLine(candles);
      drawKeyLevels(candles);
      applyEventMarkers(candles);
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
      applyEventMarkers(closeSeries);
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
          title: tx(lang, 'Range high', '区间最高'),
        });
        area.createPriceLine({
          price: lo,
          color: 'rgba(34, 197, 94, 0.55)',
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: tx(lang, 'Range low', '区间最低'),
        });
        setHl({ hi, lo });
      } else {
        setHl(null);
      }
      drawFibLines(area);
      drawPrevCloseLine(area);
      drawKeyLevels(area);
      applyEventMarkers(area);
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
    chartApiRef.current = chart;
    // 缩放/平移检测：跟 fitContent 后的 home 区间比，偏离超过 1 根 bar 即认为用户动过图表，露出重置按钮
    const ts = chart.timeScale();
    const homeRange = ts.getVisibleLogicalRange();
    const checkZoom = () => {
      const r = ts.getVisibleLogicalRange();
      if (!r || !homeRange) return;
      const z = Math.abs(r.from - homeRange.from) > 1 || Math.abs(r.to - homeRange.to) > 1;
      setZoomed((prev) => (prev === z ? prev : z));
    };
    ts.subscribeVisibleLogicalRangeChange(checkZoom);
    checkZoom();

    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      if (w > 0) chart.applyOptions({ width: w });
    });
    ro.observe(el);

    // 点事件圆点：按点击时间匹配圆点（库的 marker 本身不可点）
    // 放宽匹配：点击位置前后 3 天内有事件即命中（圆点小，精确点中难）
    const handleClick = (param: MouseEventParams<Time>) => {
      if (!onEventMarkerClick || !eventMarkers || param.time == null) return;
      const t = String(param.time);
      let hit = eventMarkers.find((m) => m.time === t);
      if (!hit && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
        const tMs = new Date(t + 'T12:00:00Z').getTime();
        let best: ChartEventMarker | null = null;
        let bestDist = 3 * 86400000 + 1;
        for (const m of eventMarkers) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(m.time)) continue;
          const d = Math.abs(new Date(m.time + 'T12:00:00Z').getTime() - tMs);
          if (d < bestDist) {
            bestDist = d;
            best = m;
          }
        }
        hit = best ?? undefined;
      }
      if (hit) onEventMarkerClick(hit);
    };
    chart.subscribeClick(handleClick);

    return () => {
      chart.unsubscribeClick(handleClick);
      ts.unsubscribeVisibleLogicalRangeChange(checkZoom);
      ro.disconnect();
      chartApiRef.current = null;
      chart.remove();
    };
  }, [series, height, chartType, showRangeHL, fibLevels, fibScaleLevels, scheme, UP, DOWN, prevCloseLabel, keyLevels, showKeyLevels, eventMarkers, onEventMarkerClick, lang]);

  /** 一键回到初始全量视图：时间轴全显 + 价格轴自动缩放 */
  const resetZoom = () => {
    const c = chartApiRef.current;
    if (!c) return;
    c.timeScale().fitContent();
    c.priceScale('right').applyOptions({ autoScale: true });
  };

  if (series.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-slate-500 text-sm bg-slate-900 rounded-2xl border border-slate-800"
        style={{ height }}
      >
        {tx(lang, 'No chart data', '暂无走势数据')}
      </div>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={containerRef} className="w-full h-full" />
      {/* 用户缩放/平移过图表后，右下角露出重置按钮，一键回到全量视图 */}
      {zoomed && (
        <button
          onClick={() => { resetZoom(); setZoomed(false); }}
          className="absolute bottom-2 right-2 z-10 flex items-center gap-1 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-700 shadow-lg transition-colors"
          aria-label={tx(lang, 'Reset zoom', '重置缩放')}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {tx(lang, 'Reset zoom', '重置缩放')}
        </button>
      )}
      {/* 区间高低点图例：放左上角，不压右侧价格轴 */}
      {(hl ||
        (fibLevels && fibLevels.length > 0) ||
        prevCloseLabel ||
        hasMarkers ||
        (showKeyLevels && keyLevels && keyLevels.length > 0)) &&
        chartType !== 'ohlc' && (
        <div className="absolute top-1 left-1 right-16 flex flex-wrap items-center gap-x-2 gap-y-0.5 chart-legend text-[10px] text-slate-500 bg-slate-900/70 rounded px-1.5 py-0.5 pointer-events-none">
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
                {tx(lang, 'Range high', '区间最高')} {hl.hi.toFixed(2)}
              </span>
              <span>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500/70 mr-1" />
                {tx(lang, 'Range low', '区间最低')} {hl.lo.toFixed(2)}
              </span>
            </>
          )}
          {fibLevels && fibLevels.length > 0 && (
            <span>
              <span className="inline-block w-2.5 h-0 border-t border-dashed border-yellow-600/80 mr-1 align-middle" />
              {tx(lang, 'Fibonacci', '黄金分割')}
            </span>
          )}
          {showKeyLevels && keyLevels && keyLevels.length > 0 && (
            <span>
              <span className="inline-block w-2.5 h-0 border-t border-dashed border-slate-400/70 mr-1 align-middle" />
              {tx(lang, 'Key levels', '关键价位')}
            </span>
          )}
          {hasMarkers && (
            <span>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-violet-400/80 mr-1" />
              {tx(lang, 'Earnings', '财报')}
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-600/80 mr-1 ml-2" />
              {tx(lang, 'Macro', '宏观事件')}
            </span>
          )}
        </div>
      )}
      {/* 四线图例 */}
      {chartType === 'ohlc' && (
        <div className="absolute top-1 left-1 right-16 flex flex-wrap items-center gap-x-2 gap-y-0.5 chart-legend text-[10px] text-slate-500 bg-slate-900/70 rounded px-1.5 py-0.5 pointer-events-none">
          {(
            [
              [tx(lang, 'High', '最高'), OHLC_COLORS.high],
              [tx(lang, 'Low', '最低'), OHLC_COLORS.low],
              [tx(lang, 'Open', '开盘'), OHLC_COLORS.open],
              [tx(lang, 'Close', '收盘'), OHLC_COLORS.close],
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
