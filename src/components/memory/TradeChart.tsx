// src/components/memory/TradeChart.tsx
// 定格二：把用户自己的买卖点打在这只股的真实价格线上；
// 每笔卖出之后 20 个交易日的真实走势用琥珀虚线续画——卖飞还是卖对，一眼定格。
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';
import type { OperationRecord } from '@/lib/operations';
import type { SeriesPoint } from '@/lib/box';

function fmtPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

interface SellFact {
  op: OperationRecord;
  fwd: number | null; // 卖出后 20 个交易日涨跌 %（不足 20 天为 null 并标注实际天数）
  days: number;
}

export default function TradeChart({ ops }: { ops: OperationRecord[] }) {
  const { lang } = useLanguage();
  const symbols = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of ops) counts.set(o.symbol, (counts.get(o.symbol) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [ops]);

  const [symbol, setSymbol] = useState<string>('');
  const [points, setPoints] = useState<SeriesPoint[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!symbol && symbols.length > 0) setSymbol(symbols[0]);
  }, [symbols, symbol]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setPoints(null);
    setFailed(false);
    fetch(`/api/box?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((j) => {
        if (!cancelled) setPoints(j.points ?? []);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const myOps = useMemo(
    () =>
      ops
        .filter((o) => o.symbol === symbol)
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
    [ops, symbol],
  );

  const view = useMemo(() => {
    if (!points || points.length === 0 || myOps.length === 0) return null;
    const idxOf = (date: string) => {
      const i = points.findIndex((p) => p.date >= date);
      return i === -1 ? points.length - 1 : i;
    };
    const firstIdx = Math.max(0, idxOf(myOps[0].date) - 15);
    const lastIdx = Math.min(points.length - 1, idxOf(myOps[myOps.length - 1].date) + 25);
    if (lastIdx - firstIdx < 10) return null;
    const slice = points.slice(firstIdx, lastIdx + 1);
    const sells: SellFact[] = [];
    for (const o of myOps) {
      if (o.action !== 'sell') continue;
      const i = idxOf(o.date);
      const j = Math.min(points.length - 1, i + 20);
      const days = j - i;
      const fwd =
        days > 0 && points[i].close > 0
          ? ((points[j].close - points[i].close) / points[i].close) * 100
          : null;
      sells.push({ op: o, fwd, days });
    }
    return { slice, firstIdx, idxOf, sells };
  }, [points, myOps]);

  if (symbols.length === 0) return null;

  const W = 340;
  const H = 170;
  let chart: React.ReactNode = null;
  if (view && points) {
    const { slice, firstIdx, idxOf } = view;
    const prices = slice.map((p) => p.close);
    for (const o of myOps) prices.push(o.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = (max - min) * 0.08 || 1;
    const x = (gi: number) => ((gi - firstIdx) / (slice.length - 1)) * (W - 10) + 5;
    const y = (v: number) => H - 14 - ((v - (min - pad)) / (max - min + 2 * pad)) * (H - 26);
    const linePts = slice.map((p, i) => `${x(firstIdx + i)},${y(p.close)}`).join(' ');
    chart = (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
        <polyline points={linePts} fill="none" stroke="#38bdf8" strokeWidth="1.6" />
        {/* 卖出后 20 天：琥珀虚线续画 */}
        {myOps
          .filter((o) => o.action === 'sell')
          .map((o) => {
            const i = idxOf(o.date);
            const j = Math.min(points.length - 1, i + 20);
            if (j <= i) return null;
            const seg = points
              .slice(i, j + 1)
              .map((p, k) => `${x(i + k)},${y(p.close)}`)
              .join(' ');
            return (
              <polyline
                key={`fwd-${o.id}`}
                points={seg}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="1.6"
                strokeDasharray="4 3"
              />
            );
          })}
        {/* 买卖点 */}
        {myOps.map((o) => {
          const i = idxOf(o.date);
          const cx = x(i);
          const cy = y(o.price);
          if (o.action === 'buy') {
            return (
              <polygon
                key={o.id}
                points={`${cx},${cy - 6} ${cx - 5},${cy + 3} ${cx + 5},${cy + 3}`}
                fill="#34d399"
                stroke="#0f172a"
                strokeWidth="0.8"
              />
            );
          }
          return (
            <polygon
              key={o.id}
              points={`${cx},${cy + 6} ${cx - 5},${cy - 3} ${cx + 5},${cy - 3}`}
              fill="#fb7185"
              stroke="#0f172a"
              strokeWidth="0.8"
            />
          );
        })}
        <text x={5} y={H - 2} fontSize="8" fill="#64748b">
          {slice[0].date}
        </text>
        <text x={W - 5} y={H - 2} fontSize="8" fill="#64748b" textAnchor="end">
          {slice[slice.length - 1].date}
        </text>
      </svg>
    );
  }

  return (
    <div className="bg-slate-800/60 rounded-lg p-3 mt-2">
      <div className="text-xs text-slate-400 mb-1">
        {tx(lang, '🎞️ Freeze-frame II — your trades on the price line', '🎞️ 定格二 · 买卖点打在价格线上')}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {symbols.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`px-2 py-0.5 rounded text-[11px] border ${
              s === symbol
                ? 'border-sky-500/60 text-sky-300 bg-sky-500/10'
                : 'border-slate-700 text-slate-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {failed ? (
        <div className="text-[11px] text-slate-500">{tx(lang, 'No price history for this one.', '这只股暂时拉不到行情。')}</div>
      ) : !points || !view ? (
        <div className="text-[11px] text-slate-500 py-6 text-center">{tx(lang, 'Loading the price line…', '正在拉价格线…')}</div>
      ) : (
        <>
          {chart}
          <div className="flex gap-3 text-[10px] text-slate-500 mt-1">
            <span>{tx(lang, '▲ buy', '▲ 买入')}</span>
            <span>{tx(lang, '▼ sell', '▼ 卖出')}</span>
            <span className="text-amber-400/90">{tx(lang, '- - the 20 trading days after each sell', '- - 卖出后 20 个交易日的真实走势')}</span>
          </div>
          {view.sells.length > 0 && (
            <div className="mt-2 space-y-1">
              {view.sells.map(({ op, fwd, days }) => (
                <div key={op.id} className="text-[11px] text-slate-400 leading-relaxed">
                  {tx(
                    lang,
                    `${op.date} sold @ $${op.price}${fwd != null ? ` → next ${days} trading days ${fmtPct(fwd)}` : ''}`,
                    `${op.date} 卖出 @ $${op.price}${fwd != null ? ` → 之后 ${days} 个交易日 ${fmtPct(fwd)}` : ''}`,
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
