'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RhythmResponse } from '@/lib/rhythm';
import { getRhythm } from '@/lib/market';
import { estimateFlows, bucketizeFlows, flowUsage, type FlowResult, type FlowBucket } from '@/lib/flows';
import { fmtCompactMoney } from '@/lib/currency';

/**
 * 日线资金流向：每日资金 = 典型价 × 成交量，涨记流入、跌记流出。
 * 确定性估算，非逐笔大单数据。和筹码分布并排展示。
 * 解读口径（跟用户对齐）：环形图红绿总和=100%，一眼看买卖对比；
 * 看占比=谁更主动，看深浅=钱新不新，看配合=结合筹码分布。
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

          {/* 环形图：红绿总和=100%，一眼看出买/卖谁更用力；段内深浅=钱新不新 */}
          <FlowDonut
            buckets={buckets}
            totalIn={totalIn}
            totalOut={totalOut}
            net={result.net}
            symbol={symbol}
          />
          <div className="mt-1.5 mb-1.5 text-[9px] text-slate-600 leading-relaxed">
            <p>颜色越深，钱越新（近5日最深）</p>
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

/**
 * 环形图：流入（绿）+ 流出（红）= 100%，一眼看出买卖对比。
 * 每侧按 近5日 / 6-10日 / 11-20日 分段，颜色越深钱越新。
 * 大软件习惯：绿=流入，红=流出。
 */
function FlowDonut({
  buckets,
  totalIn,
  totalOut,
  net,
  symbol,
}: {
  buckets: FlowBucket[];
  totalIn: number;
  totalOut: number;
  net: number;
  symbol: string;
}) {
  const grand = totalIn + totalOut;
  const R = 70;
  const C = 2 * Math.PI * R;
  const segs = [
    { label: '近5日流入', short: '近5日', v: buckets[0]?.inSum ?? 0, color: '#059669' },
    { label: '6-10日流入', short: '6-10日', v: buckets[1]?.inSum ?? 0, color: '#10b981' },
    { label: '11-20日流入', short: '11-20日', v: buckets[2]?.inSum ?? 0, color: '#34d399' },
    { label: '近5日流出', short: '近5日', v: buckets[0]?.outSum ?? 0, color: '#e11d48' },
    { label: '6-10日流出', short: '6-10日', v: buckets[1]?.outSum ?? 0, color: '#f43f5e' },
    { label: '11-20日流出', short: '11-20日', v: buckets[2]?.outSum ?? 0, color: '#fb7185' },
  ];
  let acc = 0;
  const arcs = segs.map((s) => {
    const frac = grand > 0 ? s.v / grand : 0;
    const a = { ...s, frac, start: acc };
    acc += frac;
    return a;
  });
  const inPct = grand > 0 ? Math.round((totalIn / grand) * 100) : 0;
  const outPct = grand > 0 ? Math.round((totalOut / grand) * 100) : 0;

  return (
    <div>
      <div className="flex justify-center">
        <svg viewBox="0 0 180 180" className="w-44 h-44" role="img" aria-label="资金流向环形图">
          {arcs.map((a, i) =>
            a.frac <= 0 ? null : (
              <circle
                key={i}
                cx="90"
                cy="90"
                r={R}
                fill="none"
                stroke={a.color}
                strokeWidth="26"
                strokeDasharray={`${Math.max(0, a.frac * C - 2)} ${C}`}
                strokeDashoffset={-a.start * C}
                transform="rotate(-90 90 90)"
              >
                <title>{`${a.label} ${Math.round(a.frac * 100)}% · ${fmtCompactMoney(symbol, a.v)}`}</title>
              </circle>
            ),
          )}
          {/* 段内百分比：太小的段不标，图例里有全量 */}
          {arcs.map((a, i) => {
            if (a.frac < 0.07) return null;
            const mid = (a.start + a.frac / 2) * 2 * Math.PI - Math.PI / 2;
            return (
              <text
                key={`t${i}`}
                x={90 + R * Math.cos(mid)}
                y={90 + R * Math.sin(mid)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="10"
                fontWeight="700"
                fill="#ffffff"
              >
                {Math.round(a.frac * 100)}%
              </text>
            );
          })}
          <text x="90" y="82" textAnchor="middle" fontSize="11" fill="#94a3b8">
            {net >= 0 ? '净流入' : '净流出'}
          </text>
          <text
            x="90"
            y="100"
            textAnchor="middle"
            fontSize="14"
            fontWeight="800"
            fill={net >= 0 ? '#6ee7b7' : '#fda4af'}
          >
            {fmtCompactMoney(symbol, Math.abs(net))}
          </text>
        </svg>
      </div>

      {/* 流入 vs 流出：金额 + 占总和比例 */}
      <div className="flex justify-center gap-6 mt-1 text-[11px]">
        <span className="tabular-nums">
          <span className="text-emerald-400 font-medium">流入</span>{' '}
          <span className="text-slate-200 font-semibold">{fmtCompactMoney(symbol, totalIn)}</span>{' '}
          <span className="text-slate-500">{inPct}%</span>
        </span>
        <span className="tabular-nums">
          <span className="text-rose-400 font-medium">流出</span>{' '}
          <span className="text-slate-200 font-semibold">{fmtCompactMoney(symbol, totalOut)}</span>{' '}
          <span className="text-slate-500">{outPct}%</span>
        </span>
      </div>

      {/* 六段图例：每段金额占比（相对红绿总和），小段也不省略 */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5 text-[9px] text-slate-500 tabular-nums">
        {arcs.slice(0, 3).map((a, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: a.color }} />
            {a.short}流入 {Math.round(a.frac * 100)}%
          </span>
        ))}
        {arcs.slice(3).map((a, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-sm inline-block" style={{ background: a.color }} />
            {a.short}流出 {Math.round(a.frac * 100)}%
          </span>
        ))}
      </div>
    </div>
  );
}
