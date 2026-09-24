// src/components/portfolio/StockStory.tsx
// 我的持仓故事：这只股票的操作流水 + 专属卖飞/买高 + 每笔买入当天的律动快照。
// 快照是客户端用全量日线无未来函数回算的（scoreAt），不是事后诸葛亮。
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  scoreAt, volatilityAt, thresholdsFor, judgeFromScore, STATUS_LABELS,
  type RhythmPoint, type RhythmResponse,
} from '@/lib/rhythm';
import { loadOperations, type OperationRecord } from '@/lib/operations';
import { computePortrait, PORTRAIT_MIN_SAMPLE } from '@/lib/portrait';
import { fmtMoney } from '@/lib/currency';

interface Review { r5: number | null; r20: number | null }

interface Snapshot {
  score: number;
  statusKey: string;
  status: string;
}

/** 回算某只股票在 dateStr（YYYY-MM-DD）当天的律动判断；数据不足或模拟数据返回 null */
export function judgmentAt(
  series: RhythmPoint[] | undefined,
  dateStr: string,
  simulated: boolean,
): Snapshot | null {
  if (!series || series.length === 0 || simulated) return null;
  let idx = -1;
  for (let i = 0; i < series.length; i++) {
    if (series[i].date <= dateStr) idx = i;
    else break; // series 按日期升序
  }
  if (idx < 0) return null;
  const closes = series.slice(0, idx + 1).map((p) => p.close);
  const s = scoreAt(closes, closes.length - 1);
  if (!s) return null;
  const th = thresholdsFor(volatilityAt(closes, closes.length - 1));
  const j = judgeFromScore(s.score, s.trend, s.vel, th);
  return { score: s.score, statusKey: j.statusKey, status: STATUS_LABELS[j.statusKey] };
}

function fmtDay(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? `${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日` : d;
}

export default function StockStory({
  symbol,
  quote,
}: {
  symbol: string;
  quote: RhythmResponse | null;
}) {
  const ops = useMemo(
    () => loadOperations().filter((o) => o.symbol === symbol).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [symbol],
  );
  const [reviews, setReviews] = useState<Record<string, Review>>({});

  useEffect(() => {
    ops.forEach((op) => {
      if (reviews[op.id] !== undefined) return;
      setReviews((prev) => ({ ...prev, [op.id]: { r5: null, r20: null } }));
      fetch(`/api/forward-return?symbol=${encodeURIComponent(op.symbol)}&date=${op.date}`)
        .then((r) => r.json())
        .then((j) => {
          setReviews((prev) => ({ ...prev, [op.id]: { r5: j.r5 ?? null, r20: j.r20 ?? null } }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  const p = useMemo(() => computePortrait(ops, reviews), [ops, reviews]);
  const simulated = quote?.source === 'simulated';

  const snapshots = useMemo(() => {
    const map: Record<string, Snapshot | null> = {};
    for (const op of ops) {
      if (op.action === 'buy') map[op.id] = judgmentAt(quote?.series, op.date, !!simulated);
    }
    return map;
  }, [ops, quote, simulated]);

  if (ops.length === 0) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-700/60 text-[11px] text-slate-500">
        📖 这只还没有操作记录，去记忆页记一笔，故事就从这里开始。
      </div>
    );
  }

  const bits: string[] = [];
  if (p.sell.total >= PORTRAIT_MIN_SAMPLE && p.sell.bad > 0) bits.push(`卖飞过 ${p.sell.bad} 次`);
  if (p.buy.total >= PORTRAIT_MIN_SAMPLE && p.buy.bad > 0) bits.push(`买高过 ${p.buy.bad} 次`);

  return (
    <div className="mt-3 pt-3 border-t border-slate-700/60 space-y-2.5" onClick={(e) => e.stopPropagation()}>
      <div className="text-[11px] font-semibold text-slate-300">📖 我的持仓故事</div>

      {/* 操作流水：买入带当天律动快照 */}
      <div className="space-y-1.5">
        {ops.slice(0, 6).map((op: OperationRecord) => {
          const snap = op.action === 'buy' ? snapshots[op.id] : undefined;
          const hot = snap?.statusKey === 'overheated';
          return (
            <div key={op.id} className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-slate-500">{fmtDay(op.date)}</span>{' '}
              <span className={op.action === 'buy' ? 'text-emerald-400' : 'text-amber-400'}>
                {op.action === 'buy' ? '买入' : '卖出'}
              </span>{' '}
              {op.qty ? `${op.qty}股` : ''} {op.price ? `@ ${fmtMoney(symbol, op.price)}` : ''}
              {snap && (
                <span className={hot ? 'text-sky-300' : 'text-slate-500'}>
                  {' '}· 当时{snap.status}（{snap.score}分）{hot ? ' 🧊' : ''}
                </span>
              )}
              {op.action === 'buy' && !snap && !simulated && (
                <span className="text-slate-600"> · 当时数据不足</span>
              )}
            </div>
          );
        })}
        {ops.length > 6 && (
          <div className="text-[10px] text-slate-600">还有 {ops.length - 6} 笔，去记忆页看完整流水</div>
        )}
      </div>

      {/* 专属胜率：只摆事实 */}
      {bits.length > 0 ? (
        <div className="text-[11px] text-amber-300/90">
          🪞 在 {symbol} 上：{bits.join('，')}
          {p.sell.worst && p.sell.bad > 0 && (
            <span className="text-slate-500">
              {' '}· 最可惜 {fmtDay(p.sell.worst.op.date)}那笔，之后涨了 {p.sell.worst.pct.toFixed(1)}%
            </span>
          )}
          {p.buy.worst && p.buy.bad > 0 && (
            <span className="text-slate-500">
              {' '}· 最惨 {fmtDay(p.buy.worst.op.date)}那笔，之后跌了 {Math.abs(p.buy.worst.pct).toFixed(1)}%
            </span>
          )}
        </div>
      ) : (
        <div className="text-[10px] text-slate-600">
          在 {symbol} 上的专属复盘养成中（{Math.max(p.sell.total, p.buy.total)}/{PORTRAIT_MIN_SAMPLE} 笔有结果）
        </div>
      )}
      {simulated && (
        <div className="text-[10px] text-slate-600">⚠️ 该股暂无真实行情，快照与复盘仅供参考</div>
      )}
    </div>
  );
}
