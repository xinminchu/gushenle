// src/components/RhythmDashboard.tsx
'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Flame, ShieldAlert, TrendingUp, RefreshCw, ChevronRight } from 'lucide-react';
import RhythmChart, { type ChartType, type ChartEventMarker } from './RhythmChart';
import AccuracyPanel from './AccuracyPanel';
import ScoreSparkline from './ScoreSparkline';
import ChipPanel from './ChipPanel';
import FlowPanel from './FlowPanel';
import type { RhythmResponse } from '@/lib/rhythm';
import { RANGE_DEFS, RANGE_MAP, ANCHOR_RANGE_ID, scoreGradient, rangeLabel } from '@/lib/rhythm';
import { adviceWithPosition, convictionOf, type Conviction } from '@/lib/rhythm';
import { getRhythm, invalidateRhythm } from '@/lib/market';
import { useMarketAutoRefresh } from '@/hooks/useMarketAutoRefresh';
import { useWatchlist } from './WatchlistContext';
import CompanyIntro from './CompanyIntro';
import CompanyDeepDive from './CompanyDeepDive';
import { findStock, displayStockName } from '@/lib/stockList';
import { fmtMoney } from '@/lib/currency';
import { todayStr, type OpAction, loadOperations } from '@/lib/operations';
import { loadPositions, saveOperationAndSync } from '@/lib/positions';
import { useColorScheme, schemeLabel, upText, downText } from '@/lib/colorScheme';
import { useLanguage } from '@/context/LanguageContext';
import WatchlistSearch from './WatchlistSearch';
import WatchlistModal from './modals/WatchlistModal';
import MarketSignalBoard from './MarketSignalBoard';
import StockBriefs from './StockBriefs';
import { useFocusList } from '@/hooks/useFocusList';
import { FOCUS_MAX } from '@/lib/focus';
import BuyCheckup from './BuyCheckup';
import { useWatchlistData } from '@/hooks/useWatchlistData';
import { getStaticEvents, calEventTitle } from '@/lib/financeCalendar';
import type { SymbolReactions } from '@/app/api/earnings/route';
import { computeKeyLevels, actualHighLow } from '@/lib/brief';
import type { Lang } from '@/lib/i18n';
import { tx } from '@/lib/hant';
import {
  findSwing,
  fibLevels,
  fibAdviceHint,
  fibPlainAdvice,
  fibKindLabel,
  fibRatioLabel,
  nearestFibLevel,
  FIB_COMBOS,
  FIB_COMBO_IDS,
  dirComboId,
  fibComboDesc,
  fibComboName,
  RECOMMENDED_FIB_COMBO,
  RECOMMENDED_FIB_LOOKBACK,
  type FibComboId,
} from '@/lib/fibonacci';

// 主判断锚定区间标签（组件内按语言算，见 anchorLabel）
const anchorRangeDef = RANGE_MAP[ANCHOR_RANGE_ID];

/** 悬停气泡：鼠标挪上去，一句话说明这个按钮是干嘛的（桌面端 hover 生效） */
function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex group/tip">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-44 max-w-[70vw] px-2 py-1 rounded-lg bg-slate-900/95 border border-slate-700 text-[10px] leading-relaxed text-slate-300 shadow-xl opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 z-20 text-center">
        {text}
      </span>
    </span>
  );
}

/** 沉思乐弹窗的持仓感知内容：看持仓说话 */
interface ZenHoldings {
  kind: 'holding' | 'other' | 'none';
  shares?: number;
  avgCost?: number;
  price?: number;
  pnl?: number;
  pnlPct?: number;
  advice: string;
  heldSummary?: string;
}

