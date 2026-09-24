'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RhythmResponse } from '@/lib/rhythm';
import { getRhythm } from '@/lib/market';
import { estimateFlows } from '@/lib/flows';
import { fmtCompactMoney } from '@/lib/currency';

/**
 * 日线资金流向：每日资金 = 典型价 × 成交量，涨记流入、跌记流出。
 * 确定性估算，非逐笔大单数据。和筹码分布并排展示。
 */
export default function FlowPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<RhythmResponse | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    getRhythm(symbol, '3M')
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [symbol]);

  const result = useMemo(
    () => (data ? estimateFlows(data.series, symbol) : null),
    [data, symbol],
  );

  const maxAbs = useMemo(() => {
    if (!result) return 1;
    return Math.max(...result.days.map((d) => Math.abs(d.flow)), 1e-9);
  }, [result]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-xs font-semibold text-slate-200">资金流向</span>
        <span className="text-[10px] font-normal text-slate-500 border border-slate-700 rounded px-1">
          日线估算
        </span>
      </div>

      {data == null ? (
        <p className="text-[10px] text-slate-500">资金计算中…</p>
      ) : result == null ? (
        <p className="text-[10px] text-slate-500">成交量数据不足。</p>
      ) : (
        <>
          <p className="text-[10px] text-slate-400 mb-1.5">
            近{result.daysCount}日累计{' '}
            <strong className={result.net >= 0 ? 'text-rose-300' : 'text-emerald-300'}>
              {result.net >= 0 ? '+' : '−'}
              {fmtCompactMoney(symbol, Math.abs(result.net))}
            </strong>
          </p>

          {/* 发散柱状：中线为界，红上=流入 绿下=流出，颜色深浅看金额大小 */}
          <div className="relative h-24" aria-hidden>
            <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-700/60" />
            <div className="absolute inset-0 flex gap-[2px]">
              {result.days.map((d, i) => {
                const pct = Math.max(4, (Math.abs(d.flow) / maxAbs) * 100);
                const alpha = 0.35 + 0.65 * (Math.abs(d.flow) / maxAbs);
                const inflow = d.flow > 0;
                return (
                  <div key={i} className="flex-1 flex flex-col" title={`${d.date} ${fmtCompactMoney(symbol, d.flow)}`}>
                    <div className="flex-1 flex items-end justify-center">
                      {inflow && (
                        <div
                          className="w-full rounded-t-sm bg-rose-500"
                          style={{ height: `${pct}%`, opacity: alpha }}
                        />
                      )}
                    </div>
                    <div className="flex-1 flex items-start justify-center">
                      {!inflow && d.flow < 0 && (
                        <div
                          className="w-full rounded-b-sm bg-emerald-500"
                          style={{ height: `${pct}%`, opacity: alpha }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2.5 text-[9px] text-slate-600 mt-1 mb-1.5">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" /> 流入
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> 流出
            </span>
          </div>

          <p className="text-[10px] text-amber-200/90 leading-relaxed">💡 {result.verdict}</p>
          <p className="text-[9px] text-slate-600 mt-1">按日线估算，非逐笔大单数据，仅供参考。</p>
        </>
      )}
    </div>
  );
}
