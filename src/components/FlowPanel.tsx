'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RhythmResponse } from '@/lib/rhythm';
import { getRhythm } from '@/lib/market';
import { estimateFlows, bucketizeFlows, flowUsage, type FlowResult, type FlowBucket } from '@/lib/flows';
import { fmtCompactMoney } from '@/lib/currency';

/**
 * 日线资金流向：每日资金 = 典型价 × 成交量，涨记流入、跌记流出。
 * 确定性估算，非逐笔大单数据。和筹码分布并排展示。
 * 解读口径（跟用户对齐）：看高低=谁更主动，看深浅=钱新不新，看配合=结合筹码分布。
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

  const buckets = useMemo(() => (result ? bucketizeFlows(result.days) : []), [result]);
  const totalIn = buckets.reduce((a, b) => a + b.inSum, 0);
  const totalOut = buckets.reduce((a, b) => a + b.outSum, 0);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-200">资金流向</span>
        <span className="text-[10px] font-normal text-slate-500">{symbol}</span>
        <span className="text-[10px] font-normal text-slate-500 border border-slate-700 rounded px-1">
          日线估算
        </span>
      </div>
      <p className="text-[10px] text-slate-500 mt-1 mb-2">20天里，买的人和卖的人谁更用力</p>

      {data == null ? (
        <p className="text-[10px] text-slate-500">资金计算中…</p>
      ) : result == null ? (
        <p className="text-[10px] text-slate-500">成交量数据不足。</p>
      ) : (
        <>
          <p className="text-[10px] text-slate-400 mb-1.5">
            近{result.daysCount}日累计{' '}
            <strong className={result.net >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {result.net >= 0 ? '+' : '−'}
              {fmtCompactMoney(symbol, Math.abs(result.net))}
            </strong>
          </p>

          {/* 手画稿：左右两根竖条，流入/流出，各按近5日·6-10日·11-20日分段 */}
          <FlowBars buckets={buckets} totalIn={totalIn} totalOut={totalOut} symbol={symbol} />
          <div className="mt-1.5 mb-1.5 text-[9px] text-slate-600 leading-relaxed">
            <div className="flex gap-2">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-600 inline-block" /> 近5日
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> 6-10日
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-emerald-400 inline-block" /> 11-20日
              </span>
            </div>
            <p>颜色越深，钱越新</p>
          </div>

          <p className="text-[10px] text-amber-200/90 leading-relaxed">💡 {result.verdict}</p>
          <p className="text-[10px] text-sky-200/90 leading-relaxed mt-1">
            👉 怎么用：{flowUsage(totalIn, totalOut)}
          </p>
          <p className="text-[9px] text-slate-600 mt-1">按日线估算，非逐笔大单数据，仅供参考。</p>
        </>
      )}
    </div>
  );
}

/** 手画稿：左右两根竖条（绿流入/红流出），各按时间段分段，段高=金额占比 */
function FlowBars({
  buckets,
  totalIn,
  totalOut,
  symbol,
}: {
  buckets: FlowBucket[];
  totalIn: number;
  totalOut: number;
  symbol: string;
}) {
  // 大软件习惯：绿=流入，红=流出
  const inColors = ['bg-emerald-600', 'bg-emerald-500', 'bg-emerald-400'];
  const outColors = ['bg-rose-600', 'bg-rose-500', 'bg-rose-400'];

  const bar = (isIn: boolean) => {
    const total = isIn ? totalIn : totalOut;
    const colors = isIn ? inColors : outColors;
    return (
      <div className="flex flex-col items-center">
        <div className="w-12 h-40 flex flex-col rounded-md overflow-hidden bg-slate-800/50">
          {buckets.map((s, i) => {
            const v = isIn ? s.inSum : s.outSum;
            const pct = total > 0 ? (v / total) * 100 : 0;
            if (pct <= 0) return null;
            return (
              <div
                key={s.label}
                className={`${colors[i]} flex items-center justify-center shrink-0`}
                style={{ height: `${pct}%` }}
                title={`${s.label} ${isIn ? '流入' : '流出'} ${fmtCompactMoney(symbol, v)}`}
              >
                {pct >= 16 && (
                  <span className="text-[9px] font-semibold text-white/95 tabular-nums">
                    {Math.round(pct)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <span className={`text-[10px] mt-1 font-medium ${isIn ? 'text-emerald-300' : 'text-rose-300'}`}>
          {isIn ? '流入' : '流出'}
        </span>
        <span className="text-[9px] text-slate-500 tabular-nums">
          {fmtCompactMoney(symbol, total)}
        </span>
      </div>
    );
  };

  return (
    <div className="flex justify-center gap-5" aria-hidden>
      {bar(true)}
      {bar(false)}
    </div>
  );
}
