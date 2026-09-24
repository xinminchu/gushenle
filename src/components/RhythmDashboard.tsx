// src/components/RhythmDashboard.tsx
'use client';

import React, { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Flame, ShieldAlert, Settings2, X, Plus, RotateCcw, TrendingUp } from 'lucide-react';
import RhythmChart, { type ChartType } from './RhythmChart';
import AccuracyPanel from './AccuracyPanel';
import ChipPanel from './ChipPanel';
import FlowPanel from './FlowPanel';
import type { RhythmResponse } from '@/lib/rhythm';
import { RANGE_DEFS, RANGE_MAP, ANCHOR_RANGE_ID, scoreGradient } from '@/lib/rhythm';
import { adviceWithPosition } from '@/lib/rhythm';
import { getRhythm, invalidateRhythm } from '@/lib/market';
import { useMarketAutoRefresh } from '@/hooks/useMarketAutoRefresh';
import { useWatchlist } from './WatchlistContext';
import DiscoverStocks from './DiscoverStocks';
import { STOCK_NAMES } from '@/lib/stockAliases';
import {
  CODE_CORRECTIONS,
  STOCK_LIST,
  findStock,
  suggestStocks,
  type StockInfo,
} from '@/lib/stockList';
import { loadUniverse, findInUniverse, type UniverseEntry } from '@/lib/universe';
import { fmtMoney } from '@/lib/currency';
import { saveOperation, todayStr, type OpAction } from '@/lib/operations';
import { loadPositions } from '@/lib/positions';
import { useColorScheme, schemeLabel, upText, downText } from '@/lib/colorScheme';
import { useLanguage } from '@/context/LanguageContext';
import {
  findSwing,
  fibLevels,
  fibAdviceHint,
  fibPlainAdvice,
  fibKindLabel,
  nearestFibLevel,
  FIB_COMBOS,
  FIB_COMBO_IDS,
  FIB_LOOKBACKS,
  RECOMMENDED_FIB_COMBO,
  RECOMMENDED_FIB_LOOKBACK,
  type FibComboId,
} from '@/lib/fibonacci';

const ANCHOR_LABEL = RANGE_MAP[ANCHOR_RANGE_ID]?.label ?? '3月';

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