function buildZenHoldings(symbol: string, price: number | null, lang: Lang = 'zh'): ZenHoldings | null {
  const en = lang === 'en';
  if (typeof window === 'undefined') return null;
  const positions = loadPositions();
  const pos = positions.find((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
  if (pos) {
    if (price == null || price <= 0) {
      return {
        kind: 'holding',
        shares: pos.shares,
        avgCost: pos.avgCost,
        advice: tx(lang, `You hold ${pos.shares} shares at ${fmtMoney(symbol, pos.avgCost)} — it's running hot, no rush to act. Consider taking some profit in batches?`, `你手里有 ${pos.shares} 股，成本 ${fmtMoney(symbol, pos.avgCost)}——涨这么猛，先别急着动手，看看要不要分批止盈？`),
      };
    }
    const pnl = (price - pos.avgCost) * pos.shares;
    const pnlPct = pos.avgCost > 0 ? ((price - pos.avgCost) / pos.avgCost) * 100 : 0;
    let advice: string;
    if (pnlPct >= 20) {
      advice = tx(lang, `Up ${pnlPct.toFixed(0)}% already — chasers are buying the top right now. Sell a slice and pocket some profit?`, `已经赚了 ${pnlPct.toFixed(0)}%，涨这么猛，追高的人正在接盘——要不要先卖一部分，把利润装进口袋？`);
    } else if (pnlPct >= 0) {
      advice = tx(lang, `Up a modest ${pnlPct.toFixed(1)}% — this kind of run makes hands shaky. Consider taking profit in batches: in for the upside, calm on the downside.`, `小赚 ${pnlPct.toFixed(1)}%，现在这个涨法拿着容易心态飘——可以考虑分批止盈，涨也有份、跌也不慌。`);
    } else if (pnlPct >= -10) {
      advice = tx(lang, `Still down ${Math.abs(pnlPct).toFixed(1)}% — this rally is a good chance to get closer to breakeven. Trim a bit while it's hot?`, `还亏 ${Math.abs(pnlPct).toFixed(1)}%，这波大涨是回本的好机会——要不要趁热减点仓？`);
    } else {
      advice = tx(lang, `Still underwater ${Math.abs(pnlPct).toFixed(1)}% — rallies like this are rare windows to cut losses. Don't wait for it to round-trip; sell a slice?`, `还套着 ${Math.abs(pnlPct).toFixed(1)}%，反弹是难得的减亏窗口——别等涨回去又舍不得，分批走一点？`);
    }
    return { kind: 'holding', shares: pos.shares, avgCost: pos.avgCost, price, pnl, pnlPct, advice };
  }
  if (positions.length > 0) {
    const heldSummary = positions
      .slice(0, 3)
      .map((p) => p.symbol)
      .join('、');
    return {
      kind: 'other',
      advice: tx(lang, `You don't hold ${symbol} yet. Chasing it now means holding the bag for someone else — if you really like it, wait for it to cool down.`, `你手里还没有 ${symbol}。涨成这样现在追进去，容易替别人站岗——真看好它，等它冷静下来再建仓也不迟。`),
      heldSummary,
    };
  }
  return {
    kind: 'none',
    advice:
      tx(lang, "I don't know your positions yet — add them in Positions, and next time I'll tell you straight whether to hold or sell, no empty talk.", '我还不知道你手里有啥——去持仓页把持仓加上吧，有的话快去添加，好让我下次直接告诉你这只该卖该留，而不是说空话。'),
  };
}

export default function RhythmDashboard({
  onGoPortfolio,
  onGoCalendar,
}: {
  onGoPortfolio?: () => void;
  /** 点图表事件圆点 → 弹窗里"去资讯页财经日历查看" → 跳到资讯页日历 */
  onGoCalendar?: (date: string) => void;
}) {
  const {
    items: watchlist,
    nameOf,
    focusSymbol,
    setFocusSymbol,
  } = useWatchlist();

  // 一句话播报（今日页底部）：自选股每天一句，看完顺手＋关注（记入持仓页「历史关注」）
  // focus 状态走共享 hook，同页签实时同步
  const { focus, addFocus } = useFocusList();
  const [heldSymbols] = useState<string[]>(() => {
    try {
      return loadPositions().map((p) => p.symbol);
    } catch {
      return [];
    }
  });

  const [symbol, setSymbolState] = useState(() => {
    // 切 tab 会卸载整个面板，state 会丢：上次看的标的落盘，回来接着看
    try {
      const saved = localStorage.getItem('gsl.chartSymbol');
      if (saved && /^[A-Za-z0-9.]{1,12}$/.test(saved)) return saved.toUpperCase();
    } catch {}
    return 'AAPL';
  });
  /** 选标的：顺手落盘，下次切回首页接着看这只 */
  const setSymbol = (s: string) => {
    setSymbolState(s);
    try { localStorage.setItem('gsl.chartSymbol', s); } catch {}
  };
  const [range, setRange] = useState(ANCHOR_RANGE_ID);
  // 涨跌配色：默认绿涨红跌（美股习惯），页面上可一键切换，全站统一
  const { scheme, toggle: toggleScheme } = useColorScheme();
  const { lang } = useLanguage();
  const en = lang === 'en';
  /** 展示名：英文模式用英文名，中文模式用自选里存的名字 */
  const displayName = (sym: string) => displayStockName(sym, lang, nameOf(sym));
  const anchorLabel = anchorRangeDef ? rangeLabel(anchorRangeDef, lang) : '3M';
  // 高波/稳健说明的展开状态
  const [showTierInfo, setShowTierInfo] = useState(false);
  // 图上事件圆点详情弹窗：点圆点 → 显示事件内容 + 去资讯页财经日历的链接
  const [eventSheet, setEventSheet] = useState<ChartEventMarker | null>(null);
  // 图表类型：3M 及以内默认 K线，长区间默认收盘线；用户手动切换后记住选择（切区间时重置）
  const [chartTypeOverride, setChartTypeOverride] = useState<ChartType | null>(null);
  const [showRangeHL, setShowRangeHL] = useState(true);
  /** 关键价位线（年高/年低/MA50，大位置）：默认开，可关 */
  const [showKeyLevels, setShowKeyLevels] = useState(false);
  /** 财报后反应实测：当前标的的下次财报日 + 过去财报日（K线图事件标记用） */
  const [earnReact, setEarnReact] = useState<SymbolReactions | null>(null);
  /** 买入前体检弹窗 */
  const [showCheckup, setShowCheckup] = useState(false);
  /** 黄金分割参考线：开关 + 组合方案 + 波段窗口（调参用），默认打开 */
  const [showFib, setShowFib] = useState(true);
  /** 开关键价位：打开时自动关掉黄金分割（避免线上线太多）；关闭不影响对方 */
  const toggleKeyLevels = () => {
    if (!showKeyLevels) setShowFib(false);
    setShowKeyLevels(!showKeyLevels);
  };
  /** 开关黄金分割：打开时自动关掉关键价位；关闭不影响对方 */
  const toggleFib = () => {
    if (!showFib) setShowKeyLevels(false);
    setShowFib(!showFib);
  };
  /** 黄金分割组合：默认完整五线（别处常见），点开面板直接选组合 */
  const [fibCombo, setFibCombo] = useState<FibComboId>('full');
  const [data, setData] = useState<RhythmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [showZenModal, setShowZenModal] = useState(false);
  // 沉思乐弹窗打开时：按当前标的查持仓，组织"看持仓说话"的内容
  const zenHoldings = useMemo(
    () => (showZenModal ? buildZenHoldings(symbol, data?.price ?? null, lang) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showZenModal, symbol, data],
  );
  // 「记一笔」操作记录弹窗
  const [showOpModal, setShowOpModal] = useState(false);
  const [opAction, setOpAction] = useState<OpAction>('sell');
  const [opPrice, setOpPrice] = useState('');
  const [opQty, setOpQty] = useState('');
  const [opSaved, setOpSaved] = useState(false);
  const [opSyncMsg, setOpSyncMsg] = useState<string | null>(null);
  // 区间横滑条的滚动位置：切区间/切股票重渲染时保持，不回到最左
  const rangeBarRef = useRef<HTMLDivElement | null>(null);
  const rangeScrollPos = useRef(0);
  /** 价格走势卡锚点：信号牌点一只股票后滚到这里 */
  const priceChartRef = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = rangeBarRef.current;
    if (el && el.scrollLeft !== rangeScrollPos.current) {
      el.scrollLeft = rangeScrollPos.current;
    }
  });
  /** 自选列表弹窗：点标题进入，里面是全部感兴趣的股票 */
  const [watchlistOpen, setWatchlistOpen] = useState(false);

  // 从持仓页跳过来的标的
  useEffect(() => {
    if (focusSymbol) {
      setSymbol(focusSymbol);
      setFocusSymbol(null);
    }
  }, [focusSymbol, setFocusSymbol]);

  // 自选变化后，当前标的若"被删掉"才回到第一只。
  // 从持仓/信号牌点进来的标的可能根本不在自选里（focusSymbol）——那不算被删，不能回弹。
  // 组件重新挂载（从别的 tab 切回首页）时也一样：上次看的标的若不在自选里，
  // 回落到自选第一只，不再硬顶着 AAPL（AAPL 也可能根本不在自选里）。
  const prevWatchlistRef = useRef<string[] | null>(null);
  useEffect(() => {
    const cur = watchlist.map((i) => i.symbol);
    const prev = prevWatchlistRef.current;
    if (cur.length > 0 && !focusSymbol) {
      // 挂载时 prev 为 null：把"上次看的"当成"曾经在"，不在名单就回落
      const wasIn = prev === null ? true : prev.includes(symbol);
      const nowIn = cur.includes(symbol);
      if (wasIn && !nowIn) {
        setSymbol(cur[0]);
      }
    }
    prevWatchlistRef.current = cur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist, focusSymbol]);

  // 收盘后自动刷新：页面开着过夜，第二天自动拉取最新收盘价
  const autoTick = useMarketAutoRefresh(
    data && data.series.length > 0 ? data.series[data.series.length - 1].date : undefined,
  );
  const prevTick = useRef(autoTick);

  // 经全 app 共享缓存拉数据：今日 / 持仓同源，同一 symbol+range 只发一次请求
  useEffect(() => {
    let cancelled = false;
    if (autoTick !== prevTick.current) {
      invalidateRhythm(symbol);
      prevTick.current = autoTick;
    }
    setLoading(true);
    setLoadError(false);
    getRhythm(symbol, range, { lang })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        console.error('获取律动数据失败:', err);
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range, autoTick, retryKey, lang]);

  // 盘中 / 盘前 / 盘后每 60 秒静默刷新一次价格（页面切到后台时不拉；收盘后自动停）
  useEffect(() => {
    if (
      data?.priceSession !== 'live' &&
      data?.priceSession !== 'after-hours' &&
      data?.priceSession !== 'pre-market'
    )
      return;
    const id = setInterval(() => {
      if (document.hidden) return;
      getRhythm(symbol, range, { force: true, lang })
        .then((json) => setData(json))
        .catch((err) => console.error('盘中刷新失败:', err));
    }, 60000);
    return () => clearInterval(id);
  }, [data?.priceSession, symbol, range, lang]);

  // 事件标记：当前标的的财报日（过去 4 次 + 下一次）+ 宏观事件，画在 K 线图上。
  // 拿不到就空着，不影响主流程。
  useEffect(() => {
    let alive = true;
    setEarnReact(null);
    fetch(`/api/earnings?mode=reactions&symbols=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setEarnReact(j.reactions?.[symbol.toUpperCase()] ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [symbol]);

  /** K 线图事件标记：落在当前区间内的财报日（紫点）与宏观事件（黄点），点圆点看事件详情 */
  const eventMarkers = useMemo(() => {
    const s = data?.series;
    if (!s || s.length === 0) return null;
    const inRange = new Set(s.map((p) => p.date));
    const out: ChartEventMarker[] = [];
    if (earnReact) {
      for (const p of earnReact.past) {
        if (inRange.has(p.date))
          out.push({
            time: p.date,
            kind: 'earnings',
            title: `${symbol.toUpperCase()} 财报`,
            titleEn: `${symbol.toUpperCase()} Earnings`,
          });
      }
      if (earnReact.upcoming && inRange.has(earnReact.upcoming)) {
        out.push({
          time: earnReact.upcoming,
          kind: 'earnings',
          title: `${symbol.toUpperCase()} 财报·预`,
          titleEn: `${symbol.toUpperCase()} Earnings (est.)`,
        });
      }
    }
    for (const e of getStaticEvents()) {
      if ((e.kind === 'fomc' || e.kind === 'cpi' || e.kind === 'nonfarm') && inRange.has(e.date)) {
        out.push({
          time: e.date,
          kind: 'macro',
          macroKind: e.kind,
          title: calEventTitle(e, 'zh'),
          titleEn: calEventTitle(e, 'en'),
        });
      }
    }
    return out.length > 0 ? out : null;
  }, [data, earnReact, symbol]);

  // 若当前区间对该标的不可用（如上市不足），切回主判断区间
  useEffect(() => {
    if (data && data.availableRanges.length > 0 && !data.availableRanges.includes(range)) {
      setRange(ANCHOR_RANGE_ID);
    }
  }, [data, range]);

  const judgment = data?.judgment ?? null;
  const overHeat = !!judgment?.overheated;
  /** 图上"最后一根日线收盘"线的标注：盘中叫昨收，收盘后叫收盘价 */
  const prevCloseLabel = useMemo(() => {
    if (!data || data.series.length === 0) return null;
    const last = data.series[data.series.length - 1];
    return {
      price: data.prevClose ?? last.close,
      text: data.priceLive ? (tx(lang, 'Prev close', '昨收')) : tx(lang, 'Close', '收盘价'),
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.prevClose, data?.priceLive, data?.series.length, lang]);
  /** 当前标的的持仓（有就按盈亏说话，没有就问一句）：tab 切换会重挂载，数据天然新鲜 */
  const myPosition = useMemo(() => {
    if (typeof window === 'undefined') return null;
    return (
      loadPositions().find((p) => p.symbol.toUpperCase() === symbol.toUpperCase()) ?? null
    );
  }, [symbol]);
  const myPnlPct =
    myPosition && myPosition.avgCost > 0 && data
      ? ((data.price - myPosition.avgCost) / myPosition.avgCost) * 100
      : null;
  /** 持仓感知的建议：套牢时不说"止盈"、不劝割肉（口径跟沉思乐"看持仓说话"一致） */
  const displayAdvice = judgment
    ? adviceWithPosition(judgment.statusKey, judgment.advice, myPnlPct, lang)
    : '';
  // 韩股（.KS）：韩元计价，大数字加千分位、无小数；美股：美元保留两位
  const fmtPrice = (p: number) => fmtMoney(symbol, p);
  /** 报价时间短式："Sep 24, 2026 3:42 PM ET" -> "3:42PM"，让新鲜度看得见 */
  const quoteTimeShort = data?.priceTime
    ? (data.priceTime.match(/(\d{1,2}:\d{2})\s?([AP]M)/)?.[1] ?? null)
    : null;
  const strongHigh =
    !!judgment && judgment.score >= judgment.thresholds.hot && !judgment.overheated;
  const rangeName = RANGE_MAP[range] ? rangeLabel(RANGE_MAP[range], lang) : range;
  // 短区间（≤3M）默认 K线：每天一根蜡烛，开/高/低/收一目了然
  const isShortRange = (RANGE_MAP[range]?.points ?? 66) <= 66;
  /** 黄金分割只在 1 个月以上的走势图上露面：短区间波段找不全，画出来是噪音 */
  const fibRangeOk = (RANGE_MAP[range]?.points ?? 0) > 22;
  const chartType: ChartType = chartTypeOverride ?? (isShortRange ? 'candle' : 'line');

  /** 黄金分割：图上画线用的波段与价位（开关打开时才算） */
  const fibPts = useMemo(
    () =>
      (data?.series ?? []).map((p) => ({
        date: p.date,
        high: p.high ?? p.close,
        low: p.low ?? p.close,
        close: p.close,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.series]
  );
  const fibSwing = useMemo(
    () => (showFib ? findSwing(fibPts, RECOMMENDED_FIB_LOOKBACK) : null),
    [showFib, fibPts]
  );
  const fibChartLevels = useMemo(
    () =>
      fibSwing
        ? fibLevels(fibSwing, dirComboId(fibCombo, fibSwing.uptrend), data?.price ?? undefined)
        : null,
    [fibSwing, fibCombo, data?.price]
  );
  /**
   * 缩放基准：固定用"完整五线 + 扩展目标"的并集喂给图表缩放，
   * 与当前选中的组合无关——切换组合只换画的线，不换比例尺，图不动。
   */
  const fibScaleLevels = useMemo(
    () =>
      fibSwing
        ? [...fibLevels(fibSwing, 'full'), ...fibLevels(fibSwing, 'extension')]
        : null,
    [fibSwing]
  );
  /** 诊断卡联动：现价贴近推荐视图（上方 1.272/1.618 拦追高，
   * 下方 0.618/0.786 拦割肉）时给一句行为纠偏（常开）。 */
  const fibHint = useMemo(() => {
    if (!fibPts.length || !data?.price) return null;
    const sw = findSwing(fibPts, RECOMMENDED_FIB_LOOKBACK);
    if (!sw) return null;
    return fibAdviceHint(sw, RECOMMENDED_FIB_COMBO, data.price, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fibPts, data?.price, lang]);

  // 精选名单代码集合：全市场搜索时排除（精选优先，带中文名）

  /* ---------- 关键价位 + 体检用的自选股 1Y 数据 ---------- */
  /** 自选股全量 1Y 数据：关键价位线 + 底部一句话播报共用，每只只拉一次 */
  const wlSymbols = useMemo(() => watchlist.map((i) => i.symbol), [watchlist]);
  const wlData = useWatchlistData(wlSymbols);
  /** 当前标的的关键价位线（年高/年低/MA50/20日高低点） */
  const keyLevels = useMemo(() => {
    const yd = wlData[symbol];
    if (!yd) return null;
    return computeKeyLevels(yd, lang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wlData, symbol, lang]);
  /** 体检第 3 项用的三档高点：近3月（66个交易日）/ 近1年；历史档由体检弹窗自己拉 ALL 数据补 */
  const highs = useMemo(() => {
    const yd = wlData[symbol];
    if (!yd) return { m3: null as number | null, y1: null as number | null };
    const s = yd.series;
    return {
      m3: actualHighLow(s.slice(-66))?.high ?? null,
      y1: actualHighLow(s)?.high ?? null,
    };
  }, [wlData, symbol]);
  /** 信号确信度：极端值才有行动价值，中部诚实标注 */
  const conviction: Conviction | null = useMemo(
    () => (judgment ? convictionOf(judgment.score, judgment.thresholds) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [judgment?.score, judgment?.thresholds.hot, judgment?.thresholds.cold],
  );
  /** 信号可信度：这个判断在该标的上过去准不准（判断复盘 API 的分状态统计） */
  const [signalStats, setSignalStats] = useState<{
    total: number;
    accuracy: number | null;
  } | null>(null);
  useEffect(() => {
    let alive = true;
    setSignalStats(null);
    fetch(`/api/accuracy?symbol=${encodeURIComponent(symbol)}&lang=${lang}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive || !j?.available || !j?.statuses || !judgment?.statusKey) return;
        const s = j.statuses[judgment.statusKey];
        if (s && s.total > 0) setSignalStats({ total: s.total, accuracy: s.accuracy });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, lang, judgment?.statusKey]);
  /** 你的计划：看完整买卖流水，不只看买入——卖完了就别再问"拿得住吗" */
  const lastOp = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try {
      const ops = loadOperations().filter(
        (o) => o.symbol.toUpperCase() === symbol.toUpperCase(),
      );
      return ops.length > 0 ? ops[0] : null;
    } catch {
      return null;
    }
  }, [symbol]);
  /** 持仓时的最近一次买入（只有还拿着，买入理由才值得追问） */
  const lastBuy = useMemo(
    () => (myPosition && lastOp?.action === 'buy' ? lastOp : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myPosition?.symbol, lastOp?.id],
  );
  /** 参谋价位：离现价最近的上方压力 / 下方支撑（关键价位 + 黄金分割合并） */
  const counselLevels = useMemo(() => {
    if (!data?.price) return null;
    const price = data.price;
    const cands: Array<{ label: string; price: number }> = [];
    if (keyLevels) {
      for (const k of keyLevels) cands.push({ label: k.label, price: k.price });
    }
    if (fibChartLevels) {
      for (const lv of fibChartLevels) {
        if (lv.kind === 'resistance' || lv.kind === 'target-up')
          cands.push({ label: `Fib ${lv.ratio}`, price: lv.price });
        else if (lv.kind === 'support' || lv.kind === 'target-down')
          cands.push({ label: `Fib ${lv.ratio}`, price: lv.price });
      }
    }
    if (data.prevClose) cands.push({ label: tx(lang, 'Prev close', '昨收'), price: data.prevClose });
    const above = cands
      .filter((c) => c.price > price * 1.001)
      .sort((a, b) => a.price - b.price)[0];
    const below = cands
      .filter((c) => c.price < price * 0.999)
      .sort((a, b) => b.price - a.price)[0];
    return { above: above ?? null, below: below ?? null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyLevels, fibChartLevels, data?.price, data?.prevClose, lang]);


  return (
    <div className="w-full space-y-4">
      {/* 标题 + 自选管理 + 标的选择 */}
      <div className="space-y-3">
        {/* 顶部搜索条：输代码/名称/拼音，匹配上自动切下面走势，右边 ＋ 加入自选 */}
        <WatchlistSearch
          symbol={symbol}
          onSelect={(s, opts) => {
            setSymbol(s);
            if (opts?.scroll) {
              requestAnimationFrame(() => {
                priceChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              });
            }
          }}
        />
        <div className="flex items-center justify-between">
          <button
            onClick={() => setWatchlistOpen(true)}
            className="flex items-center gap-0.5 text-xl sm:text-2xl font-bold text-slate-100 whitespace-nowrap active:scale-95 transition"
            title={tx(lang, 'Open full watchlist', '打开全部自选')}
          >
            {tx(lang, 'Watchlist', '自选列表')}
            <ChevronRight className="w-5 h-5 text-slate-500" />
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                invalidateRhythm(symbol);
                setRetryKey((k) => k + 1);
              }}
              className="text-xs text-slate-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800"
              aria-label={tx(lang, "Refresh quote", "刷新当前股票行情")}
              title={tx(lang, "Refresh quote", "刷新当前股票行情")}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              {tx(lang, 'Refresh', '刷新')}
            </button>
          </div>
        </div>

        {/* 自选 chips：紧凑小 pill，自动换行，一行 4~6 个 */}
        <div className="flex flex-wrap gap-1.5">
          {watchlist.map((item) => (
            <button
              key={item.symbol}
              onClick={() => setSymbol(item.symbol)}
              className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition-all ${
                symbol === item.symbol
                  ? 'bg-blue-600 text-white font-medium shadow'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {item.symbol}
            </button>
          ))}
        </div>
      </div>

      {/* 价格走势区（loading 骨架与图表共用锚点，保证点选股票时总能滚到） */}
      <div ref={priceChartRef} className="scroll-mt-20">
      {loading ? (
        <div className="space-y-4">
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-[3px] border-slate-700 border-t-blue-500 animate-spin" />
            <p className="text-xs text-slate-400">{tx(lang, `Loading ${symbol}…`, `正在读取 ${symbol} 行情…`)}</p>
          </div>
          <div className="h-72 animate-pulse bg-slate-900 border border-slate-800 rounded-xl" />
        </div>
      ) : data && judgment ? (
        <>
          {/* ② 价格走势图：区间只控制展示，是多空对照，不下结论 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-200">
                {tx(lang, 'Price trend', '价格走势')} <span className="text-[10px] font-normal text-slate-500 ml-1">{symbol}</span>
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    data.changePct >= 0 ? upText(scheme) : downText(scheme)
                  }`}
                >
                  {data.changePct >= 0 ? '+' : ''}
                  {data.changePct}% / {tx(lang, `past ${rangeName}`, `近${rangeName}`)}
                </span>
                <button
                  onClick={toggleScheme}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                  aria-label={tx(lang, "Toggle up/down colors", "切换涨跌配色")}
                >
                  {schemeLabel(scheme, lang)} ⇄
                </button>
              </div>
            </div>
            <div
              ref={rangeBarRef}
              onScroll={(e) => {
                rangeScrollPos.current = e.currentTarget.scrollLeft;
              }}
              className="flex gap-1.5 overflow-x-auto pb-1 mb-3 -mx-1 px-1"
            >
              {RANGE_DEFS.filter((d) => data.availableRanges.includes(d.id)).map((d) => (
                <button
                  key={d.id}
                  onClick={() => {
                    setRange(d.id);
                    setChartTypeOverride(null);
                  }}
                  className={`shrink-0 px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    range === d.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {rangeLabel(d, lang)}
                </button>
              ))}
            </div>

            {/* 图表类型切换 + 区间高低点标注（窄屏自动换行，按钮文字不折行） */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="flex bg-slate-800 rounded-lg p-0.5 text-[11px] shrink-0">
                {(['candle', 'line', 'ohlc'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTypeOverride(t)}
                    className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                      chartType === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'candle' ? (tx(lang, 'Candles', 'K线')) : t === 'line' ? (tx(lang, 'Close line', '收盘线')) : tx(lang, 'OHLC', '四线')}
                  </button>
                ))}
              </div>
              {chartType !== 'ohlc' && (
                <div className="flex gap-1.5 shrink-0 ml-auto">
                  {fibRangeOk && (
                    <Tip text={tx(lang, "Draw Fibonacci reference lines (gold dashed) — marks levels everyone watches, not a prediction", "在图上画黄金分割参考线（金色虚线），只标大家都在看的位置，不算命")}>
                      <button
                        onClick={toggleFib}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors whitespace-nowrap ${
                          showFib
                            ? 'border-yellow-600/50 text-yellow-400 bg-yellow-500/10'
                            : 'border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {tx(lang, 'Fibonacci', '黄金分割')}
                      </button>
                    </Tip>
                  )}
                  <Tip text={tx(lang, "Show/hide dashed range high/low lines", "显示 / 隐藏当前区间最高价和最低价的虚线")}>
                    <button
                      onClick={() => setShowRangeHL((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors whitespace-nowrap ${
                        showRangeHL
                          ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tx(lang, 'Range high/low', '区间高低点')}
                    </button>
                  </Tip>
                  <Tip text={tx(lang, "1Y high/low, MA50, Fibonacci retracements: thin dashed lines, marks levels everyone watches. Auto-hides Fibonacci to avoid clutter", "年内最高/最低、50日均线、黄金分割回撤：细虚线，只标大家都在看的位置。打开会自动关掉黄金分割，避免堆叠")}>
                    <button
                      onClick={toggleKeyLevels}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors whitespace-nowrap ${
                        showKeyLevels
                          ? 'border-violet-500/50 text-violet-300 bg-violet-500/10'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {tx(lang, 'Key levels', '关键价位')}
                    </button>
                  </Tip>
                </div>
              )}
            </div>

            {/* 黄金分割组合：一排按钮紧跟在开关下方 */}
            {showFib && fibRangeOk && chartType !== 'ohlc' && (
              <div className="flex gap-1 mb-2">
                {FIB_COMBO_IDS.filter((id) => id !== 'smart').map((id) => (
                  <Tip key={id} text={fibComboDesc(id, fibSwing?.uptrend ?? true, lang)}>
                    <button
                      onClick={() => setFibCombo(id)}
                      className={`px-2 py-1 rounded-lg text-[11px] border transition-colors whitespace-nowrap ${
                        fibCombo === id
                          ? 'border-yellow-600/50 text-yellow-300 bg-yellow-500/10'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {fibComboName(id, lang)}
                      {id === RECOMMENDED_FIB_COMBO && (
                        <span className="ml-1 text-[9px] px-1 rounded bg-yellow-500/20 text-yellow-400">
                          {tx(lang, 'Recommended', '推荐')}
                        </span>
                      )}
                    </button>
                  </Tip>
                ))}
              </div>
            )}

            <RhythmChart
              series={data.series}
              height={240}
              chartType={chartType}
              showRangeHL={showRangeHL}
              scheme={scheme}
              fibLevels={fibChartLevels}
              fibScaleLevels={fibScaleLevels}
              prevCloseLabel={prevCloseLabel}
              keyLevels={keyLevels}
              showKeyLevels={showKeyLevels}
              eventMarkers={eventMarkers}
              onEventMarkerClick={setEventSheet}
              lang={lang}
            />
            {/* 黄金分割说明：组合的具体文字放图下方 */}
            {showFib && fibRangeOk && (
              <div className="mt-3 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                    <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                      {fibComboName(fibCombo, lang)}：{fibComboDesc(fibCombo, fibSwing?.uptrend ?? true, lang)}
                    </p>
                {fibSwing && fibChartLevels ? (
                  <>
                    <div className="text-[10px] text-slate-500 mb-1.5">
                      {tx(lang, 'Swing: ', '波段：')}
                      {fibSwing.uptrend
                        ? tx(lang, `${fibSwing.lowDate} low $${fibSwing.low} → ${fibSwing.highDate} high $${fibSwing.high} (up swing)`, `${fibSwing.lowDate} 低 $${fibSwing.low} → ${fibSwing.highDate} 高 $${fibSwing.high}（上涨波段）`): tx(lang, `${fibSwing.highDate} high $${fibSwing.high} → ${fibSwing.lowDate} low $${fibSwing.low} (down swing)`, `${fibSwing.highDate} 高 $${fibSwing.high} → ${fibSwing.lowDate} 低 $${fibSwing.low}（下跌波段）`)}
                    </div>
                    {/* 说人话：现价在哪 + 按持仓给行动句，每句带数字，不说空话 */}
                    {(() => {
                      const advice = fibPlainAdvice({
                        price: data.price,
                        levels: fibChartLevels,
                        swing: fibSwing,
                        pnlPct: myPnlPct,
                        fmt: fmtPrice,
                        lang,
                      });
                      if (!advice) return null;
                      return (
                        <div className="mb-2 rounded-xl bg-amber-500/10 border border-amber-600/30 px-2.5 py-2">
                          {advice.map((s, i) => (
                            <p
                              key={i}
                              className="text-[11px] text-amber-100/90 leading-relaxed mb-1 last:mb-0"
                            >
                              {s}
                            </p>
                          ))}
                          {myPnlPct == null && onGoPortfolio && (
                            <button
                              onClick={onGoPortfolio}
                              className="mt-1 text-left text-[10px] text-amber-300/70 hover:text-amber-200 leading-relaxed"
                            >
                              {tx(lang, '💡 Holding this? Log your cost in Positions — next time advice speaks to your P/L →', '💡 持有这只？去持仓记一笔成本，下次按你的盈亏来说 →')}
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    <div className="space-y-1">
                      {(() => {
                        const near = data.price
                          ? nearestFibLevel(fibChartLevels, data.price)
                          : null;
                        return fibChartLevels.map((lv) => {
                          const dist = data.price
                            ? ((data.price - lv.price) / lv.price) * 100
                            : null;
                          const isNear = near?.level === lv;
                          // 左边分位：方向色小 pill（上方=涨色，下方=跌色，随全站配色走）；
                          // 右边股价：亮白加粗，和左边一眼区分开。
                          const isUp = lv.kind === 'resistance' || lv.kind === 'target-up';
                          const pillCls = isUp
                            ? scheme === 'cn'
                              ? 'bg-red-500/15 text-red-300'
                              : 'bg-green-500/15 text-green-300'
                            : scheme === 'cn'
                              ? 'bg-green-500/15 text-green-300'
                              : 'bg-red-500/15 text-red-300';
                          return (
                            <div
                              key={lv.ratio}
                              className={`flex items-center justify-between text-[11px] px-2 py-1 rounded ${
                                isNear ? 'bg-yellow-500/10' : ''
                              }`}
                            >
                              <span className={`font-mono px-1.5 py-0.5 rounded ${pillCls}`}>
                                {isNear ? '📍 ' : ''}
                                {fibRatioLabel(lv)} · {fibKindLabel(lv.kind, lang)}
                              </span>
                              <span className="text-slate-100 font-mono font-semibold">${lv.price}</span>
                              <span className="text-slate-500 font-mono text-[10px]">
                                {dist == null
                                  ? ''
                                  : tx(lang, `${dist >= 0 ? 'above price' : 'below price'} ${Math.abs(dist).toFixed(1)}%`, `${dist >= 0 ? '现价在其上方' : '现价在其下方'} ${Math.abs(dist).toFixed(1)}%`)}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    {tx(lang, 'Not enough points in this range for a reliable swing (try a longer range)', '该区间点数不足，画不出可靠波段（换个长一点的展示区间试试）')}
                  </div>
                )}
                <p className="text-[10px] text-slate-600 mt-1.5">
                  {tx(lang, 'Reference lines, not fortune-telling: marks levels everyone watches — not a prediction', '参考线，不是算命：只标大家都在看的位置，不构成预测')}
                </p>
              </div>
            )}
            {chartType === 'ohlc' && (
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1.5 px-0.5">
                {tx(lang, 'How to read: the wider the "band" between the two lines, the bigger the daily swings. Close hugging the top = strong, the bottom = weak. When the band squeezes, a direction usually follows.', '怎么看：两条线之间的"带子"越宽，当天波动越大；收盘线贴着最高线走是强势，贴着最低线走是弱势；带子越收越窄之后，往往要选方向了。')}
              </p>
            )}

            {/* 分位位置条：现价在所选区间分位中的位置 */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>
                  {tx(lang, 'Band low', '分位低点')} <strong className="text-emerald-400">${data.low}</strong>
                </span>
                <span>
                  {tx(lang, 'Band high', '分位高点')} <strong className="text-rose-400">${data.high}</strong>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-rose-500">
                {data.slicePos != null && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-900 shadow"
                    style={{ left: `calc(${data.slicePos}% - 8px)` }}
                  />
                )}
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-slate-600">
                <span>{tx(lang, `Band position · past ${rangeName}${data.slicePos == null ? ' (not enough points)' : ''}`, `近${rangeName}分位位置${data.slicePos == null ? '（点数不足）' : ''}`)}</span>
                <span>
                  {tx(lang, `${data.series.length} points · updated`, `数据点: ${data.series.length} 天 · 数据更新于`)}
                  {'\u00A0'}
                  {new Date(data.updatedAt).toLocaleTimeString(tx(lang, 'en-US', 'zh-CN'), {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* ① 谷峰律动：主判断永远锚定近 3 月，不随展示区间变化 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold mb-3 text-slate-200 flex items-center">
              {tx(lang, 'Trough-Peak Rhythm', '谷峰律动')}
              <span className="ml-2 text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {tx(lang, `Main call · past ${anchorLabel}`, `主判断 · 近${anchorLabel}`)}
              </span>
              {judgment && (
                <span
                  className={`ml-1.5 text-[10px] font-normal px-2 py-0.5 rounded-full border ${
                    judgment.thresholds.tier === 'high'
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/30'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {judgment.thresholds.tierLabel} · {judgment.thresholds.hot}/
                  {judgment.thresholds.cold}
                </span>
              )}
              {judgment && (
                <button
                  onClick={() => setShowTierInfo((v) => !v)}
                  className="ml-1 w-4 h-4 shrink-0 rounded-full border border-slate-600 text-slate-500 text-[9px] leading-none flex items-center justify-center hover:text-slate-300 hover:border-slate-400"
                  aria-label={tx(lang, "Volatility tier info", "波动档位说明")}
                >
                  i
                </button>
              )}
            </h2>
            {showTierInfo && judgment && (
              <div className="mb-3 text-[11px] text-slate-400 leading-relaxed bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2">
                {judgment.thresholds.tier === 'high'
                  ? tx(lang, 'High-vol mode: this stock has been swinging hard (avg daily move > 3%), so the overheated/oversold bars are set tighter (85/15) to avoid signal spam.', '高波模式：这只股票最近波动大（日均涨跌超 3%），"涨太猛了 / 跌过头了"的门槛收得更紧（85/15 分），免得信号泛滥。'): tx(lang, 'Steady mode: recent swings are mild, so the overheated/oversold bars use the standard 80/20.', '稳健模式：这只股票最近波动温和，"涨太猛了 / 跌过头了"用常规门槛（80/20 分）。')}
              </div>
            )}
            <div
              className={`p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 ${
                overHeat ? 'cursor-pointer hover:border-amber-500/40' : ''
              }`}
              onClick={() => {
                if (overHeat) setShowZenModal(true);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100 text-lg">{symbol}</span>
                  <span className="text-xs text-slate-400">{displayName(symbol)}</span>
                  {overHeat && (
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap shrink-0">
                      <Flame className="w-3 h-3" /> {tx(lang, 'Too hot', '涨太猛')}
                    </span>
                  )}
                  {strongHigh && (
                    <span className="bg-sky-500/15 text-sky-400 border border-sky-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 whitespace-nowrap shrink-0">
                      <TrendingUp className="w-3 h-3" /> {tx(lang, 'Steady', '稳着涨')}
                    </span>
                  )}
                  {data.source === 'simulated' && (
                    <span className="text-[10px] text-slate-500">{tx(lang, 'Demo data', '演示数据')}</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-500 mb-0.5">
                    {tx(lang, 'Rhythm Score', '律动值')}
                  </div>
                  <div
                    className={`text-4xl font-extrabold ${
                      overHeat ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {judgment.score}
                  </div>
                  <div className="text-[10px] text-slate-400">{judgment.status}</div>
                  {conviction === 'weak' && (
                    <div className="mt-0.5 inline-block text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      {tx(lang, 'Weak signal', '弱信号')}
                    </div>
                  )}
                  {conviction === 'none' && (
                    <div className="mt-0.5 inline-block text-[9px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/50">
                      {tx(lang, 'No clear signal', '无明确信号')}
                    </div>
                  )}
                  <div className="mt-1 flex justify-end" title={tx(lang, 'Score trend, last 10 days', '近10天分数走势')}>
                    <ScoreSparkline
                      closes={(data.series ?? []).map((p) => p.close)}
                      hot={judgment.thresholds.hot}
                      cold={judgment.thresholds.cold}
                    />
                  </div>
                </div>
              </div>
              {judgment.statusDetail && (
                <div className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
                  {judgment.statusDetail}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200 shrink-0">
                  {fmtPrice(data.price)}
                </span>
                <span className="flex items-center gap-1 shrink-0 text-[9px]" title={data.priceTime ?? undefined}>
                    {data.priceSession === 'live' && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span className="text-emerald-400">
                          {tx(lang, 'Live', '实时')}{quoteTimeShort ? ` ${quoteTimeShort}` : ''}
                        </span>
                      </>
                    )}
                    {(data.priceSession === 'after-hours' ||
                    data.priceSession === 'after-hours-frozen') && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                        <span className="text-amber-300">
                          {tx(lang, 'After-hr', '盘后')}{quoteTimeShort ? ` ${quoteTimeShort}` : ''}
                        </span>
                      </>
                    )}
                    {data.priceSession === 'pre-market' && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />
                        <span className="text-sky-400">
                          {tx(lang, 'Pre-mkt', '盘前')}{quoteTimeShort ? ` ${quoteTimeShort}` : ''}
                        </span>
                      </>
                    )}
                    {data.priceSession === 'close' && (
                      <span className="text-slate-500">{tx(lang, 'Close', '收盘价')}</span>
                    )}
                    {data.dayChangePct != null && (
                      <span className={data.dayChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {data.dayChangePct >= 0 ? '+' : ''}
                        {data.dayChangePct}%
                      </span>
                    )}
                    {data.priceLive && data.prevClose != null && (
                      <span className="text-slate-500">{tx(lang, `Prev close ${fmtPrice(data.prevClose)}`, `昨收 ${fmtPrice(data.prevClose)}`)}</span>
                    )}
                  </span>
                <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${scoreGradient(
                      judgment.score,
                      judgment.thresholds.hot,
                      judgment.thresholds.cold,
                    )} transition-all duration-700`}
                    style={{ width: `${judgment.score}%` }}
                  />
                </div>
              </div>

              <div className="mt-2 text-[10px] text-slate-500">
                {tx(lang, `Position ${judgment.pos} · Trend ${judgment.trend} · Speed ${judgment.vel}`, `位置 ${judgment.pos} · 趋势 ${judgment.trend} · 速度 ${judgment.vel}`)}
              </div>
              {/* 参谋区：每句都跟你的钱/计划/可验证的价位有关，替代泛泛的多空话术 */}
              <div className="mt-3 rounded-xl bg-slate-800/40 border border-slate-700/50 p-3 space-y-2">
                {/* 1. 你的处境：持仓、成本、浮亏、回本线 */}
                {myPosition && data && myPnlPct != null && (
                  <div className="text-[11px] leading-relaxed">
                    <span className="text-slate-500">{tx(lang, '📍 Your position: ', '📍 你的处境：')}</span>
                    <span className="text-slate-200">
                      {tx(lang, `Holding ${myPosition.shares} shares @ ${fmtPrice(myPosition.avgCost)}, now ${fmtPrice(data.price)}`, `持有 ${myPosition.shares} 股 @ ${fmtPrice(myPosition.avgCost)}，现价 ${fmtPrice(data.price)}`)}
                      {' · '}
                      <span className={myPnlPct >= 0 ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>
                        {myPnlPct >= 0
                          ? tx(lang, `up ${myPnlPct.toFixed(1)}%`, `浮盈 ${myPnlPct.toFixed(1)}%`)
                          : tx(lang, `down ${Math.abs(myPnlPct).toFixed(1)}%`, `浮亏 ${Math.abs(myPnlPct).toFixed(1)}%`)}
                      </span>
                      {myPnlPct < 0 && data.price > 0 && (
                        <span className="text-slate-400">
                          {tx(lang, ` · breakeven needs +${(((myPosition.avgCost / data.price) - 1) * 100).toFixed(1)}%`, ` · 回本需 +${(((myPosition.avgCost / data.price) - 1) * 100).toFixed(1)}%`)}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {/* 2. 信号可信度：这个判断在该标的上过去准不准 */}
                {signalStats && (
                  <div className="text-[11px] leading-relaxed">
                    <span className="text-slate-500">{tx(lang, '📊 Signal track record: ', '📊 信号可信度：')}</span>
                    <span className="text-slate-300">
                      {tx(lang, `"${judgment.status}" on ${symbol}: ${signalStats.total} past occurrences`, `“${judgment.status}”在 ${symbol} 过去出现 ${signalStats.total} 次`)}
                      {signalStats.accuracy != null ? (
                        <>
                          {' · '}
                          <span className={signalStats.accuracy >= 60 ? 'text-emerald-400 font-medium' : signalStats.accuracy >= 50 ? 'text-amber-300' : 'text-rose-400'}>
                            {tx(lang, `${signalStats.accuracy.toFixed(0)}% played out`, `${signalStats.accuracy.toFixed(0)}% 之后应验`)}
                          </span>
                        </>
                      ) : (
                        tx(lang, ' · too few samples', ' · 样本太少')
                      )}
                    </span>
                  </div>
                )}
                {/* 3. 你的计划：还拿着才追问买入理由；卖完了就复盘卖得好不好 */}
                {lastBuy && (
                  <div className="text-[11px] leading-relaxed">
                    <span className="text-slate-500">{tx(lang, '📝 Your plan: ', '📝 你的计划：')}</span>
                    <span className="text-slate-300">
                      {tx(lang, `On ${lastBuy.date} you bought at ${fmtPrice(lastBuy.price)}`, `${lastBuy.date} 你以 ${fmtPrice(lastBuy.price)} 买入`)}
                      {lastBuy.thesis
                        ? tx(lang, ` — thesis was "${lastBuy.thesis}". Still true?`, `，理由是“${lastBuy.thesis}”——这个逻辑变了吗？`)
                        : tx(lang, ' — no thesis recorded. Still true?', '——当时没记理由，现在还拿得住吗？')}
                    </span>
                  </div>
                )}
                {!myPosition && lastOp?.action === 'sell' && data && (
                  <div className="text-[11px] leading-relaxed">
                    <span className="text-slate-500">{tx(lang, '📝 Sold: ', '📝 已卖出：')}</span>
                    <span className="text-slate-300">
                      {tx(lang, `On ${lastOp.date} you sold${lastOp.qty ? ` ${lastOp.qty} shares` : ''} at ${fmtPrice(lastOp.price)} — flat now`, `${lastOp.date} 你以 ${fmtPrice(lastOp.price)} 卖出${lastOp.qty ? `${lastOp.qty} 股` : ''}，目前空仓`)}
                      {data.price > 0 && lastOp.price > 0 && (
                        <>
                          {' · '}
                          {(() => {
                            const diff = ((data.price - lastOp.price) / lastOp.price) * 100;
                            return diff >= 0 ? (
                              <span className="text-amber-300">
                                {tx(lang, `now ${fmtPrice(data.price)}, +${diff.toFixed(1)}% since — sold a bit early`, `现价 ${fmtPrice(data.price)}，比卖出价高 ${diff.toFixed(1)}%——卖早了一点`)}
                              </span>
                            ) : (
                              <span className="text-emerald-400">
                                {tx(lang, `now ${fmtPrice(data.price)}, ${diff.toFixed(1)}% since — well timed`, `现价 ${fmtPrice(data.price)}，比卖出价低 ${Math.abs(diff).toFixed(1)}%——卖得不亏`)}
                              </span>
                            );
                          })()}
                        </>
                      )}
                    </span>
                  </div>
                )}
                {/* 4. 具体价位：可证伪的上方/下方 */}
                {(() => {
                  const isDown = ['bottomUp', 'weakLow', 'oversoldBottom'].includes(
                    judgment.statusKey ?? '',
                  );
                  return (
                    <>
                      {counselLevels?.above && (
                        <div className="text-[11px] leading-relaxed">
                          <span className="text-slate-500">{tx(lang, '⬆️ Above: ', '⬆️ 上方：')}</span>
                          <span className="text-slate-300">
                            {fmtPrice(counselLevels.above.price)}
                            <span className="text-slate-500">（{counselLevels.above.label}）</span>
                            {isDown
                              ? tx(lang, ' — reclaim it and the slide may ease', '——站上则跌势可能缓和')
                              : tx(lang, ' — approaching it, chasing gets riskier', '——接近则追高风险加大')}
                          </span>
                        </div>
                      )}
                      {counselLevels?.below && (
                        <div className="text-[11px] leading-relaxed">
                          <span className="text-slate-500">{tx(lang, '⬇️ Below: ', '⬇️ 下方：')}</span>
                          <span className="text-slate-300">
                            {fmtPrice(counselLevels.below.price)}
                            <span className="text-slate-500">（{counselLevels.below.label}）</span>
                            {tx(lang, ` — break it and the "${judgment.status}" call is invalid`, `——跌破则“${judgment.status}”判断失效`)}
                          </span>
                        </div>
                      )}
                    </>
                  );
                })()}
                {/* 5. 确信度：弱/无信号诚实标注，不包装成买卖依据 */}
                {conviction !== 'strong' && (
                  <div className="text-[11px] leading-relaxed text-amber-300/90">
                    {conviction === 'weak'
                      ? tx(lang, `⚠️ Weak signal (${judgment.score} pts) — don't treat it as a buy/sell call`, `⚠️ 当前是弱信号（${judgment.score} 分），别当成抄底/逃顶依据`)
                      : tx(lang, `⚠️ No clear signal (${judgment.score} pts) — sitting out is also a position`, `⚠️ 当前没有明确信号（${judgment.score} 分），中场休息也是一种操作`)}
                  </div>
                )}
              </div>

              <div className="mt-2 text-xs text-slate-400 leading-relaxed">{displayAdvice}</div>
              {!myPosition && onGoPortfolio && (
                <button
                  onClick={onGoPortfolio}
                  className="mt-1.5 text-left text-[10px] text-slate-500 hover:text-slate-300 leading-relaxed"
                >
                  {tx(lang, '💡 Holding this? Log your cost in Positions — next time advice speaks to your P/L →', '💡 持有这只？去持仓记一笔成本，下次建议按你的盈亏来说 →')}
                </button>
              )}
              {fibHint && (
                <div className="mt-2 text-[11px] text-amber-300/80 leading-relaxed">
                  {fibHint}
                </div>
              )}
              {overHeat && (
                <div className="mt-2 text-[10px] text-amber-400/70">{tx(lang, 'Tap the card for the cool-down checklist', '点击卡片查看冷静清单')}</div>
              )}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setShowCheckup(true)}
                  className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  {tx(lang, '🩺 Pre-buy checkup', '🩺 买入前体检')}
                </button>
                <button
                  onClick={() => {
                    setOpAction(judgment.statusKey === 'oversoldBottom' ? 'buy' : 'sell');
                    setOpPrice(data.price ? fmtPrice(data.price) : '');
                    setOpQty('');
                    setOpSaved(false);
                    setOpSyncMsg(null);
                    setShowOpModal(true);
                  }}
                  className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition-colors"
                >
                  {tx(lang, '✍️ Log a trade', '✍️ 记一笔操作')}
                </button>
              </div>
            </div>
          </div>

          {/* 🏢 公司介绍：大白话一句话 + 板块/主题标签（诊断卡下方） */}
          {(() => {
            const info = findStock(symbol);
            return info ? <CompanyIntro info={info} lang={lang} /> : null;
          })()}

          {/* 🔍 AI 深挖：基本面事实卡（折叠懒加载，只讲事实不给建议） */}
          <CompanyDeepDive symbol={symbol} lang={lang} />

          {/* 筹码分布 + 资金流向：并排小面板 */}
          <div className="grid grid-cols-2 gap-2">
            <ChipPanel symbol={symbol} compact lang={lang} />
            <FlowPanel symbol={symbol} lang={lang} />
          </div>

          {/* ③ 判断复盘：历史信号 vs 次日真实结果 */}
          <AccuracyPanel symbol={symbol} />
        </>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center gap-3 bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
          <p className="text-sm">{loadError ? (tx(lang, 'Quote failed (network timeout or no server response)', '行情加载失败（网络超时或服务器没响应）')) : tx(lang, 'Data failed to load — try again later', '数据加载失败，请稍后重试')}</p>
          {loadError && (
            <button
              onClick={() => setRetryKey((k) => k + 1)}
              className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-medium active:bg-blue-700"
            >
              {tx(lang, 'Reload', '重新加载')}
            </button>
          )}
        </div>
      )}
      </div>{/* 价格走势区锚点结束 */}

      {/* 今日信号：挪到首页最底部——进来先看自选和走势，信号在下面等着 */}
      <MarketSignalBoard
        onPick={(s) => {
          setSymbol(s);
          requestAnimationFrame(() => {
            priceChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          });
        }}
      />

      {/* 📣 一句话播报：自选股每天一句（从持仓页搬回来自选的地盘），看完顺手「＋关注」进本周冷静池 */}
      <StockBriefs
        symbols={wlSymbols}
        nameOf={nameOf}
        dataMap={wlData}
        loading={Object.keys(wlData).length === 0}
        onPick={(s) => {
          setSymbol(s);
          requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
        }}
        onAddFocus={addFocus}
        focusSymbols={focus.items.map((i) => i.symbol)}
        positionSymbols={heldSymbols}
        focusFull={focus.items.length >= FOCUS_MAX}
      />

      {/* 沉思乐：涨太猛了时点击诊断卡弹出的冷静拦截（看持仓说话） */}
      {watchlistOpen && (
        <WatchlistModal
          onClose={() => setWatchlistOpen(false)}
          onViewSymbol={(s) => {
            setSymbol(s);
            requestAnimationFrame(() => {
              priceChartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
          }}
        />
      )}
      {showZenModal && data && judgment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">{tx(lang, 'Too hot — take a breather?', '涨太猛了，先缓一缓？')}</h3>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-amber-400">{symbol}</span>{' '}
              {tx(lang, `It's been running hot (rhythm ${judgment.score}) — take a deep breath before deciding?`, `这几天涨得有点猛（律动 ${judgment.score} 分），要不要先深呼吸一下再决定？`)}
            </p>
            {zenHoldings && (
              <div className="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-300 text-left space-y-1.5 leading-relaxed">
                {zenHoldings.kind === 'holding' && zenHoldings.shares != null && (
                  <>
                    <p>
                      {tx(lang, 'You hold ', '你手里有')}{' '}
                      <span className="font-semibold text-slate-100">
                        {tx(lang, `${zenHoldings.shares} shares`, `${zenHoldings.shares} 股`)}
                      </span>
                      {zenHoldings.avgCost != null && (
                        <> · {tx(lang, 'cost', '成本')} {fmtMoney(symbol, zenHoldings.avgCost)}</>
                      )}
                      {zenHoldings.price != null && (
                        <> · {tx(lang, 'price', '现价')} {fmtMoney(symbol, zenHoldings.price)}</>
                      )}
                    </p>
                    {zenHoldings.pnl != null && zenHoldings.pnlPct != null && (
                      <p>
                        {tx(lang, 'Floating ', '浮动')}{zenHoldings.pnl >= 0 ? (tx(lang, 'profit', '盈利')) : tx(lang, 'loss', '亏损')}{' '}
                        <span
                          className={`font-semibold ${
                            zenHoldings.pnl >= 0 ? upText(scheme) : downText(scheme)
                          }`}
                        >
                          {zenHoldings.pnl >= 0 ? '+' : ''}
                          {fmtMoney(symbol, zenHoldings.pnl)}（
                          {zenHoldings.pnlPct >= 0 ? '+' : ''}
                          {zenHoldings.pnlPct.toFixed(1)}%）
                        </span>
                      </p>
                    )}
                    <p className="text-amber-300/90">{zenHoldings.advice}</p>
                  </>
                )}
                {zenHoldings.kind === 'other' && (
                  <>
                    <p className="text-amber-300/90">{zenHoldings.advice}</p>
                    {zenHoldings.heldSummary && (
                      <p className="text-slate-500">{tx(lang, `Currently holding: ${zenHoldings.heldSummary}`, `你现在持有：${zenHoldings.heldSummary}`)}</p>
                    )}
                  </>
                )}
                {zenHoldings.kind === 'none' && (
                  <p className="text-amber-300/90">{zenHoldings.advice}</p>
                )}
              </div>
            )}
            <div className="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-400 text-left space-y-1">
              <p className="font-medium text-slate-300">{tx(lang, 'Before acting, ask yourself:', '动手前，不妨问问自己：')}</p>
              <p>{tx(lang, '• Am I chasing just because I\u2019m afraid of missing out?', '• 是不是怕错过，才想追进去？')}</p>
              <p>{tx(lang, '• Do I still remember why I bought it?', '• 还记得当初为啥买它吗？')}</p>
              <p>{tx(lang, '• If it drops 5% tomorrow, will I still sleep tonight?', '• 如果明天跌 5%，今晚还睡得着吗？')}</p>
            </div>
            <div className="flex gap-2 pt-2">
              {zenHoldings?.kind === 'none' && onGoPortfolio && (
                <button
                  onClick={() => {
                    setShowZenModal(false);
                    onGoPortfolio();
                  }}
                  className="flex-1 bg-amber-600 hover:bg-amber-500 text-white py-2.5 rounded-xl text-xs font-medium"
                >
                  {tx(lang, 'Add in Positions', '去持仓页添加')}
                </button>
              )}
              <button
                onClick={() => setShowZenModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-xl text-xs font-medium"
              >
                {tx(lang, "I've decided — cool down first", '我想好了，先冷静一下')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 记一笔：把"看到建议→动手操作"记录下来，复盘自动算 */}
      {showOpModal && data && judgment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-100">
              {tx(lang, 'Log a trade', '记一笔')} · {symbol} {displayName(symbol) !== symbol ? ` ${displayName(symbol)}` : ''}
            </h3>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 rounded-lg px-3 py-2">
              {tx(lang, `Advice then: ${judgment.status} (${judgment.score} pts) · ${displayAdvice}`, `当时建议：${judgment.status}（${judgment.score}分）· ${displayAdvice}`)}
            </div>
            {opSaved ? (
              <div className="text-center py-4 text-sm text-emerald-400 font-medium space-y-1.5">
                <div>{tx(lang, '✓ Logged — see the review in Memory', '✓ 已记入操作记忆，去记忆页看复盘')}</div>
                {opSyncMsg && <div className="text-xs text-slate-400 font-normal">{opSyncMsg}</div>}
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  {(['buy', 'sell'] as OpAction[]).map((a) => (
                    <button
                      key={a}
                      onClick={() => setOpAction(a)}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                        opAction === a
                          ? a === 'buy'
                            ? 'bg-rose-600 text-white'
                            : 'bg-emerald-600 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {a === 'buy' ? (tx(lang, 'Buy', '买入')) : tx(lang, 'Sell', '卖出')}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 mb-1">{tx(lang, 'Price *', '价格 *')}</div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={opPrice}
                      onChange={(e) => setOpPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 mb-1">{tx(lang, 'Shares (optional)', '数量（可选)')}</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={opQty}
                      onChange={(e) => setOpQty(e.target.value)}
                      placeholder={tx(lang, "Shares", "股数")}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowOpModal(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-xl text-xs font-medium"
                  >
                    {tx(lang, 'Cancel', '取消')}
                  </button>
                  <button
                    onClick={() => {
                      const price = parseFloat(opPrice.replace(/,/g, ''));
                      if (!(price > 0)) {
                        alert(tx(lang, 'Enter the trade price', '请填写成交价格'));
                        return;
                      }
                      const qty = opQty ? parseInt(opQty, 10) : undefined;
                      const { syncMsg, syncOk } = saveOperationAndSync({
                        symbol,
                        name: nameOf(symbol) || undefined,
                        action: opAction,
                        price,
                        qty: qty && qty > 0 ? qty : undefined,
                        date: todayStr(),
                        source: 'one-tap',
                        adviceSnapshot: `${judgment.status}：${displayAdvice}`,
                        adviceScore: judgment.score,
                      });
                      setOpSyncMsg(
                        syncMsg
                          ? syncOk
                            ? tx(lang, `Auto-synced to holdings: ${syncMsg}`, `持仓已自动同步：${syncMsg}`)
                            : syncMsg
                          : tx(lang, 'Logged (no share count — sync it from Memory later)', '已记入（没填股数，可稍后去记忆页同步到持仓）'),
                      );
                      setOpSaved(true);
                      setTimeout(() => setShowOpModal(false), 2200);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-medium"
                  >
                    {tx(lang, 'Save', '保存')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* 📅 图上事件圆点详情：点圆点 → 事件内容 + 去资讯页财经日历的链接 */}
      {eventSheet &&
        (() => {
          const m = eventSheet;
          const icon =
            m.kind === 'earnings' ? '📢' : m.macroKind === 'fomc' ? '🏦' : m.macroKind === 'cpi' ? '📊' : '💼';
          const explainer =
            m.kind === 'earnings'
              ? tx(lang, 'Earnings day — volatility often spikes around earnings.', '财报日——财报日前后，股价波动常常放大。')
              : m.macroKind === 'fomc'
                ? tx(lang, 'Fed rate decision — when rates move, funding costs move everywhere.', '美联储议息决议——利率一动，全市场的资金成本跟着动。')
                : m.macroKind === 'cpi'
                  ? tx(lang, 'Key inflation data — shapes Fed rate-cut expectations directly.', '通胀关键数据——直接左右美联储的降息预期。')
                  : tx(lang, 'US nonfarm payrolls — labor-market heat often swings the market.', '美国非农就业数据——就业冷热，常引发市场大波动。');
          return (
            <div
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setEventSheet(null)}
            >
              <div
                className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <h3 className="font-bold text-slate-100 text-base">
                        {lang === 'en' ? m.titleEn : m.title}
                      </h3>
                      <p className="text-[11px] text-slate-500">
                        {m.time} · {m.kind === 'earnings' ? tx(lang, 'Earnings', '财报') : tx(lang, 'Macro event', '宏观事件')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEventSheet(null)}
                    className="text-slate-500 hover:text-slate-300 p-1 text-lg leading-none"
                    aria-label={tx(lang, 'Close', '关闭')}
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed mt-3">{explainer}</p>
                {onGoCalendar && (
                  <button
                    onClick={() => {
                      onGoCalendar(m.time);
                      setEventSheet(null);
                    }}
                    className="mt-4 w-full text-center text-xs font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-xl py-2.5 hover:bg-sky-500/20 transition-colors"
                  >
                    {tx(lang, 'View in finance calendar →', '去资讯页财经日历查看 →')}
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      {/* 🩺 买入前体检：5 道检查，拦住一时冲动 */}
      {showCheckup && data && judgment && (
        <BuyCheckup
          symbol={symbol}
          name={displayName(symbol)}
          score={judgment.score}
          hot={judgment.thresholds.hot}
          statusKey={judgment.statusKey}
          highs={highs}
          price={data.price}
          series={data.series}
          onClose={() => setShowCheckup(false)}
          lang={lang}
        />
      )}
    </div>
  );
}

