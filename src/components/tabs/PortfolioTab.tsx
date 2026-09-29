'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, RefreshCw, Briefcase, GripVertical, Pencil, BookOpen } from 'lucide-react';
import { useWatchlist } from '@/components/WatchlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import type { Lang } from '@/lib/i18n';
import { loadPositions, savePositions, holdingDays, sectorOf, type Position } from '@/lib/positions';
import { loadFocus, saveFocus, weekStartStr, FOCUS_MAX, concentrationAdvice, type FocusState } from '@/lib/focus';
import { typicalBuyAmount } from '@/lib/portrait';
import { loadOperations } from '@/lib/operations';
import { loadUniverse, findInUniverse } from '@/lib/universe';
import { getRhythm, invalidateRhythm, dayChangePct } from '@/lib/market';
import { statusLabel, type RhythmResponse } from '@/lib/rhythm';
import { sectorLabel } from '@/lib/stockList';
import { useColorScheme, upText, downText } from '@/lib/colorScheme';
import { useWatchlistData } from '@/hooks/useWatchlistData';
import CostCalculator from '@/components/CostCalculator';
import StockBriefs from '@/components/StockBriefs';
import StockStory from '@/components/portfolio/StockStory';
import { fmtMoney } from '@/lib/currency';

/**
 * 持仓页：账户视角——我持有多少、成本、盈亏。
 * 行情走全 app 共享缓存（与今日页同源），诊断只给入口（点行跳今日看），不重复做。
 */

