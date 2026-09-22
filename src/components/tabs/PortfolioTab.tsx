'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Plus, X, RefreshCw, Briefcase, GripVertical } from 'lucide-react';
import { useWatchlist } from '@/components/WatchlistContext';
import { loadPositions, savePositions, holdingDays, sectorOf, type Position } from '@/lib/positions';
import { getRhythm, invalidateRhythm, dayChangePct } from '@/lib/market';
import type { RhythmResponse } from '@/lib/rhythm';

/**
 * 持仓页：账户视角——我持有多少、成本、盈亏。
 * 行情走全 app 共享缓存（与今日页同源），诊断只给入口（点行跳今日看），不重复做。
 */

/** 持仓诊断一句话：律动状态 × 浮盈亏 → 大白话，不批评 */
function positionAdvice(statusKey: string | undefined, pnlPct: number | null): string {
  const p = pnlPct;
  switch (statusKey) {
    case 'overheated':
      return p != null && p > 0 ? `涨太猛了，浮盈 ${p.toFixed(1)}%，分批落袋？` : '涨太猛了，先冷静，别追';
    case 'hotStrong':
      return '高位强势，拿着，止盈位设好';
    case 'weakLow':
      return p != null && p < 0
        ? `还在往下跌，浮亏 ${Math.abs(p).toFixed(1)}%，别急着补`
        : '还在往下跌，先别加仓';
    case 'oversoldBottom':
      return p != null && p < 0
        ? `跌过头了，浮亏 ${Math.abs(p).toFixed(1)}%，拿住等反弹？`
        : '跌过头了，拿住等反弹？';
    case 'risingAccel':
      return '涨势加速，拿着';
    case 'bottomUp':
      return '跌不动了，拿着等方向';
    default:
      return '横盘波动，拿着等方向';
  }
}
export default function PortfolioTab({ onViewSymbol }: { onViewSymbol: (symbol: string) => void }) {
  const { items: watchlist, nameOf } = useWatchlist();
  const [positions, setPositions] = useState<Position[]>([]);
  const [quotes, setQuotes] = useState<Record<string, RhythmResponse | null>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addSymbol, setAddSymbol] = useState('');
  const [addShares, setAddShares] = useState('');
  const [addCost, setAddCost] = useState('');
  const [addSince, setAddSince] = useState('');
  const [addError, setAddError] = useState('');

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
  const totalPnl = totalValue - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
  const totalDayPnlPct = totalValue - totalDayPnl > 0 ? (totalDayPnl / (totalValue - totalDayPnl)) * 100 : 0;

  // 板块分布（按市值）
  const sectorValue: Record<string, number> = {};
  positions.forEach((p) => {
    const q = quotes[p.symbol];
    if (!q) return;
    const s = sectorOf(p.symbol);
    sectorValue[s] = (sectorValue[s] ?? 0) + p.shares * q.price;
  });
  const sectorRows = Object.entries(sectorValue)
    .map(([s, v]) => ({ sector: s, value: v, pct: totalValue > 0 ? (v / totalValue) * 100 : 0 }))
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
      setAddError('请选择一只自选股');
      return;
    }
    if (positions.some((p) => p.symbol === addSymbol)) {
      setAddError('这只已在持仓里');
      return;
    }
    if (!Number.isFinite(shares) || shares <= 0) {
      setAddError('股数填一个大于 0 的数字');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0) {
      setAddError('成本价填一个不小于 0 的数字');
      return;
    }
    if (addSince && !/^\d{4}-\d{2}-\d{2}$/.test(addSince)) {
      setAddError('建仓日期格式不对');
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

  const candidates = watchlist.filter((w) => !positions.some((p) => p.symbol === w.symbol));

  return (
    <div className="p-4 space-y-5 pb-24 max-w-md mx-auto">
      <header className="pt-2 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">持仓 Portfolio</h1>
          <p className="text-xs text-slate-400 mt-0.5">手动记录持仓，行情与今日页同源</p>
        </div>
        <button
          onClick={() => fetchQuotes(positions, true)}
          disabled={refreshing || positions.length === 0}
          className="text-xs text-slate-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800 disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </header>

      {/* 汇总卡 */}
      {positions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-slate-400">总市值</span>
            <span className="text-2xl font-extrabold text-slate-100">
              ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-slate-400">总盈亏</span>
            <span
              className={`text-sm font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {totalPnl >= 0 ? '+' : ''}$
              {totalPnl.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}{' '}
              ({totalPnl >= 0 ? '+' : ''}
              {totalPnlPct.toFixed(2)}%)
            </span>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-xs text-slate-400">今日盈亏</span>
            <span
              className={`text-sm font-bold ${totalDayPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
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
          <div className="text-xs font-semibold text-slate-200">板块分布</div>
          {sectorRows.map((r) => (
            <div key={r.sector} className="flex items-center gap-2 text-xs">
              <span className="text-slate-400 w-16 shrink-0">{r.sector}</span>
              <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500/70"
                  style={{ width: `${Math.min(100, r.pct)}%` }}
                />
              </div>
              <span className="text-slate-300 w-12 text-right">{r.pct.toFixed(0)}%</span>
            </div>
          ))}
          <div className="pt-1 text-[11px] text-slate-500 leading-relaxed">
            {maxPos && maxPosPct > 0 && (
              <span>
                最大持仓 {maxPos.p.symbol} 占 {maxPosPct.toFixed(0)}%
                {maxPosPct >= 40 ? '（比较集中）' : '；'}
              </span>
            )}
            {avgHoldDays != null && <span>平均持有 {avgHoldDays} 天；</span>}
            <span>
              共 {positions.length} 只{holdDaysList.length < positions.length ? '（部分缺建仓日期）' : ''}
            </span>
          </div>
        </div>
      )}

      {/* 持仓列表（可拖动手柄排序，顺序自动保存） */}
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
                    aria-label={`拖动排序 ${p.symbol}`}
                  >
                    <GripVertical className="w-4 h-4" />
                  </button>
                  <span className="font-bold text-slate-100 text-base">{p.symbol}</span>
                  <span className="text-xs text-slate-400">{nameOf(p.symbol)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      persist(positions.filter((x) => x.symbol !== p.symbol));
                    }}
                    className="text-slate-600 hover:text-rose-400 p-0.5"
                    aria-label={`删除 ${p.symbol} 持仓`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="text-right">
                  {price != null ? (
                    <>
                      <div className="text-slate-200 font-semibold text-sm">${price.toFixed(2)}</div>
                      {dayChg != null && (
                        <div className={`text-[11px] ${dayChg >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {dayChg >= 0 ? '+' : ''}
                          {dayChg}% 今日
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-slate-500">行情加载中…</div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {p.shares} 股 · 成本 ${p.avgCost.toFixed(2)}
                  {(() => {
                    const d = holdingDays(p.since);
                    return d != null ? (
                      <span className="text-slate-500"> · 持有 {d} 天</span>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          const v = prompt('建仓日期（YYYY-MM-DD），例如 2026-06-01');
                          if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
                            persist(positions.map((x) => (x.symbol === p.symbol ? { ...x, since: v } : x)));
                          } else if (v) {
                            alert('日期格式不对');
                          }
                        }}
                        className="text-blue-400/80 hover:text-blue-300 ml-1 underline underline-offset-2"
                      >
                        补建仓日
                      </button>
                    );
                  })()}
                </span>
                {pnl != null && pnlPct != null ? (
                  <span className={`font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnl >= 0 ? '+' : ''}
                    {pnlPct.toFixed(2)}%)
                  </span>
                ) : (
                  <span className="text-slate-600">—</span>
                )}
              </div>
              {q && (
                <div className="mt-2 space-y-1">
                  <div className="text-[11px] text-amber-300/90">
                    💡 {positionAdvice(q.judgment.statusKey, pnlPct)}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    律动分 <span className="font-bold text-slate-300">{q.judgment.score}</span> ·{' '}
                    {q.judgment.status} → 点击去今日看诊断
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {positions.length === 0 && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <Briefcase className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm text-slate-400">还没有记录持仓</p>
            <button
              onClick={() => setShowAdd(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded-xl"
            >
              添加第一笔持仓
            </button>
          </div>
        )}
      </div>

      {/* 添加持仓 */}
      {positions.length > 0 && !showAdd && (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full border border-dashed border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 rounded-xl py-2.5 text-xs flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> 添加持仓
        </button>
      )}

      {showAdd && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-slate-200">添加持仓</div>
          <div>
            <label className="text-[11px] text-slate-400">股票（从自选里选）</label>
            <select
              value={addSymbol}
              onChange={(e) => {
                setAddSymbol(e.target.value);
                setAddError('');
              }}
              className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
            >
              <option value="">请选择…</option>
              {candidates.map((c) => (
                <option key={c.symbol} value={c.symbol}>
                  {c.symbol} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-400">股数</label>
              <input
                value={addShares}
                onChange={(e) => setAddShares(e.target.value)}
                inputMode="decimal"
                placeholder="如 100"
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-400">成本价 $</label>
              <input
                value={addCost}
                onChange={(e) => setAddCost(e.target.value)}
                inputMode="decimal"
                placeholder="如 150.00"
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">建仓日期（可选，用于算持有天数）</label>
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
              取消
            </button>
            <button
              onClick={handleAdd}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-xl text-xs font-medium"
            >
              保存
            </button>
          </div>
          {candidates.length === 0 && (
            <div className="text-[11px] text-slate-500">自选里的股票都已加完，去今日页「管理自选」可加更多。</div>
          )}
        </div>
      )}
    </div>
  );
}