function buildZenHoldings(symbol: string, price: number | null): ZenHoldings | null {
  if (typeof window === 'undefined') return null;
  const positions = loadPositions();
  const pos = positions.find((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
  if (pos) {
    if (price == null || price <= 0) {
      return {
        kind: 'holding',
        shares: pos.shares,
        avgCost: pos.avgCost,
        advice: `你手里有 ${pos.shares} 股，成本 ${fmtMoney(symbol, pos.avgCost)}——涨这么猛，先别急着动手，看看要不要分批止盈？`,
      };
    }
    const pnl = (price - pos.avgCost) * pos.shares;
    const pnlPct = pos.avgCost > 0 ? ((price - pos.avgCost) / pos.avgCost) * 100 : 0;
    let advice: string;
    if (pnlPct >= 20) {
      advice = `已经赚了 ${pnlPct.toFixed(0)}%，涨这么猛，追高的人正在接盘——要不要先卖一部分，把利润装进口袋？`;
    } else if (pnlPct >= 0) {
      advice = `小赚 ${pnlPct.toFixed(1)}%，现在这个涨法拿着容易心态飘——可以考虑分批止盈，涨也有份、跌也不慌。`;
    } else if (pnlPct >= -10) {
      advice = `还亏 ${Math.abs(pnlPct).toFixed(1)}%，这波大涨是回本的好机会——要不要趁热减点仓？`;
    } else {
      advice = `还套着 ${Math.abs(pnlPct).toFixed(1)}%，反弹是难得的减亏窗口——别等涨回去又舍不得，分批走一点？`;
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
      advice: `你手里还没有 ${symbol}。涨成这样现在追进去，容易替别人站岗——真看好它，等它冷静下来再建仓也不迟。`,
      heldSummary,
    };
  }
  return {
    kind: 'none',
    advice:
      '我还不知道你手里有啥——去持仓页把持仓加上吧，有的话快去添加，好让我下次直接告诉你这只该卖该留，而不是说空话。',
  };
}

export default function RhythmDashboard({ onGoPortfolio }: { onGoPortfolio?: () => void }) {
  const {
    items: watchlist,
    isDefault,
    addItem,
    removeItem,
    resetToDefault,
    nameOf,
    focusSymbol,
    setFocusSymbol,
  } = useWatchlist();

  const [symbol, setSymbol] = useState('AAPL');
  const [range, setRange] = useState(ANCHOR_RANGE_ID);
  // 涨跌配色：默认绿涨红跌（美股习惯），页面上可一键切换，全站统一
  const { scheme, toggle: toggleScheme } = useColorScheme();
  const { lang } = useLanguage();
  // 高波/稳健说明的展开状态
  const [showTierInfo, setShowTierInfo] = useState(false);
  // 图表类型：3M 及以内默认 K线，长区间默认收盘线；用户手动切换后记住选择（切区间时重置）
  const [chartTypeOverride, setChartTypeOverride] = useState<ChartType | null>(null);
  const [showRangeHL, setShowRangeHL] = useState(true);
  /** 黄金分割参考线：开关 + 组合方案 + 波段窗口（调参用） */
  const [showFib, setShowFib] = useState(false);
  const [fibCombo, setFibCombo] = useState<FibComboId>(RECOMMENDED_FIB_COMBO);
  const [fibLookback, setFibLookback] = useState<number>(RECOMMENDED_FIB_LOOKBACK);
  // 换组合二级入口：默认收起，用户只看推荐视图
  const [showFibAdvanced, setShowFibAdvanced] = useState(false);
  const [data, setData] = useState<RhythmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showZenModal, setShowZenModal] = useState(false);
  // 沉思乐弹窗打开时：按当前标的查持仓，组织"看持仓说话"的内容
  const zenHoldings = useMemo(
    () => (showZenModal ? buildZenHoldings(symbol, data?.price ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showZenModal, symbol, data],
  );
  // 「记一笔」操作记录弹窗
  const [showOpModal, setShowOpModal] = useState(false);
  const [opAction, setOpAction] = useState<OpAction>('sell');
  const [opPrice, setOpPrice] = useState('');
  const [opQty, setOpQty] = useState('');
  const [opSaved, setOpSaved] = useState(false);
  // 区间横滑条的滚动位置：切区间/切股票重渲染时保持，不回到最左
  const rangeBarRef = useRef<HTMLDivElement | null>(null);
  const rangeScrollPos = useRef(0);
  useLayoutEffect(() => {
    const el = rangeBarRef.current;
    if (el && el.scrollLeft !== rangeScrollPos.current) {
      el.scrollLeft = rangeScrollPos.current;
    }
  });
  const [managing, setManaging] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  // 中文输入法组词中：此时不做大写转换，不写回输入框，避免拼音串被截断提交
  const [imeComposing, setImeComposing] = useState(false);
  /** 名称是否被用户手动改过：没改过才跟随代码自动更新 */
  const [nameEdited, setNameEdited] = useState(false);
  /** 未知代码时的联想建议 */
  const [suggestions, setSuggestions] = useState<StockInfo[]>([]);
  /** 全市场库命中的条目（精选名单里没有，但真实存在） */
  const [universeHit, setUniverseHit] = useState<UniverseEntry | null>(null);
  const [universeSearching, setUniverseSearching] = useState(false);
  /** 名单里没有也坚持添加（二次确认后） */
  const [forceAdd, setForceAdd] = useState(false);
  /** 成功提示（如自动纠正），绿色显示 */
  const [addNote, setAddNote] = useState('');

  // 从持仓页跳过来的标的
  useEffect(() => {
    if (focusSymbol) {
      setSymbol(focusSymbol);
      setFocusSymbol(null);
    }
  }, [focusSymbol, setFocusSymbol]);

  // 自选变化后，当前标的若被删则回到第一只。
  // 注意：从持仓/关注跳过来的标的可能根本不在自选里（手动加的关注），
  // 这种"从没进过自选"的不算被删，不能弹回第一只——只在"曾经在、现在没了"时回弹。
  const wasInWatchlist = useRef(false);
  useEffect(() => {
    const inList = watchlist.some((i) => i.symbol === symbol);
    if (wasInWatchlist.current && !inList && watchlist.length > 0) {
      setSymbol(watchlist[0].symbol);
    }
    wasInWatchlist.current = inList;
  }, [watchlist, symbol]);

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
    getRhythm(symbol, range)
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        console.error('获取律动数据失败:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range, autoTick]);

  // 盘中每 60 秒静默刷新一次实时价（页面切到后台时不拉；收盘后自动停）
  useEffect(() => {
    if (!data?.priceLive) return;
    const id = setInterval(() => {
      if (document.hidden) return;
      getRhythm(symbol, range, { force: true })
        .then((json) => setData(json))
        .catch((err) => console.error('盘中刷新失败:', err));
    }, 60000);
    return () => clearInterval(id);
  }, [data?.priceLive, symbol, range]);

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
      text: data.priceLive ? '昨收' : '收盘价',
    };
  }, [data?.prevClose, data?.priceLive, data?.series.length]);
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
    ? adviceWithPosition(judgment.statusKey, judgment.advice, myPnlPct)
    : '';
  // 韩股（.KS）：韩元计价，大数字加千分位、无小数；美股：美元保留两位
  const fmtPrice = (p: number) => fmtMoney(symbol, p);
  /** 报价时间短式："Sep 24, 2026 3:42 PM ET" -> "3:42PM"，让新鲜度看得见 */
  const quoteTimeShort = data?.priceTime
    ? (data.priceTime.match(/(\d{1,2}:\d{2})\s?([AP]M)/)?.[1] ?? null)
    : null;
  const strongHigh =
    !!judgment && judgment.score >= judgment.thresholds.hot && !judgment.overheated;
  const rangeLabel = RANGE_MAP[range]?.label ?? range;
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
    () => (showFib ? findSwing(fibPts, fibLookback) : null),
    [showFib, fibPts, fibLookback]
  );
  const fibChartLevels = useMemo(
    () => (fibSwing ? fibLevels(fibSwing, fibCombo) : null),
    [fibSwing, fibCombo]
  );
  /** 诊断卡联动：现价贴近推荐视图（上方 1.272/1.618 拦追高，
   * 下方 0.618/0.786 拦割肉）时给一句行为纠偏（常开）。 */
  const fibHint = useMemo(() => {
    if (!fibPts.length || !data?.price) return null;
    const sw = findSwing(fibPts, RECOMMENDED_FIB_LOOKBACK);
    if (!sw) return null;
    return fibAdviceHint(sw, RECOMMENDED_FIB_COMBO, data.price);
  }, [fibPts, data?.price]);

  // 精选名单代码集合：全市场搜索时排除（精选优先，带中文名）
  const curatedCodes = useMemo(() => new Set(STOCK_LIST.map((s) => s.code)), []);

  const resetAddTips = () => {
    setAddError('');
    setSuggestions([]);
    setUniverseHit(null);
    setForceAdd(false);
    setAddNote('');
  };

  const handleAdd = async (force = false) => {
    const raw = newSymbol.trim().toUpperCase();
    if (!raw) {
      setAddError('先输入代码，例如 AAPL');
      return;
    }
    // 常见输错自动纠正：TESLA->TSLA / APPLE->AAPL / INTEL->INTC
    const sym = CODE_CORRECTIONS[raw] || raw;
    const known = findStock(sym);
    if (!known && !(forceAdd || force)) {
      const inputRaw = newSymbol.trim();
      // 先走本地联想：中文名/拼音/英文名都认，代码框里输中文也能找到
      const sug = suggestStocks(inputRaw);
      if (sug.length > 0) {
        setUniverseHit(null);
        setSuggestions(sug);
        setAddError(`找到 ${sug.length} 个相关的，点一个填入`);
        return;
      }
      if (/[\u4e00-\u9fff]/.test(inputRaw)) {
        // 中文但精选名单没有：全市场库只有英文名，搜了也白搜
        setUniverseHit(null);
        setSuggestions([]);
        setAddError(`没找到「${inputRaw}」，换个名字或拼音试试，也可坚持添加`);
        return;
      }
      // 精选名单没有 → 去全市场库（约 7000 只）找，第一次搜才加载
      setUniverseSearching(true);
      const all = await loadUniverse();
      setUniverseSearching(false);
      const hit = findInUniverse(all, sym, curatedCodes);
      if (hit) {
        setUniverseHit(hit);
        setAddError('');
        setSuggestions([]);
        return;
      }
      setSuggestions([]);
      setAddError(`全市场也没找到 ${sym}，检查下拼写，或坚持添加`);
      return;
    }
    const r = addItem(sym, newName || known?.zh);
    if (r === 'ok') {
      setNewSymbol('');
      setNewName('');
      setNameEdited(false);
      setSuggestions([]);
      setUniverseHit(null);
      setForceAdd(false);
      setAddNote(CODE_CORRECTIONS[raw] ? `已自动纠正为 ${sym}` : '');
      setAddError('');
    } else if (r === 'exists') {
      setAddError('这只已在自选里');
    } else {
      setAddError('代码格式不对，例如 AAPL 或 000660.KS');
    }
  };

  /** 全市场命中的条目一键添加：用英文名做备注名 */
  const handleAddUniverseHit = () => {
    if (!universeHit) return;
    const r = addItem(universeHit.code, universeHit.en);
    if (r === 'ok') {
      setNewSymbol('');
      setNewName('');
      setNameEdited(false);
      setSuggestions([]);
      setUniverseHit(null);
      setForceAdd(false);
      setAddError('');
      setAddNote(`已添加 ${universeHit.code}`);
    } else if (r === 'exists') {
      setAddError('这只已在自选里');
      setUniverseHit(null);
    } else {
      setAddError('代码格式不对，例如 AAPL 或 000660.KS');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 标题 + 自选管理 + 标的选择 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 whitespace-nowrap">
            今日看板 · 谷峰律动
          </h1>
          <button
            onClick={() => setManaging((v) => !v)}
            className="text-xs text-slate-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {managing ? '收起' : '管理自选'}
          </button>
        </div>

        {managing && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">自选列表</span>
              {isDefault && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  默认推荐
                </span>
              )}
            </div>
            {/* 自选列表：一行两个，紧凑网格，省页面空间 */}
            <div className="grid grid-cols-2 gap-1.5">
              {watchlist.map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between bg-slate-800/60 rounded-lg pl-2.5 pr-1 py-1.5 min-w-0"
                >
                  <div className="min-w-0 truncate">
                    <span className="text-xs font-semibold text-slate-100">{item.symbol}</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">{item.name}</span>
                  </div>
                  <button
                    onClick={() => removeItem(item.symbol)}
                    disabled={watchlist.length <= 1}
                    className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1 shrink-0"
                    aria-label={`删除 ${item.symbol}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newSymbol}
                onCompositionStart={() => setImeComposing(true)}
                onCompositionEnd={(e) => {
                  setImeComposing(false);
                  const sym = e.currentTarget.value.toUpperCase();
                  setNewSymbol(sym);
                  setAddError('');
                  setSuggestions([]);
                  setUniverseHit(null);
                  setForceAdd(false);
                  setAddNote('');
                  // 名称没被手动改过就跟随代码自动更新
                  if (!nameEdited) setNewName(STOCK_NAMES[sym] || '');
                }}
                onChange={(e) => {
                  const rawVal = e.target.value;
                  // 组词过程中不碰输入内容，组词结束才转大写
                  const sym = imeComposing ? rawVal : rawVal.toUpperCase();
                  setNewSymbol(sym);
                  setAddError('');
                  setSuggestions([]);
                  setUniverseHit(null);
                  setForceAdd(false);
                  setAddNote('');
                  // 名称没被手动改过就跟随代码自动更新
                  if (!nameEdited) setNewName(STOCK_NAMES[sym.toUpperCase()] || '');
                }}
                placeholder="代码 如 COIN"
                className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setNameEdited(true);
                }}
                placeholder="名称（选填）"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => handleAdd()}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 添加
              </button>
            </div>
            {addError && <div className="text-[11px] text-rose-400">{addError}</div>}
            {addNote && <div className="text-[11px] text-emerald-400">{addNote}</div>}
            {universeSearching && (
              <div className="text-[11px] text-slate-500">正在全市场查找…</div>
            )}
            {universeHit && (
              <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700 rounded-lg px-2.5 py-2">
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] text-slate-400">全市场找到 </span>
                  <span className="text-[11px] font-semibold text-slate-100">
                    {universeHit.code}
                  </span>
                  <div className="text-[10px] text-slate-500 truncate">{universeHit.en}</div>
                </div>
                <button
                  onClick={handleAddUniverseHit}
                  className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
                >
                  直接添加
                </button>
              </div>
            )}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.code}
                    onClick={() => {
                      setNewSymbol(s.code);
                      setNewName(s.zh);
                      setNameEdited(false);
                      setSuggestions([]);
                      setAddError('');
                    }}
                    className="text-[11px] bg-slate-800 border border-slate-600 rounded-full px-2.5 py-1 text-slate-200 hover:border-blue-500"
                  >
                    {s.code} {s.zh}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setSuggestions([]);
                    setAddError('');
                    handleAdd(true);
                  }}
                  className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300 px-1 py-1"
                >
                  仍要添加
                </button>
              </div>
            )}
            {!isDefault && !confirmingReset && (
              <button
                onClick={() => setConfirmingReset(true)}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> 恢复默认推荐
              </button>
            )}
            {!isDefault && confirmingReset && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-amber-400">将清空你的自定义自选，确定吗？</span>
                <button
                  onClick={() => {
                    resetToDefault();
                    setConfirmingReset(false);
                  }}
                  className="text-red-400 underline underline-offset-2"
                >
                  确认恢复
                </button>
                <button
                  onClick={() => setConfirmingReset(false)}
                  className="text-slate-400 underline underline-offset-2"
                >
                  取消
                </button>
              </div>
            )}
            {/* 发现股票：按板块 / 主题筛选加入自选 */}
            <DiscoverStocks />
          </div>
        )}

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

      {loading ? (
        <div className="space-y-4">
          <div className="h-44 bg-slate-900 border border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-[3px] border-slate-700 border-t-blue-500 animate-spin" />
            <p className="text-xs text-slate-400">正在读取 {symbol} 行情…</p>
          </div>
          <div className="h-72 animate-pulse bg-slate-900 border border-slate-800 rounded-xl" />
        </div>
      ) : data && judgment ? (
        <>
          {/* ① 律动诊断：主判断永远锚定近 3 月，不随展示区间变化 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold mb-3 text-slate-200 flex items-center">
              律动诊断
              <span className="ml-2 text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                主判断 · 近{ANCHOR_LABEL}
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
                  aria-label="波动档位说明"
                >
                  i
                </button>
              )}
            </h2>
            {showTierInfo && judgment && (
              <div className="mb-3 text-[11px] text-slate-400 leading-relaxed bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2">
                {judgment.thresholds.tier === 'high'
                  ? '高波模式：这只股票最近波动大（日均涨跌超 3%），"涨太猛了 / 跌过头了"的门槛收得更紧（85/15 分），免得信号泛滥。'
                  : '稳健模式：这只股票最近波动温和，"涨太猛了 / 跌过头了"用常规门槛（80/20 分）。'}
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
                  <span className="text-xs text-slate-400">{nameOf(symbol)}</span>
                  {overHeat && (
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> 涨太猛
                    </span>
                  )}
                  {strongHigh && (
                    <span className="bg-sky-500/15 text-sky-400 border border-sky-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <TrendingUp className="w-3 h-3" /> 稳着涨
                    </span>
                  )}
                  {data.source === 'simulated' && (
                    <span className="text-[10px] text-slate-500">演示数据</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-500 mb-0.5">
                    {lang === 'en' ? 'Rhythm Score' : '律动值'}
                  </div>
                  <div
                    className={`text-4xl font-extrabold ${
                      overHeat ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {judgment.score}
                  </div>
                  <div className="text-[10px] text-slate-400">{judgment.status}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-200 shrink-0">
                  {fmtPrice(data.price)}
                </span>
                {data.priceLive ? (
                  <span className="flex items-center gap-1 shrink-0 text-[9px]" title={data.priceTime ?? undefined}>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-emerald-400">
                      实时{quoteTimeShort ? ` ${quoteTimeShort}` : ''}
                    </span>
                    {data.dayChangePct != null && (
                      <span className={data.dayChangePct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {data.dayChangePct >= 0 ? '+' : ''}
                        {data.dayChangePct}%
                      </span>
                    )}
                    {data.prevClose != null && (
                      <span className="text-slate-500">昨收 {fmtPrice(data.prevClose)}</span>
                    )}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-500 shrink-0">收盘价</span>
                )}
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
                位置 {judgment.pos} · 趋势 {judgment.trend} · 速度 {judgment.vel}
              </div>

              <div className="mt-2 text-xs text-slate-400 leading-relaxed">{displayAdvice}</div>
              {!myPosition && onGoPortfolio && (
                <button
                  onClick={onGoPortfolio}
                  className="mt-1.5 text-left text-[10px] text-slate-500 hover:text-slate-300 leading-relaxed"
                >
                  💡 持有这只？去持仓记一笔成本，下次建议按你的盈亏来说 →
                </button>
              )}
              {fibHint && (
                <div className="mt-2 text-[11px] text-amber-300/80 leading-relaxed">
                  {fibHint}
                </div>
              )}
              {overHeat && (
                <div className="mt-2 text-[10px] text-amber-400/70">点击卡片查看冷静清单</div>
              )}
              <button
                onClick={() => {
                  setOpAction(judgment.statusKey === 'oversoldBottom' ? 'buy' : 'sell');
                  setOpPrice(data.price ? fmtPrice(data.price) : '');
                  setOpQty('');
                  setOpSaved(false);
                  setShowOpModal(true);
                }}
                className="mt-3 w-full py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 font-medium transition-colors"
              >
                ✍️ 记一笔操作
              </button>
            </div>
          </div>

          {/* ② 价格走势图：区间只控制展示，是多空对照，不下结论 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-slate-200">
                价格走势 <span className="text-[10px] font-normal text-slate-500 ml-1">{symbol}</span>
              </h2>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium ${
                    data.changePct >= 0 ? upText(scheme) : downText(scheme)
                  }`}
                >
                  {data.changePct >= 0 ? '+' : ''}
                  {data.changePct}% / 近{rangeLabel}
                </span>
                <button
                  onClick={toggleScheme}
                  className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                  aria-label="切换涨跌配色"
                >
                  {schemeLabel(scheme)} ⇄
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
                  {d.label}
                </button>
              ))}
            </div>

            {/* 图表类型切换 + 区间高低点标注 */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex bg-slate-800 rounded-lg p-0.5 text-[11px]">
                {(['candle', 'line', 'ohlc'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setChartTypeOverride(t)}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      chartType === t ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t === 'candle' ? 'K线' : t === 'line' ? '收盘线' : '四线'}
                  </button>
                ))}
              </div>
              {chartType !== 'ohlc' && (
                <div className="flex gap-1.5">
                  {fibRangeOk && (
                    <Tip text="在图上画黄金分割参考线（金色虚线），只标大家都在看的位置，不算命">
                      <button
                        onClick={() => setShowFib((v) => !v)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                          showFib
                            ? 'border-yellow-600/50 text-yellow-400 bg-yellow-500/10'
                            : 'border-slate-700 text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        黄金分割
                      </button>
                    </Tip>
                  )}
                  <Tip text="显示 / 隐藏当前区间最高价和最低价的虚线">
                    <button
                      onClick={() => setShowRangeHL((v) => !v)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                        showRangeHL
                          ? 'border-emerald-500/50 text-emerald-400 bg-emerald-500/10'
                          : 'border-slate-700 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      区间高低点
                    </button>
                  </Tip>
                </div>
              )}
            </div>

            <RhythmChart
              series={data.series}
              height={240}
              chartType={chartType}
              showRangeHL={showRangeHL}
              scheme={scheme}
              fibLevels={fibChartLevels}
              prevCloseLabel={prevCloseLabel}
            />
            {/* 黄金分割：默认只看推荐视图，组合切换收进"换组合" */}
            {showFib && fibRangeOk && (
              <div className="mt-3 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
                {showFibAdvanced && (
                  <>
                    <div className="flex flex-wrap gap-1.5 mb-1.5">
                      {FIB_COMBO_IDS.map((id) => (
                        <Tip key={id} text={FIB_COMBOS[id].desc}>
                          <button
                            onClick={() => setFibCombo(id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] border transition-colors ${
                              fibCombo === id
                                ? 'border-yellow-600/50 text-yellow-300 bg-yellow-500/10'
                                : 'border-slate-700 text-slate-500 hover:text-slate-300'
                            }`}
                          >
                            {FIB_COMBOS[id].name}
                            {id === RECOMMENDED_FIB_COMBO && (
                              <span className="ml-1 text-[9px] px-1 rounded bg-yellow-500/20 text-yellow-400">
                                推荐
                              </span>
                            )}
                          </button>
                        </Tip>
                      ))}
                      <div className="flex gap-1.5 ml-1">
                        {FIB_LOOKBACKS.map((lb) => (
                          <Tip key={lb.days} text={lb.desc}>
                            <button
                              onClick={() => setFibLookback(lb.days)}
                              className={`px-2 py-1 rounded-lg text-[10px] transition-colors ${
                                fibLookback === lb.days
                                  ? 'bg-slate-700 text-slate-200'
                                  : 'text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              {lb.label}
                            </button>
                          </Tip>
                        ))}
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed mb-2">
                      {FIB_COMBOS[fibCombo].desc}
                    </p>
                  </>
                )}
                {fibSwing && fibChartLevels ? (
                  <>
                    <div className="text-[10px] text-slate-500 mb-1.5">
                      波段：{fibSwing.lowDate} 低 ${fibSwing.low} → {fibSwing.highDate} 高 $
                      {fibSwing.high}（{fibSwing.uptrend ? '上涨波段' : '下跌波段'}）
                    </div>
                    {/* 说人话：现价在哪 + 按持仓给行动句，每句带数字，不说空话 */}
                    {(() => {
                      const advice = fibPlainAdvice({
                        price: data.price,
                        levels: fibChartLevels,
                        swing: fibSwing,
                        pnlPct: myPnlPct,
                        fmt: fmtPrice,
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
                              💡 持有这只？去持仓记一笔成本，下次按你的盈亏来说 →
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
                          return (
                            <div
                              key={lv.ratio}
                              className={`flex items-center justify-between text-[11px] px-2 py-1 rounded ${
                                isNear ? 'bg-yellow-500/10' : ''
                              }`}
                            >
                              <span className="text-yellow-300/90 font-mono">
                                {isNear ? '📍 ' : ''}
                                {lv.ratio} · {fibKindLabel(lv.kind)}
                              </span>
                              <span className="text-slate-300 font-mono">${lv.price}</span>
                              <span className="text-slate-500 font-mono text-[10px]">
                                {dist == null
                                  ? ''
                                  : `${dist >= 0 ? '现价在其上方' : '现价在其下方'} ${Math.abs(dist).toFixed(1)}%`}
                              </span>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-slate-500">
                    该区间点数不足，画不出可靠波段（换个长一点的展示区间试试）
                  </div>
                )}
                <button
                  onClick={() => setShowFibAdvanced((v) => !v)}
                  className="mt-2 text-[10px] text-slate-500 hover:text-slate-300"
                >
                  {showFibAdvanced ? '收起组合 ▴' : '换组合 ▸'}
                </button>
                <p className="text-[10px] text-slate-600 mt-1.5">
                  参考线，不是算命：只标大家都在看的位置，不构成预测
                </p>
              </div>
            )}
            {chartType === 'ohlc' && (
              <p className="text-[10px] text-slate-500 leading-relaxed mt-1.5 px-0.5">
                怎么看：两条线之间的"带子"越宽，当天波动越大；收盘线贴着最高线走是强势，贴着最低线走是弱势；带子越收越窄之后，往往要选方向了。
              </p>
            )}

            {/* 分位位置条：现价在所选区间分位中的位置 */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>
                  分位低点 <strong className="text-emerald-400">${data.low}</strong>
                </span>
                <span>
                  分位高点 <strong className="text-rose-400">${data.high}</strong>
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
                <span>近{rangeLabel}分位位置{data.slicePos == null && '（点数不足）'}</span>
                <span>
                  数据点: {data.series.length} 天 · 数据更新于{' '}
                  {new Date(data.updatedAt).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* 筹码分布 + 资金流向：并排小面板 */}
          <div className="grid grid-cols-2 gap-2">
            <ChipPanel symbol={symbol} compact />
            <FlowPanel symbol={symbol} />
          </div>

          {/* ③ 判断复盘：历史信号 vs 次日真实结果 */}
          <AccuracyPanel symbol={symbol} />
        </>
      ) : (
        <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
          数据加载失败，请稍后重试
        </div>
      )}

      {/* 沉思乐：涨太猛了时点击诊断卡弹出的冷静拦截（看持仓说话） */}
      {showZenModal && data && judgment && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">涨太猛了，先缓一缓？</h3>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-amber-400">{symbol}</span>{' '}
              这几天涨得有点猛（律动 {judgment.score}{' '}
              分），要不要先深呼吸一下再决定？
            </p>
            {zenHoldings && (
              <div className="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-300 text-left space-y-1.5 leading-relaxed">
                {zenHoldings.kind === 'holding' && zenHoldings.shares != null && (
                  <>
                    <p>
                      你手里有{' '}
                      <span className="font-semibold text-slate-100">
                        {zenHoldings.shares} 股
                      </span>
                      {zenHoldings.avgCost != null && (
                        <> · 成本 {fmtMoney(symbol, zenHoldings.avgCost)}</>
                      )}
                      {zenHoldings.price != null && (
                        <> · 现价 {fmtMoney(symbol, zenHoldings.price)}</>
                      )}
                    </p>
                    {zenHoldings.pnl != null && zenHoldings.pnlPct != null && (
                      <p>
                        浮动{zenHoldings.pnl >= 0 ? '盈利' : '亏损'}{' '}
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
                      <p className="text-slate-500">你现在持有：{zenHoldings.heldSummary}</p>
                    )}
                  </>
                )}
                {zenHoldings.kind === 'none' && (
                  <p className="text-amber-300/90">{zenHoldings.advice}</p>
                )}
              </div>
            )}
            <div className="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-400 text-left space-y-1">
              <p className="font-medium text-slate-300">动手前，不妨问问自己：</p>
              <p>• 是不是怕错过，才想追进去？</p>
              <p>• 还记得当初为啥买它吗？</p>
              <p>• 如果明天跌 5%，今晚还睡得着吗？</p>
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
                  去持仓页添加
                </button>
              )}
              <button
                onClick={() => setShowZenModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-xl text-xs font-medium"
              >
                我想好了，先冷静一下
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
              记一笔 · {symbol} {nameOf(symbol) ? ` ${nameOf(symbol)}` : ''}
            </h3>
            <div className="text-[11px] text-slate-500 bg-slate-900/60 rounded-lg px-3 py-2">
              当时建议：{judgment.status}（{judgment.score}分）· {displayAdvice}
            </div>
            {opSaved ? (
              <div className="text-center py-4 text-sm text-emerald-400 font-medium">
                ✓ 已记入操作记忆，去记忆页看复盘
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
                      {a === 'buy' ? '买入' : '卖出'}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[11px] text-slate-500 mb-1">价格 *</div>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={opPrice}
                      onChange={(e) => setOpPrice(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 mb-1">数量（可选）</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={opQty}
                      onChange={(e) => setOpQty(e.target.value)}
                      placeholder="股数"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowOpModal(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-xl text-xs font-medium"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => {
                      const price = parseFloat(opPrice.replace(/,/g, ''));
                      if (!(price > 0)) {
                        alert('请填写成交价格');
                        return;
                      }
                      const qty = opQty ? parseInt(opQty, 10) : undefined;
                      saveOperation({
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
                      setOpSaved(true);
                      setTimeout(() => setShowOpModal(false), 1400);
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl text-xs font-medium"
                  >
                    保存
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