/** 持仓诊断一句话：律动状态 × 浮盈亏 → 大白话，不批评 */
function positionAdvice(lang: Lang, statusKey: string | undefined, pnlPct: number | null): string {
  const p = pnlPct;
  switch (statusKey) {
    case 'overheated':
      return p != null && p > 0
        ? tx(lang, `Running too hot, up ${p.toFixed(1)}% — bank some?`, `涨太猛了，浮盈 ${p.toFixed(1)}%，分批落袋？`)
        : tx(lang, `Running too hot — cool off, don't chase`, '涨太猛了，先冷静，别追');
    case 'hotStrong':
      return tx(lang, 'Strong near the top — hold, set your take-profit', '高位强势，拿着，止盈位设好');
    case 'weakLow':
      return p != null && p < 0
        ? tx(lang, `Still sliding, down ${Math.abs(p).toFixed(1)}% — don't rush to add`, `还在往下跌，浮亏 ${Math.abs(p).toFixed(1)}%，别急着补`)
        : tx(lang, `Still sliding — don't add yet`, '还在往下跌，先别加仓');
    case 'oversoldBottom':
      return p != null && p < 0
        ? tx(lang, `Oversold, down ${Math.abs(p).toFixed(1)}% — hold on for the bounce?`, `跌过头了，浮亏 ${Math.abs(p).toFixed(1)}%，拿住等反弹？`)
        : tx(lang, 'Oversold — hold on for the bounce?', '跌过头了，拿住等反弹？');
    case 'risingAccel':
      return tx(lang, 'Gaining momentum — hold', '涨势加速，拿着');
    case 'bottomUp':
      return tx(lang, 'Selling pressure easing — hold for direction', '跌不动了，拿着等方向');
    default:
      return tx(lang, 'Going sideways — hold for direction', '横盘波动，拿着等方向');
  }
}
export default function PortfolioTab({
  onViewSymbol,
  onGoMemory,
}: {
  onViewSymbol: (symbol: string) => void;
  onGoMemory?: (symbol: string) => void;
}) {
  // 涨跌配色跟随今日页的全局选择
  const { scheme } = useColorScheme();
  const { lang } = useLanguage();
  const { items: watchlist, nameOf, addItem } = useWatchlist();
  const [positions, setPositions] = useState<Position[]>([]);
  const [quotes, setQuotes] = useState<Record<string, RhythmResponse | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addSymbol, setAddSymbol] = useState('');
  const [addShares, setAddShares] = useState('');
  const [addCost, setAddCost] = useState('');
  const [addSince, setAddSince] = useState('');
  const [addError, setAddError] = useState('');
  // 本周关注：最多 6 只，周一自动清空；预算一周问一次，画像反填
  const [focus, setFocus] = useState<FocusState>(() => loadFocus());
  const [focusQuotes, setFocusQuotes] = useState<Record<string, RhythmResponse | null>>({});
  const [showBudgetAsk, setShowBudgetAsk] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');
  const [typicalAmt] = useState<number | null>(() => typicalBuyAmount(loadOperations()));
  // 持仓故事展开：一次只展开一只
  const [storySymbol, setStorySymbol] = useState<string | null>(null);
  // 本周关注手动加码
  const [showFocusAdd, setShowFocusAdd] = useState(false);
  const [focusAddCode, setFocusAddCode] = useState('');
  const [focusAddError, setFocusAddError] = useState('');

  /* ---------- 手动拖放排序（手机可用：拖动手柄 + pointer 事件） ---------- */
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dragCtl = useRef<{ from: number; startY: number; dragging: boolean } | null>(null);
  const justDragged = useRef(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  /** 根据指针 Y 坐标算出当前压在哪一行 */
  const indexAtY = (y: number): number => {
    const rows = rowRefs.current;
    for (let i = 0; i < rows.length; i++) {
      const el = rows[i];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return rows.length - 1;
  };

  const onHandlePointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    justDragged.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragCtl.current = { from: idx, startY: e.clientY, dragging: false };
  };

  const onHandlePointerMove = (e: React.PointerEvent) => {
    const st = dragCtl.current;
    if (!st) return;
    if (!st.dragging && Math.abs(e.clientY - st.startY) > 8) {
      st.dragging = true;
      justDragged.current = true;
      setDragFrom(st.from); // 真正拖起来才给视觉反馈
    }
    if (!st.dragging) return;
    const over = indexAtY(e.clientY);
    setDragOver((prev) => (prev === over ? prev : over));
  };

  const endDrag = (e: React.PointerEvent, commit: boolean) => {
    const st = dragCtl.current;
    dragCtl.current = null;
    setDragFrom(null);
    setDragOver(null);
    if (!st) return;
    if (commit && st.dragging) {
      const over = indexAtY(e.clientY);
      if (over !== st.from) {
        const next = [...positions];
        const [moved] = next.splice(st.from, 1);
        next.splice(over, 0, moved);
        persist(next); // 数组顺序即展示顺序，savePositions 持久化到 localStorage
      }
    }
  };

  useEffect(() => {
    setPositions(loadPositions());
  }, []);

  const persist = (next: Position[]) => {
    setPositions(next);
    savePositions(next);
  };

  /** 修正持仓：股数/成本填错、重复同步多加了，在这里直接改（两步 prompt，和"补填建仓日期"同风格） */
  const editPosition = (p: Position) => {
    const s1 = prompt(tx(lang, `Fix ${p.symbol} shares (now ${p.shares})`, `修正 ${p.symbol} 持仓股数（现在 ${p.shares} 股）`), String(p.shares));
    if (s1 == null) return;
    const shares = Number(s1);
    if (!Number.isFinite(shares) || shares <= 0) {
      alert(tx(lang, 'Share count looks off — no change made', '股数不对，没改'));
      return;
    }
    const s2 = prompt(
      tx(lang, `Fix ${p.symbol} avg cost (now $${p.avgCost.toFixed(2)})`, `修正 ${p.symbol} 平均成本（现在 $${p.avgCost.toFixed(2)}）`),
      String(p.avgCost),
    );
    if (s2 == null) return;
    const cost = Number(s2);
    if (!Number.isFinite(cost) || cost < 0) {
      alert(tx(lang, 'Cost looks off — no change made', '成本不对，没改'));
      return;
    }
    persist(
      positions.map((x) =>
        x.symbol === p.symbol
          ? { ...x, shares, avgCost: Math.round(cost * 100) / 100 }
          : x,
      ),
    );
  };

  const fetchQuotes = async (list: Position[], bust = false) => {
    if (list.length === 0) return;
    if (bust) invalidateRhythm();
    setRefreshing(true);
    const entries = await Promise.all(
      list.map(async (p) => {
        try {
          return [p.symbol, await getRhythm(p.symbol, '1M')] as const;
        } catch {
          return [p.symbol, null] as const;
        }
      }),
    );
    const map: Record<string, RhythmResponse | null> = {};
    entries.forEach(([s, q]) => {
      map[s] = q;
    });
    setQuotes(map);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchQuotes(positions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...positions.map((p) => p.symbol)].sort().join(',')]); // 排序后不重拉行情

  /* ---------- 一句话播报：自选股每天一句（走市场共享缓存，跟今日页同源） ---------- */
  const briefSymbols = useMemo(() => watchlist.map((w) => w.symbol), [watchlist]);
  const briefData = useWatchlistData(briefSymbols);

  /* ---------- 本周关注 ---------- */
  const focusSymbols = focus.items.map((i) => i.symbol);
  useEffect(() => {
    if (focusSymbols.length === 0) {
      setFocusQuotes({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        focusSymbols.map(async (s) => {
          try {
            return [s, await getRhythm(s, '1M')] as const;
          } catch {
            return [s, null] as const;
          }
        }),
      );
      const map: Record<string, RhythmResponse | null> = {};
      entries.forEach(([s, q]) => {
        map[s] = q;
      });
      setFocusQuotes(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusSymbols.sort().join(',')]);

  const persistFocus = (next: FocusState) => {
    setFocus(next);
    saveFocus(next);
  };

  const addFocus = (symbol: string) => {
    const s = symbol.toUpperCase();
    if (positions.some((p) => p.symbol === s)) return; // 已持有就不进关注
    if (focus.items.some((i) => i.symbol === s)) return;
    if (focus.items.length >= FOCUS_MAX) return;
    const firstOfWeek = focus.items.length === 0;
    persistFocus({ ...focus, items: [...focus.items, { symbol: s, addedAt: Date.now() }] });
    // 本周第一次加关注且还没定预算：问一次，画像反填默认值
    if (firstOfWeek && focus.budget == null) {
      setBudgetInput(typicalAmt != null ? String(typicalAmt) : '');
      setShowBudgetAsk(true);
    }
  };

  const removeFocus = (symbol: string) => {
    persistFocus({ ...focus, items: focus.items.filter((i) => i.symbol !== symbol) });
  };

  const confirmBudget = () => {
    const v = Number(budgetInput);
    persistFocus({ ...focus, budget: Number.isFinite(v) && v > 0 ? Math.round(v) : null });
    setShowBudgetAsk(false);
  };

  /** 手动加一只关注：输代码直接加，先验是不是真实股票 */
  const [focusAdding, setFocusAdding] = useState(false);
  const confirmFocusAdd = async () => {
    const code = focusAddCode.trim().toUpperCase();
    if (!code) {
      setFocusAddError(tx(lang, 'Enter a ticker first', '先填个股票代码'));
      return;
    }
    if (!/^[A-Z.]{1,10}$/.test(code) && !/^\d{6}\.[A-Z]{2}$/.test(code)) {
      setFocusAddError(tx(lang, 'Ticker format is off, e.g. NVDA, TSLA, or 000660.KS', '代码格式不对，如 NVDA、TSLA，或 000660.KS'));
      return;
    }
    if (positions.some((p) => p.symbol === code)) {
      setFocusAddError(tx(lang, 'Already in your holdings — no need to watch it', '这只已在持仓里，不用关注了'));
      return;
    }
    if (focus.items.some((i) => i.symbol === code)) {
      setFocusAddError(tx(lang, `Already in this week's focus list`, '这只已经在关注里了'));
      return;
    }
    if (focus.items.length >= FOCUS_MAX) {
      setFocusAddError(tx(lang, `Focus list is full (${FOCUS_MAX}) — remove one first`, `关注已满 ${FOCUS_MAX} 只，先删一只再加`));
      return;
    }
    setFocusAdding(true);
    // 先在精选名单里找（nameOf 能解析即真实），找不到再查全市场库
    let displayName: string | undefined;
    const known = nameOf(code);
    if (known !== code) {
      displayName = known;
    } else {
      try {
        const all = await loadUniverse();
        const hit = findInUniverse(all, code, new Set());
        if (!hit) {
          setFocusAddError(tx(lang, `Couldn't find ${code} — check the spelling`, `没找到 ${code} 这只股票，检查下代码拼写`));
          setFocusAdding(false);
          return;
        }
        displayName = hit.en.replace(/\s+(Class\s+[A-Z]\s+)?Common\s+Stock$/i, '').trim() || hit.en;
      } catch {
        setFocusAddError(tx(lang, 'Stock list failed to load — try again later', '股票库加载失败，稍后再试'));
        setFocusAdding(false);
        return;
      }
    }
    setFocusAdding(false);
    const firstOfWeek = focus.items.length === 0;
    persistFocus({
      ...focus,
      items: [...focus.items, { symbol: code, addedAt: Date.now(), name: displayName }],
    });
    // 关注的股票自动进自选：自选 = 持仓 ∪ 本周关注 ∪ 其他手动添加
    if (!watchlist.some((i) => i.symbol === code)) {
      addItem(code, displayName);
    }
    setFocusAddCode('');
    setFocusAddError('');
    setShowFocusAdd(false);
    if (firstOfWeek && focus.budget == null) {
      setBudgetInput(typicalAmt != null ? String(typicalAmt) : '');
      setShowBudgetAsk(true);
    }
  };

  /** 改本周预算：和"修正持仓"同风格，两步 prompt 太重，这里一步就够 */
  const editBudget = () => {
    const v = prompt(tx(lang, `Edit this week's budget (USD)`, '修改本周预算（美元）'), focus.budget != null ? String(focus.budget) : '');
    if (v == null) return;
    const n = Math.round(Number(v));
    if (!Number.isFinite(n) || n <= 0) {
      alert(tx(lang, 'Budget must be above 0 — no change made', '预算得是个大于 0 的数字，没改'));
      return;
    }
    persistFocus({ ...focus, budget: n });
  };

  // 汇总（只统计已拿到行情的）
  let totalValue = 0;
  let totalCost = 0;
  let totalDayPnl = 0;
  positions.forEach((p) => {
    const q = quotes[p.symbol];
    if (q) {
      totalValue += p.shares * q.price;
      totalCost += p.shares * p.avgCost;
      const dc = dayChangePct(q);
      if (dc != null) totalDayPnl += p.shares * q.price * (dc / 100);
    }
  });
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const totalDayPnlPct = totalValue - totalDayPnl > 0 ? (totalDayPnl / (totalValue - totalDayPnl)) * 100 : 0;

  // 板块分布（按市值）
  const sectorValue: Record<string, number> = {};
  const sectorSymbols: Record<string, string[]> = {};
  positions.forEach((p) => {
    const q = quotes[p.symbol];
    if (!q) return;
    const s = sectorOf(p.symbol);
    sectorValue[s] = (sectorValue[s] ?? 0) + p.shares * q.price;
    (sectorSymbols[s] ??= []).push(p.symbol);
  });
  const sectorRows = Object.entries(sectorValue)
    .map(([s, v]) => ({
      sector: s,
      value: v,
      pct: totalValue > 0 ? (v / totalValue) * 100 : 0,
      symbols: sectorSymbols[s] ?? [],
    }))
    .sort((a, b) => b.value - a.value);

  // 画像小结（只摆事实）
  const maxPos = positions
    .map((p) => ({ p, v: quotes[p.symbol] ? p.shares * (quotes[p.symbol] as RhythmResponse).price : 0 }))
    .sort((a, b) => b.v - a.v)[0];
  const maxPosPct = maxPos && totalValue > 0 ? (maxPos.v / totalValue) * 100 : 0;
  const holdDaysList = positions
    .map((p) => holdingDays(p.since))
    .filter((d): d is number => d != null);
  const avgHoldDays =
    holdDaysList.length > 0 ? Math.round(holdDaysList.reduce((a, b) => a + b, 0) / holdDaysList.length) : null;

  const handleAdd = () => {
    const shares = Number(addShares);
    const cost = Number(addCost);
    if (!addSymbol) {
      setAddError(tx(lang, 'Pick a stock from your watchlist', '请选择一只自选股'));
      return;
    }
    if (positions.some((p) => p.symbol === addSymbol)) {
      setAddError(tx(lang, 'Already in your holdings', '这只已在持仓里'));
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setAddError(tx(lang, 'Shares must be above 0', '股数填一个大于 0 的数字'));
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setAddError(tx(lang, 'Cost must be 0 or above', '成本价填一个不小于 0 的数字'));
      return;
    }
    if (addSince && !/^\d{4}-\d{2}-\d{2}$/.test(addSince)) {
      setAddError(tx(lang, 'Buy date format is off', '建仓日期格式不对'));
      return;
    }
    persist([
      ...positions,
      { symbol: addSymbol, shares, avgCost: cost, since: addSince || undefined },
    ]);
    setAddSymbol('');
    setAddShares('');
    setAddCost('');
    setAddSince('');
    setAddError('');
    setShowAdd(false);
  };

  return (
    <div className="p-4 space-y-5 pb-24 max-w-md mx-auto">
      <header className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">{tx(lang, 'Portfolio', '持仓 Portfolio')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{tx(lang, 'Log holdings by hand — prices come from the same feed as the Today tab', '手动记录持仓，行情与今日页同源')}</p>
        </div>
        <button
          onClick={() => fetchQuotes(positions, true)}
          disabled={refreshing || positions.length === 0}
          className="text-xs text-slate-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          {tx(lang, 'Refresh', '刷新')}
        </button>
      </header>

      {/* 汇总卡 */}
      {positions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">{tx(lang, 'Total value', '总市值')}</span>
            <span className="text-2xl font-extrabold text-slate-100">
              ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-slate-400">{tx(lang, 'Total P&L', '总盈亏')}</span>
            <span
              className={`text-sm font-bold ${totalPnl >= 0 ? upText(scheme) : downText(scheme)}`}
            >
              {totalPnl >= 0 ? '+' : ''}$
              {totalPnl.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}{' '}
              ({totalPnl >= 0 ? '+' : ''}
              {totalPnlPct.toFixed(2)}%)
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-slate-400">{tx(lang, `Today's P&L`, '今日盈亏')}</span>
            <span
              className={`text-sm font-bold ${totalDayPnl >= 0 ? upText(scheme) : downText(scheme)}`}
            >
              {totalDayPnl >= 0 ? '+' : ''}$
              {totalDayPnl.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}{' '}
              ({totalDayPnl >= 0 ? '+' : ''}
              {totalDayPnlPct.toFixed(2)}%)
            </span>
          </div>
        </div>
      )}

      {/* 板块分布 + 画像小结 */}
      {positions.length > 0 && sectorRows.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-slate-200">{tx(lang, 'By sector', '板块分布')}</div>
            <div className="text-[10px] text-slate-600">{tx(lang, 'Left: sector · right: % of value', '左：板块 · 右：市值占比')}</div>
          </div>
          {sectorRows.map((r) => (
            <div key={r.sector} className="text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16 shrink-0">{sectorLabel(r.sector, lang)}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500/70"
                    style={{ width: `${Math.min(100, r.pct)}%` }}
                  />
                </div>
                <span className="text-slate-300 w-12 text-right">{r.pct.toFixed(0)}%</span>
              </div>
              <div className="pl-[4.5rem] pt-0.5 text-[10px] text-slate-600">
                {r.symbols.join(' · ')}
              </div>
            </div>
          ))}
          <div className="pt-1 text-[11px] text-slate-500 leading-relaxed">
            {maxPos && maxPosPct > 0 && (
              <span>
                {tx(
                  lang,
                  `Largest position ${maxPos.p.symbol} is ${maxPosPct.toFixed(0)}%${maxPosPct >= 40 ? ' (pretty concentrated)' : '; '}`,
                  `最大持仓 ${maxPos.p.symbol} 占 ${maxPosPct.toFixed(0)}% ${maxPosPct >= 40 ? '（比较集中）' : '；'}`,
                )}
              </span>
            )}
            {avgHoldDays != null && (
              <span>{tx(lang, `Avg holding period: ${avgHoldDays} days;`, `平均持有 ${avgHoldDays} 天；`)}</span>
            )}
            <span>
              {tx(
                lang,
                `${positions.length} holdings${holdDaysList.length < positions.length ? ' (some missing buy dates)' : ''}`,
                `共 ${positions.length} 只${holdDaysList.length < positions.length ? '（部分缺建仓日期）' : ''}`,
              )}
            </span>
          </div>
        </div>
      )}

      {/* 持仓列表（可拖动手柄排序，顺序自动保存） */}
      {positions.length > 0 && (
        <div className="text-[11px] text-slate-400 px-1 -mb-1">
          {tx(lang, 'Left: stock / shares·cost — right: price / P&L', '左列：股票 / 股数·成本　右列：现价 / 盈亏')}
        </div>
      )}
      <div className="space-y-3">
        {positions.map((p, idx) => {
          const q = quotes[p.symbol];
          const price = q?.price ?? null;
          const dayChg = q ? dayChangePct(q) : null;
          const pnl = price != null ? (price - p.avgCost) * p.shares : null;
          const pnlPct = price != null && p.avgCost > 0 ? ((price - p.avgCost) / p.avgCost) * 100 : null;
          const isDragged = dragFrom === idx;
          const isTarget = dragOver === idx && dragFrom !== null && dragOver !== dragFrom;
          return (
            <div
              key={p.symbol}
              ref={(el) => {
                rowRefs.current[idx] = el;
              }}
              onClick={() => {
                // 刚拖放完的这次点击不跳转
                if (justDragged.current) {
                  justDragged.current = false;
                  return;
                }
                onViewSymbol(p.symbol);
              }}
              className={`bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 cursor-pointer hover:border-slate-500 transition-all select-none ${
                isDragged ? 'opacity-40' : ''
              } ${isTarget ? 'ring-2 ring-blue-500/60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onPointerDown={(e) => onHandlePointerDown(e, idx)}
                    onPointerMove={onHandlePointerMove}
                    onPointerUp={(e) => endDrag(e, true)}
                    onPointerCancel={(e) => endDrag(e, false)}
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-600 hover:text-slate-300 active:text-slate-200 cursor-grab active:cursor-grabbing touch-none p-1 -ml-1"
                    aria-label={tx(lang, `Drag to reorder ${p.symbol}`, `拖动排序 ${p.symbol}`)}
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-slate-100 text-base">{p.symbol}</span>
                  <span className="text-xs text-slate-400">{nameOf(p.symbol)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStorySymbol((cur) => (cur === p.symbol ? null : p.symbol));
                    }}
                    className={`p-0.5 ${storySymbol === p.symbol ? 'text-blue-400' : 'text-slate-600 hover:text-blue-400'}`}
                    title={storySymbol === p.symbol ? tx(lang, 'Hide my holding story', '收起持仓故事') : tx(lang, 'See my holding story', '看我的持仓故事')}
                    aria-label={tx(lang, `${storySymbol === p.symbol ? 'Hide' : 'Show'} ${p.symbol} holding story`, `${storySymbol === p.symbol ? '收起' : '展开'} ${p.symbol} 持仓故事`)}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      editPosition(p);
                    }}
                    className="text-slate-600 hover:text-blue-400 p-0.5"
                    aria-label={tx(lang, `Fix ${p.symbol} holding`, `修正 ${p.symbol} 持仓`)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      persist(positions.filter((x) => x.symbol !== p.symbol));
                    }}
                    className="text-slate-600 hover:text-rose-400 p-0.5"
                    aria-label={tx(lang, `Remove ${p.symbol} holding`, `删除 ${p.symbol} 持仓`)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-right">
                  {price != null ? (
                    <>
                      <div className="text-slate-200 font-semibold text-sm">{fmtMoney(p.symbol, price)}</div>
                      {dayChg != null && (
                        <div className={`text-[11px] ${dayChg >= 0 ? upText(scheme) : downText(scheme)}`}>
                          {dayChg >= 0 ? '+' : ''}
                          {dayChg}% {tx(lang, 'today', '今日')}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-500">{tx(lang, 'Loading prices…', '行情加载中…')}</div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {p.shares} {tx(lang, 'shares', '股')} · {tx(lang, 'cost', '成本')} {fmtMoney(p.symbol, p.avgCost)}
                  {(() => {
                    const d = holdingDays(p.since);
                    return d != null ? (
                      <span className="text-slate-500"> · {tx(lang, `held ${d} days`, `持有 ${d} 天`)}</span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = prompt(tx(lang, 'Buy date (YYYY-MM-DD), e.g. 2026-06-01', '建仓日期（YYYY-MM-DD），例如 2026-06-01'));
                          if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                            persist(positions.map((x) => (x.symbol === p.symbol ? { ...x, since: v } : x)));
                          } else if (v) {
                            alert(tx(lang, 'Date format is off', '日期格式不对'));
                          }
                        }}
                        className="text-blue-400/80 hover:text-blue-300 ml-1 underline underline-offset-2"
                      >
                        {tx(lang, 'Add buy date', '补填建仓日期')}
                      </button>
                    );
                  })()}
                </span>
                {pnl != null && pnlPct != null ? (
                  <span className={`font-semibold ${pnl >= 0 ? upText(scheme) : downText(scheme)}`}>
                    {pnl >= 0 ? '+' : ''}{fmtMoney(p.symbol, Math.abs(pnl))} ({pnl >= 0 ? '+' : ''}
                    {pnlPct.toFixed(2)}%)
                  </span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </div>
              {q && (
                <div className="mt-2 space-y-1">
                  <div className="text-[11px] text-amber-300/90">
                    💡 {positionAdvice(lang, q.judgment.statusKey, pnlPct)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {tx(lang, 'Rhythm score', '律动分')}{' '}
                    <span className="font-bold text-slate-300">{q.judgment.score}</span> ·{' '}
                    {q.judgment.statusKey
                      ? statusLabel(q.judgment.statusKey, lang)
                      : tx(lang, 'Not enough data', '数据不足')}{' '}
                    → {tx(lang, 'tap to see the diagnosis in the Today tab', '点击去今日看诊断')}
                  </div>
                </div>
              )}
              {storySymbol === p.symbol && (
                <StockStory symbol={p.symbol} quote={q ?? null} onGoMemory={onGoMemory} />
              )}
            </div>
          );
        })}

        {positions.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Briefcase className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">{tx(lang, 'No holdings logged yet', '还没有记录持仓')}</p>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-xl"
            >
              {tx(lang, 'Add your first holding', '添加第一笔持仓')}
            </button>
          </div>
        )}
      </div>

      {/* 本周关注：冷静池——想买先放着，最多 6 只，周一自动清空 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-200">
            👀 {tx(lang, `This week's focus`, '本周关注')}{' '}
            <span className="text-slate-500 font-normal">({focus.items.length}/{FOCUS_MAX})</span>
          </div>
          <div className="text-[10px] text-slate-600">{tx(lang, 'Resets every Monday · park it here before you buy', '周一自动刷新 · 想买先冷静')}</div>
        </div>

        {/* 预算：一周问一次，画像反填 */}
        {showBudgetAsk ? (
          <div className="bg-slate-800/70 border border-blue-500/30 rounded-lg p-3 space-y-2">
            <div className="text-xs text-slate-200">
              {tx(lang, 'How much are you putting in this week (USD)?', '这周准备投多少（美元）？')}
              {typicalAmt != null && (
                <span className="text-slate-400">{tx(lang, `(your usual single buy is around $${typicalAmt.toLocaleString()})`, `（你过去单笔通常 ${typicalAmt.toLocaleString()} 左右）`)}</span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                inputMode="numeric"
                placeholder={tx(lang, 'e.g. 10000 (USD)', '如 10000（美元）')}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={confirmBudget}
                className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg"
              >
                {tx(lang, 'Confirm', '确认')}
              </button>
              <button
                onClick={() => setShowBudgetAsk(false)}
                className="text-slate-400 text-xs px-2"
              >
                {tx(lang, 'Skip', '跳过')}
              </button>
            </div>
          </div>
        ) : (
          focus.budget != null && (
            <div className="text-[11px] text-slate-400 leading-relaxed flex items-center gap-1 flex-wrap">
              <span>
                {tx(lang, `This week's budget`, '本周预算')}{' '}
                <span className="font-bold text-slate-200">${focus.budget.toLocaleString()}</span>
              </span>
              <button
                onClick={editBudget}
                className="text-slate-600 hover:text-blue-400 p-0.5"
                title={tx(lang, `Edit this week's budget`, '修改本周预算')}
                aria-label={tx(lang, `Edit this week's budget`, '修改本周预算')}
              >
                <Pencil className="w-3 h-3" />
              </button>
              {(() => {
                const advice = concentrationAdvice(focus.budget);
                if (!advice) return null;
                const en =
                  advice === '预算不大，1-2 只就够了，摊太散每只涨 10% 也没感觉'
                    ? 'Small budget — 1–2 stocks is plenty; spread too thin and a 10% pop barely moves the needle'
                    : advice === '这个预算 2-3 只比较舒服，别超过 4 只'
                      ? 'This budget fits 2–3 stocks comfortably — keep it under 4'
                      : `Even with a big budget, don't overdo it: 3–4 stocks, 6 max`;
                return <span className="text-slate-500">💡 {tx(lang, en, advice)}</span>;
              })()}
            </div>
          )
        )}

        {/* 关注列表 */}
        {focus.items.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {focus.items.map((f) => {
              const q = focusQuotes[f.symbol];
              const price = q?.price ?? null;
              const dayChg = q ? dayChangePct(q) : null;
              const statusKey = q?.judgment.statusKey;
              const cooling = statusKey === 'overheated';
              return (
                <div
                  key={f.symbol}
                  onClick={() => onViewSymbol(f.symbol)}
                  className="bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 cursor-pointer hover:border-slate-500"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{f.symbol}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFocus(f.symbol);
                      }}
                      className="text-slate-600 hover:text-rose-400 p-0.5"
                      aria-label={tx(lang, `Stop watching ${f.symbol}`, `移除关注 ${f.symbol}`)}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">{f.name ?? nameOf(f.symbol)}</div>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-xs text-slate-200 font-semibold">
                      {price != null ? fmtMoney(f.symbol, price) : '…'}
                    </span>
                    {dayChg != null && (
                      <span className={`text-[10px] ${dayChg >= 0 ? upText(scheme) : downText(scheme)}`}>
                        {dayChg >= 0 ? '+' : ''}{dayChg}%
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[10px]">
                    {cooling ? (
                      <span className="text-sky-300">{tx(lang, '🧊 Running too hot — cool off first', '🧊 涨太猛了，先冷静')}</span>
                    ) : (
                      <span className="text-slate-500">
                        {q
                          ? q.judgment.statusKey
                            ? statusLabel(q.judgment.statusKey, lang)
                            : tx(lang, 'Not enough data', '数据不足')
                          : tx(lang, 'Loading rhythm…', '律动加载中…')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 从自选加关注 */}
        {(() => {
          const candidates = watchlist.filter(
            (w) =>
              !positions.some((p) => p.symbol === w.symbol) &&
              !focus.items.some((i) => i.symbol === w.symbol),
          );
          if (candidates.length === 0 || focus.items.length >= FOCUS_MAX) return null;
          return (
            <div>
              <div className="text-[10px] text-slate-500 mb-1.5">{tx(lang, `Pick from your watchlist (held stocks won't show here)`, '从自选里挑（已持有的不会出现在这里）')}</div>
              <div className="flex flex-wrap gap-1.5">
                {candidates.slice(0, 12).map((c) => (
                  <button
                    key={c.symbol}
                    onClick={() => addFocus(c.symbol)}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700"
                  >
                    + {c.symbol}
                  </button>
                ))}
              </div>
            </div>
          );
        })()}
        {focus.items.length === 0 && (
          <div className="text-[11px] text-slate-500 leading-relaxed">
            {tx(lang, `Nothing here yet. Eyeing a stock but unsure? Park it here for a few days before deciding.`, '还没关注。看中哪只但拿不准的，先放这里冷静几天，再决定买不买。')}
          </div>
        )}

        {/* 手动加一只：不经过自选，输代码直接加 */}
        {focus.items.length < FOCUS_MAX &&
          (showFocusAdd ? (
            <div className="space-y-1.5">
              <div className="flex gap-2">
                <input
                  value={focusAddCode}
                  onChange={(e) => {
                    setFocusAddCode(e.target.value.toUpperCase());
                    setFocusAddError('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmFocusAdd();
                  }}
                  placeholder={tx(lang, 'Enter a ticker, e.g. NVDA', '输代码，如 NVDA')}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 uppercase"
                />
                <button
                  onClick={confirmFocusAdd}
                  disabled={focusAdding}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg"
                >
                  {focusAdding ? tx(lang, 'Checking…', '查验中…') : tx(lang, 'Watch', '加关注')}
                </button>
                <button onClick={() => setShowFocusAdd(false)} className="text-slate-400 text-xs px-1">
                  {tx(lang, 'Cancel', '取消')}
                </button>
              </div>
              {focusAddError && <div className="text-[11px] text-rose-400">{focusAddError}</div>}
            </div>
          ) : (
            <button
              onClick={() => setShowFocusAdd(true)}
              className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded-lg py-2 text-[11px]"
            >
              {tx(lang, `＋ Add one manually (works even if it's not in your watchlist)`, '＋ 手动加一只（自选里没有也能加）')}
            </button>
          ))}
      </div>

      {/* 📣 一句话播报：自选股每天一句，看完顺手「＋关注」进本周冷静池 */}
      <StockBriefs
        symbols={briefSymbols}
        nameOf={nameOf}
        dataMap={briefData}
        loading={Object.keys(briefData).length === 0}
        onPick={onViewSymbol}
        onAddFocus={addFocus}
        focusSymbols={focusSymbols}
        positionSymbols={positions.map((p) => p.symbol)}
        focusFull={focus.items.length >= FOCUS_MAX}
      />

      {/* 添加持仓 */}
      {positions.length > 0 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded-xl py-2.5 text-xs flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> {tx(lang, 'Add holding', '添加持仓')}
        </button>
      )}

      {showAdd && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-slate-200">{tx(lang, 'Add holding', '添加持仓')}</div>
          <div>
            <label className="text-[11px] text-slate-400">{tx(lang, 'Stock (pick from your watchlist)', '股票（从自选里选）')}</label>
            <select
              value={addSymbol}
              onChange={(e) => {
                setAddSymbol(e.target.value);
                setAddError('');
              }}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="">{tx(lang, 'Choose…', '请选择…')}</option>
              {watchlist.map((c) => {
                const held = positions.some((p) => p.symbol === c.symbol);
                return (
                  <option key={c.symbol} value={c.symbol} disabled={held}>
                    {c.symbol} {c.name}
                    {held ? tx(lang, ' (held)', '（已持有）') : ''}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400">{tx(lang, 'Shares', '股数')}</label>
              <input
                value={addShares}
                onChange={(e) => setAddShares(e.target.value)}
                inputMode="decimal"
                placeholder={tx(lang, 'e.g. 100', '如 100')}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">{tx(lang, 'Avg cost $', '成本价 $')}</label>
              <input
                value={addCost}
                onChange={(e) => setAddCost(e.target.value)}
                inputMode="decimal"
                placeholder={tx(lang, 'e.g. 150.00', '如 150.00')}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">{tx(lang, 'Buy date (optional — used for holding days)', '建仓日期（可选，用于算持有天数）')}</label>
            <input
              type="date"
              value={addSince}
              onChange={(e) => setAddSince(e.target.value)}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>
          {addError && <div className="text-[11px] text-rose-400">{addError}</div>}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowAdd(false);
                setAddError('');
              }}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-xl text-xs"
            >
              {tx(lang, 'Cancel', '取消')}
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-medium"
            >
              {tx(lang, 'Save', '保存')}
            </button>
          </div>
          {watchlist.length > 0 &&
            watchlist.every((w) => positions.some((p) => p.symbol === w.symbol)) && (
              <div className="text-[11px] text-slate-500">{tx(lang, 'Everything in your watchlist is already added — add more under “Manage watchlist” in the Today tab.', '自选里的股票都已加完，去今日页「管理自选」可加更多。')}</div>
            )}
        </div>
      )}

      {/* 真实成本试算器 */}
      <CostCalculator />
    </div>
  );
}
