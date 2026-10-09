'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X, RefreshCw, Briefcase, GripVertical, Pencil, BookOpen, BarChart3 } from 'lucide-react';
import { useWatchlist } from '@/components/WatchlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import type { Lang } from '@/lib/i18n';
import { loadPositions, savePositions, holdingDays, sectorOf, type Position } from '@/lib/positions';
import { loadAccount, saveAccount, todayStr, type AccountInfo } from '@/lib/account';
import { SYNC_EVENT } from '@/lib/userSync';
import { getRhythm, invalidateRhythm, dayChangePct } from '@/lib/market';
import { statusLabel, type RhythmResponse } from '@/lib/rhythm';
import { groupFocusHistory, weekLabel, clearFocusHistory } from '@/lib/focusHistory';
import { sectorLabel } from '@/lib/stockList';
import { useColorScheme, upText, downText } from '@/lib/colorScheme';
import CostCalculator from '@/components/CostCalculator';
import StockStory from '@/components/portfolio/StockStory';
import HoldingAnalysis from '@/components/portfolio/HoldingAnalysis';
import { fmtMoney } from '@/lib/currency';

/**
 * 持仓页：账户视角——我持有多少、成本、盈亏。
 * 行情走全 app 共享缓存（与今日页同源），诊断只给入口（点行跳今日看），不重复做。
 */

