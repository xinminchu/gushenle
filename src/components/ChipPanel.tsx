'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RhythmResponse } from '@/lib/rhythm';
import { getRhythm } from '@/lib/market';
import { estimateChips } from '@/lib/chips';
import { fmtMoney } from '@/lib/currency';

/**
 * 筹码分布：按近约1年日线估算的持仓成本分布（非交易所数据）。
 * 自己拉 ALL 全量数据（走势卡的 series 是按区间切片的，不够用），
 * 走 lib/market 共享缓存，不会多发重复请求。
 * 放在价格走势卡正下方，手机上全宽展示。
 */
export default function ChipPanel({ symbol, compact = false }: { symbol: string; compact?: boolean }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<RhythmResponse | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    getRhythm(symbol, 'ALL')
      .then((d) => {
        if (alive) setData(d);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [symbol]);

  const result = useMemo(
    () => (data ? estimateChips(data.series, data.price, symbol) : null),
    [data, symbol],
  );

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl ${compact ? 'p-3' : 'p-4'}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between"
      >
        <span className={`flex items-center gap-1.5 font-semibold text-slate-200 ${compact ? 'text-xs' : 'text-sm'}`}>
          筹码分布
          <span className="text-[10px] font-normal text-slate-500">{symbol}</span>
          <span className="text-[10px] font-normal text-slate-500 border border-slate-700 rounded px-1">
            估算
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-2.5">
          {data == null ? (
            <p className="text-[10px] text-slate-500">筹码计算中…</p>
          ) : result == null ? (
            <p className="text-[10px] text-slate-500">成交量数据不足，暂无筹码分布。</p>
          ) : (
            <>
              <div className={`flex flex-wrap gap-x-3 gap-y-1 text-slate-400 mb-2.5 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
                <span>
                  获利盘 <strong className="text-emerald-400">{Math.round(result.profitRatio * 100)}%</strong>
                </span>
                <span>
                  平均成本 <strong className="text-slate-200">{fmtMoney(symbol, result.avgCost)}</strong>
                </span>
                {!compact && (
                  <span>
                    70%筹码{' '}
                    <strong className="text-slate-200">
                      {fmtMoney(symbol, result.conc70[0])}–{fmtMoney(symbol, result.conc70[1])}
                    </strong>
                  </span>
                )}
              </div>

              {/* 迷你分布条：上高下低，绿=现价以下(获利) 红=现价以上(套牢) */}
              <div className="space-y-[2px]" aria-hidden>
                {aggregateRows(result.bins.map((b) => ({ price: b.price, pct: b.pct })), compact ? 14 : 22).map((r, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <span className={`text-slate-600 text-right shrink-0 tabular-nums ${compact ? 'text-[8px] w-10' : 'text-[9px] w-12'}`}>
                      {fmtMoney(symbol, r.price)}
                    </span>
                    <div className={`flex-1 bg-slate-800/60 rounded-sm overflow-hidden ${compact ? 'h-[6px]' : 'h-[7px]'}`}>
                      <div
                        className={`h-full rounded-sm ${r.price < data.price ? 'bg-emerald-500/70' : 'bg-rose-500/70'}`}
                        style={{ width: `${Math.max(1, r.pct * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {!compact && (
                <div className="flex gap-3 text-[10px] text-slate-600 mt-1.5 mb-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" /> 现价以下 · 获利盘
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-sm bg-rose-500/70 inline-block" /> 现价以上 · 套牢盘
                  </span>
                </div>
              )}

              <p className={`text-amber-200/90 leading-relaxed ${compact ? 'text-[10px] mt-1.5' : 'text-[11px]'}`}>💡 {result.verdict}</p>
              {!compact && (
                <p className="text-[10px] text-slate-600 mt-1.5">
                  按近约{result.days}个交易日日线估算，非交易所数据，仅供参考。
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** bin 聚合成 N 行展示（相对比例归一化到行内最大值） */
function aggregateRows(bins: { price: number; pct: number }[], rowCount = 22) {
  const ROWS = rowCount;
  const per = Math.ceil(bins.length / ROWS);
  const rows: { price: number; pct: number }[] = [];
  for (let i = bins.length - 1; i >= 0; i -= per) {
    const slice = bins.slice(Math.max(0, i - per + 1), i + 1);
    const pct = slice.reduce((a, b) => a + b.pct, 0);
    const mid = slice[Math.floor(slice.length / 2)];
    rows.push({ price: mid.price, pct });
  }
  const max = Math.max(...rows.map((r) => r.pct), 1e-9);
  return rows.map((r) => ({ ...r, pct: r.pct / max }));
}
