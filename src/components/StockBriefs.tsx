// 一句话播报：每只自选股每天一句 —— 异动 + 位置 + 律动 + 行动提示。
// 全确定性逻辑，只讲事实和纪律，不预测涨跌。点一行跳到那只股票。

'use client';

import { buildBrief } from '@/lib/brief';
import type { RhythmResponse } from '@/lib/rhythm';

interface StockBriefsProps {
  symbols: string[];
  nameOf: (symbol: string) => string;
  /** useWatchlistData 拿到的 1Y 数据（symbol -> 响应） */
  dataMap: Record<string, RhythmResponse>;
  loading: boolean;
  onPick: (symbol: string) => void;
}

export default function StockBriefs({ symbols, nameOf, dataMap, loading, onPick }: StockBriefsProps) {
  const rows = symbols
    .map((sym) => {
      const d = dataMap[sym];
      if (!d) return null;
      const brief = buildBrief(sym, nameOf(sym), d);
      return brief ? { sym, brief } : null;
    })
    .filter((r): r is { sym: string; brief: string } => r !== null);

  // 数据还没回来、且一行都拼不出来时，整个卡片先不露面（模拟数据兜底的股票静默跳过）
  if (!loading && rows.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-slate-200">一句话播报</h2>
      <p className="text-[10px] text-slate-500 mt-0.5 mb-2">只讲事实和纪律，不预测涨跌</p>
      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {symbols.slice(0, 4).map((sym) => (
            <div key={sym} className="h-8 animate-pulse bg-slate-800/60 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(({ sym, brief }) => (
            <button
              key={sym}
              onClick={() => onPick(sym)}
              className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800/70 active:bg-slate-800 transition-colors"
            >
              <span className="text-[11px] text-slate-300 leading-relaxed">{brief}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