/** 持仓诊断一句话：律动状态 × 浮盈亏 → 大白话，不批评 */
function positionAdvice(lang: Lang, statusKey: string | undefined, pnlPct: number | null, score?: number): string {
  const p = pnlPct;
  switch (statusKey) {
    case 'overheated':
      return p != null && p > 0
        ? tx(lang, `Running too hot, up ${p.toFixed(1)}% — bank some?`, `涨太猛了，浮盈 ${p.toFixed(1)}%，分批落袋？`)
        : tx(lang, `Running too hot — cool off, chasing is risky`, '涨太猛了，先冷静，追高要慎');
    case 'hotStrong':
      // 90+ 分：位置已到近 3 个月极高位，新开仓/加仓多提醒一句
      if (score != null && score >= 90)
        return tx(lang, 'Strong near the top, 90+ — holding is fine, but fresh buys/adds deserve extra caution', '高位强势，拿着；90+ 分位置已极高，新买/加仓更要慎');
      return tx(lang, 'Strong near the top — hold, set your take-profit', '高位强势，拿着，止盈位设好');
    case 'weakLow':
      return p != null && p < 0
        ? tx(lang, `Still sliding, down ${Math.abs(p).toFixed(1)}% — adding can wait`, `还在往下跌，浮亏 ${Math.abs(p).toFixed(1)}%，补仓不急`)
        : tx(lang, `Still sliding — adding can wait`, '还在往下跌，加仓不急');
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
  const [account, setAccount] = useState<AccountInfo | null>(() => loadAccount());
  const [showAccount, setShowAccount] = useState(false);
  const [showPnlDetail, setShowPnlDetail] = useState(false);
  const [acctBrokerage, setAcctBrokerage] = useState('');
  const [acctCapital, setAcctCapital] = useState('');
  const [acctRealized, setAcctRealized] = useState('');
  const [acctError, setAcctError] = useState('');
  const [quotes, setQuotes] = useState<Record<string, RhythmResponse | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addSymbol, setAddSymbol] = useState('');
  const [addShares, setAddShares] = useState('');
  const [addCost, setAddCost] = useState('');
  const [addSince, setAddSince] = useState('');
  const [addError, setAddError] = useState('');
  // 历史关注：以前「＋关注」过的股票，按周分组展示（本周在最上）
  const [histTick, setHistTick] = useState(0);
  const focusGroups = useMemo(() => groupFocusHistory(), [histTick]);
  // 今日页一句话播报点了「＋关注」：同页签实时刷新
  useEffect(() => {
    const bump = () => setHistTick((t) => t + 1);
    window.addEventListener('gushenle:focus-changed', bump);
    return () => window.removeEventListener('gushenle:focus-changed', bump);
  }, []);
  // 持仓故事展开：一次只展开一只
  const [storySymbol, setStorySymbol] = useState<string | null>(null);
  // 持仓深入分析展开：一次只展开一只（与故事互斥）
  const [analysisSymbol, setAnalysisSymbol] = useState<string | null>(null);
  // 添加持仓表单的滚动锚点：点"添加持仓"后自动滚到表单并聚焦第一个字段（portfolio-1）
  const addFormRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!showAdd) return;
    const el = addFormRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 等滚动开始后再聚焦，避免 focus 把页面拽回去
    const t = setTimeout(() => {
      const first = el.querySelector('select, input') as HTMLElement | null;
      first?.focus({ preventScroll: true });
    }, 350);
    return () => clearTimeout(t);
  }, [showAdd]);

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
  useEffect(() => {
    // 云端同步把本地数据换了（另一台设备改过）：持仓和资金一起重载
    const reload = () => {
      setPositions(loadPositions());
      setAccount(loadAccount());
    };
    window.addEventListener(SYNC_EVENT, reload);
    return () => window.removeEventListener(SYNC_EVENT, reload);
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
  const realized = account?.realized ?? 0;
  // 总盈亏 = 持仓浮动盈亏 + 已落袋的：股票涨了，总资产可以超过投入本金
  const totalPnl = totalValue - totalCost + realized;
  const totalPnlPct =
    account && account.capital > 0
      ? (totalPnl / account.capital) * 100
      : totalCost > 0
        ? (totalPnl / totalCost) * 100
        : 0;
  const totalDayPnlPct = totalValue - totalDayPnl > 0 ? (totalDayPnl / (totalValue - totalDayPnl)) * 100 : 0;

  // 现金 = 投入本金 − 持仓总成本 + 已实现盈亏：只随买卖变，不随涨跌变
  const cashValue = account ? account.capital - totalCost + realized : null;
  // 总资产 = 现金 + 持仓总市值：浮动，股票涨了可超本金
  const totalEquity = cashValue != null ? cashValue + totalValue : totalValue;
  // 仓位分母：设了账户就用总资产，没设回退到持仓总市值
  const weightDenom = account && account.capital > 0 ? totalEquity : totalValue;

  // 分股票盈亏明细：持仓中的（浮动+已实现）∪ 已清仓但有已实现盈亏的
  const pnlRows = useMemo(() => {
    const rows: {
      symbol: string;
      status: string;
      floating: number | null;
      floatingPct: number | null;
      realized: number | null;
      total: number;
    }[] = [];
    const seen = new Set<string>();
    positions.forEach((p) => {
      const sym = p.symbol.toUpperCase();
      seen.add(sym);
      const q = quotes[p.symbol];
      const floating = q ? (q.price - p.avgCost) * p.shares : null;
      const floatingPct = q && p.avgCost > 0 ? ((q.price - p.avgCost) / p.avgCost) * 100 : null;
      const realized = account?.realizedBySymbol?.[sym] ?? null;
      rows.push({
        symbol: sym,
        status: `${p.shares}${tx(lang, ' shares', '股')} · ${tx(lang, 'cost', '成本')} $${p.avgCost.toFixed(2)}`,
        floating,
        floatingPct,
        realized,
        total: (floating ?? 0) + (realized ?? 0),
      });
    });
    const bySym = account?.realizedBySymbol ?? {};
    Object.keys(bySym).forEach((sym) => {
      if (seen.has(sym)) return;
      rows.push({
        symbol: sym,
        status: tx(lang, 'Closed', '已清仓'),
        floating: null,
        floatingPct: null,
        realized: bySym[sym],
        total: bySym[sym],
      });
    });
    return rows;
  }, [positions, quotes, account, lang]);

  // 已实现盈亏里手动校准的部分（总数 − 分项加总），非零时在明细里单列一行
  const realizedAdjust =
    (account?.realized ?? 0) -
    Object.values(account?.realizedBySymbol ?? {}).reduce((s, v) => s + v, 0);

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
      pct: weightDenom > 0 ? (v / weightDenom) * 100 : 0,
      symbols: sectorSymbols[s] ?? [],
    }))
    .sort((a, b) => b.value - a.value);

  // 画像小结（只摆事实）
  const maxPos = positions
    .map((p) => ({ p, v: quotes[p.symbol] ? p.shares * (quotes[p.symbol] as RhythmResponse).price : 0 }))
    .sort((a, b) => b.v - a.v)[0];
  const maxPosPct = maxPos && weightDenom > 0 ? (maxPos.v / weightDenom) * 100 : 0;
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

  // 账户编辑：券商 + 投入本金 + 已实现盈亏；追加资金直接改大本金就行
  const openAccountEditor = () => {
    setAcctBrokerage(account?.brokerage ?? '');
    setAcctCapital(account ? String(account.capital) : '');
    setAcctRealized(account?.realized ? String(account.realized) : '');
    setAcctError('');
    setShowAccount(true);
  };
  const saveAccountEditor = () => {
    const b = acctBrokerage.trim();
    const c = Number(String(acctCapital).replace(/,/g, ''));
    if (!b) {
      setAcctError(tx(lang, 'Please enter your brokerage', '请填写券商'));
      return;
    }
    if (!(c > 0)) {
      setAcctError(tx(lang, 'Capital must be above 0', '投入本金填一个大于 0 的数字'));
      return;
    }
    const rRaw = String(acctRealized).replace(/,/g, '').trim();
    const r = rRaw === '' ? 0 : Number(rRaw);
    if (!Number.isFinite(r)) {
      setAcctError(tx(lang, 'Realized P&L must be a number', '已实现盈亏填个数字'));
      return;
    }
    const info: AccountInfo = {
      brokerage: b,
      capital: c,
      realized: Math.round(r * 100) / 100,
      updatedAt: todayStr(),
    };
    saveAccount(info);
    setAccount(info);
    setShowAccount(false);
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

      {/* 账户条：券商 + 投入本金 + 现金 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {account ? (
            <div className="text-xs min-w-0">
              <span className="text-slate-200 font-semibold">{account.brokerage}</span>
              <span className="text-slate-500">
                {' · '}
                {tx(lang, 'Initial capital', '投入本金')} $
                {account.capital.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                {cashValue != null && (
                  <>
                    {' · '}
                    {tx(lang, 'Cash', '现金')}{' '}
                    <span className={cashValue < 0 ? 'text-amber-400' : 'text-slate-300'}>
                      ${cashValue.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                    </span>
                  </>
                )}
              </span>
            </div>
          ) : (
            <div className="text-xs text-slate-500">
              {tx(lang, 'Set your brokerage & capital for true position weights', '设置券商和投入本金，才能看真实仓位占比')}
            </div>
          )}
          <button
            onClick={openAccountEditor}
            className="text-[11px] text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1 shrink-0 transition-colors"
          >
            {account ? tx(lang, 'Manage funds', '资金管理') : tx(lang, 'Set up', '设置')}
          </button>
        </div>
        {cashValue != null && cashValue < 0 && (
          <div className="text-[11px] text-amber-400/90 mt-1.5">
            {tx(lang, 'Cash shows negative — capital may be under-recorded; top it up in fund management.', '现金算出来是负的，可能是投入本金没录全，去资金管理里补一下。')}
          </div>
        )}
      </div>

      {showAccount && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-slate-200">{tx(lang, 'Trading account', '交易账户')}</div>
          <div>
            <label className="text-[11px] text-slate-400">{tx(lang, 'Brokerage', '券商')}</label>
            <input
              value={acctBrokerage}
              onChange={(e) => {
                setAcctBrokerage(e.target.value);
                setAcctError('');
              }}
              placeholder={tx(lang, 'e.g. Charles Schwab', '如 Charles Schwab')}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">
              {tx(lang, 'Initial capital $ (edit this number when you add funds)', '投入本金 $（以后追加资金，直接改大这个数）')}
            </label>
            <input
              value={acctCapital}
              onChange={(e) => {
                setAcctCapital(e.target.value);
                setAcctError('');
              }}
              inputMode="decimal"
              placeholder={tx(lang, 'e.g. 5000', '如 5000')}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">
              {tx(lang, 'Realized P&L $ (auto-tracked on sells; adjust if needed)', '已实现盈亏 $（卖出自动累计，可手动校准）')}
            </label>
            <input
              value={acctRealized}
              onChange={(e) => {
                setAcctRealized(e.target.value);
                setAcctError('');
              }}
              inputMode="decimal"
              placeholder="0"
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
          {acctError && <div className="text-[11px] text-rose-400">{acctError}</div>}
          <div className="flex gap-2">
            <button
              onClick={saveAccountEditor}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2 rounded-lg font-medium"
            >
              {tx(lang, 'Save', '保存')}
            </button>
            <button
              onClick={() => setShowAccount(false)}
              className="text-slate-500 hover:text-slate-300 text-xs px-3 py-2"
            >
              {tx(lang, 'Cancel', '取消')}
            </button>
          </div>
          <div className="text-[10px] text-slate-600">
            {tx(lang, 'Stored only on this phone, never uploaded.', '只在你手机里，不上传。')}
          </div>
        </div>
      )}

      {/* 汇总卡 */}
      {positions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">
              {tx(lang, 'Total equity', '总资产')}
              {pnlRows.length > 0 && (
                <button
                  onClick={() => setShowPnlDetail((v) => !v)}
                  className="ml-2 text-[10px] text-slate-500 underline underline-offset-2 hover:text-slate-300"
                >
                  {tx(lang, 'Details', '明细')} {showPnlDetail ? '▾' : '▸'}
                </button>
              )}
            </span>
            <span className="text-2xl font-extrabold text-slate-100">
              ${totalEquity.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
            </span>
          </div>
          {showPnlDetail && pnlRows.length > 0 && (
            <div className="mt-2 rounded-lg bg-slate-800/50 px-3 py-1">
              {pnlRows.map((r) => (
                <div key={r.symbol} className="py-2 border-b border-slate-800/60 last:border-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs font-bold text-slate-200">{r.symbol}</span>
                    <span className="text-[10px] text-slate-500">{r.status}</span>
                  </div>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-[10px] text-slate-500">{tx(lang, 'Floating', '浮动')}</div>
                      <div className={`text-[11px] font-semibold ${r.floating == null ? 'text-slate-600' : r.floating >= 0 ? upText(scheme) : downText(scheme)}`}>
                        {r.floating == null
                          ? '—'
                          : `${r.floating >= 0 ? '+' : ''}$${r.floating.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}${r.floatingPct != null ? ` (${r.floatingPct >= 0 ? '+' : ''}${r.floatingPct.toFixed(2)}%)` : ''}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">{tx(lang, 'Realized', '已实现')}</div>
                      <div className={`text-[11px] font-semibold ${r.realized == null ? 'text-slate-600' : r.realized >= 0 ? upText(scheme) : downText(scheme)}`}>
                        {r.realized == null
                          ? '—'
                          : `${r.realized >= 0 ? '+' : ''}$${r.realized.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-500">{tx(lang, 'Total', '合计')}</div>
                      <div className={`text-[11px] font-semibold ${r.total >= 0 ? upText(scheme) : downText(scheme)}`}>
                        {`${r.total >= 0 ? '+' : ''}$${r.total.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {Math.abs(realizedAdjust) >= 0.005 && (
                <div className="py-2 flex items-baseline justify-between text-[11px]">
                  <span className="text-slate-500">{tx(lang, 'Manual adjustment', '手动校准')}</span>
                  <span className={`font-semibold ${realizedAdjust >= 0 ? upText(scheme) : downText(scheme)}`}>
                    {`${realizedAdjust >= 0 ? '+' : ''}$${realizedAdjust.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`}
                  </span>
                </div>
              )}
            </div>
          )}
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-slate-400">{tx(lang, 'Positions value', '总市值')}</span>
            <span className="text-sm font-semibold text-slate-200">
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
            <div className="text-[10px] text-slate-600">
              {account
                ? tx(lang, 'Left: sector · right: % of total equity', '左：板块 · 右：占总资产')
                : tx(lang, 'Left: sector · right: % of value', '左：板块 · 右：市值占比')}
            </div>
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
          {cashValue != null && weightDenom > 0 && (
            <div className="text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 w-16 shrink-0">{tx(lang, 'Cash', '现金')}</span>
                <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500/60"
                    style={{ width: `${Math.min(100, Math.max(0, (cashValue / weightDenom) * 100))}%` }}
                  />
                </div>
                <span className="text-slate-300 w-12 text-right">
                  {((cashValue / weightDenom) * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          )}
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
                      setAnalysisSymbol((cur) => (cur === p.symbol ? null : p.symbol));
                      if (storySymbol === p.symbol) setStorySymbol(null);
                    }}
                    className={`p-0.5 ${analysisSymbol === p.symbol ? 'text-emerald-400' : 'text-slate-600 hover:text-emerald-400'}`}
                    title={analysisSymbol === p.symbol ? tx(lang, 'Hide holding analysis', '收起持仓分析') : tx(lang, 'Deep holding analysis', '持仓深入分析')}
                    aria-label={tx(lang, `${analysisSymbol === p.symbol ? 'Hide' : 'Show'} ${p.symbol} holding analysis`, `${analysisSymbol === p.symbol ? '收起' : '展开'} ${p.symbol} 持仓分析`)}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setStorySymbol((cur) => (cur === p.symbol ? null : p.symbol));
                      if (analysisSymbol === p.symbol) setAnalysisSymbol(null);
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
                    💡 {positionAdvice(lang, q.judgment.statusKey, pnlPct, q.judgment.score)}
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
              {analysisSymbol === p.symbol && (
                <HoldingAnalysis
                  position={p}
                  quote={q ?? null}
                  account={account}
                  pnl={pnl}
                  pnlPct={pnlPct}
                  price={price}
                  advice={q ? positionAdvice(lang, q.judgment.statusKey, pnlPct) : null}
                  onGoMemory={(s) => onGoMemory?.(s)}
                  onViewSymbol={onViewSymbol}
                />
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

      {/* 历史关注：以前「＋关注」过的股票，按周分组，本周在最上，点一只直接去看走势 */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-200">
            🕘 {tx(lang, 'Watch history', '历史关注')}
          </div>
          {focusGroups.length > 0 && (
            <button
              onClick={() => {
                if (confirm(tx(lang, 'Clear all watch history?', '清空全部关注历史？'))) {
                  clearFocusHistory();
                  setHistTick((t) => t + 1);
                }
              }}
              className="text-[10px] text-slate-600 hover:text-slate-400"
            >
              {tx(lang, 'Clear', '清空')}
            </button>
          )}
        </div>
        {focusGroups.length === 0 ? (
          <div className="text-[11px] text-slate-500 leading-relaxed">
            {tx(lang, `Nothing here yet. Tap "+ Follow" on a stock's daily brief on the Today tab and it'll be logged here by week.`, '还没有记录。在「今日」页的一句话播报里点「＋关注」，就会按周记在这里。')}
          </div>
        ) : (
          <div className="space-y-3">
            {focusGroups.map((g) => (
              <div key={g.week}>
                <div className="text-[10px] text-slate-500 mb-1.5">
                  {weekLabel(g.week, lang === 'en' ? 'en' : 'zh')}{' '}
                  <span className="text-slate-600">({g.items.length})</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {g.items.map((it) => (
                    <button
                      key={it.symbol}
                      onClick={() => onViewSymbol(it.symbol)}
                      className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full border border-slate-700"
                    >
                      {it.symbol}
                      <span className="ml-1 text-slate-500">{nameOf(it.symbol) !== it.symbol ? nameOf(it.symbol) : (it.name ?? '')}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <div ref={addFormRef} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 scroll-mt-4">
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
              <div className="text-[11px] text-slate-500">{tx(lang, 'Everything in your watchlist is already added — tap the “Watchlist” title on the Today tab to add more.', '自选里的股票都已加完，去今日页点「自选列表」标题可加更多。')}</div>
            )}
        </div>
      )}

      {/* 真实成本试算器 */}
      <CostCalculator />
    </div>
  );
}
