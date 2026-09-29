// 一句话播报：每只自选股每天一句 —— 异动 + 位置 + 律动 + 行动提示。
// 全确定性逻辑，只讲事实和纪律，不预测涨跌。点一行跳到那只股票。

'use client';

import { buildBrief } from '@/lib/brief';
import type { RhythmResponse } from '@/lib/rhythm';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

interface StockBriefsProps {
  symbols: string[];
  nameOf: (symbol: string) => string;
  /** useWatchlistData 拿到的 1Y 数据（symbol -> 响应） */
  dataMap: Record<string, RhythmResponse>;
  loading: boolean;
  onPick: (symbol: string) => void;
  /** 以下四个是"＋关注"用的：不传则整行保持纯播报（今日页旧调用不受影响） */
  onAddFocus?: (symbol: string) => void;
  focusSymbols?: string[];
  positionSymbols?: string[];
  focusFull?: boolean;
}

export default function StockBriefs({
  symbols,
  nameOf,
  dataMap,
  loading,
  onPick,
  onAddFocus,
  focusSymbols,
  positionSymbols,
  focusFull,
}: StockBriefsProps) {
  const { lang } = useLanguage();
  const rows = symbols
    .map((sym) => {
      const d = dataMap[sym];
      if (!d) return null;
      const brief = buildBrief(sym, nameOf(sym), d, lang);
      return brief ? { sym, brief } : null;
    })
    .filter((r): r is { sym: string; brief: string } => r !== null);

  // 数据还没回来、且一行都拼不出来时，整个卡片先不露面（模拟数据兜底的股票静默跳过）
  if (!loading && rows.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <h2 className="text-sm font-semibold text-slate-200">{tx(lang, 'One-line brief', '一句话播报')}</h2>
      <p className="text-[10px] text-slate-500 mt-0.5 mb-2">{tx(lang, 'Facts and discipline only — no price predictions', '只讲事实和纪律，不预测涨跌')}</p>
      {loading && rows.length === 0 ? (
        <div className="space-y-2">
          {symbols.slice(0, 4).map((sym) => (
            <div key={sym} className="h-8 animate-pulse bg-slate-800/60 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {rows.map(({ sym, brief }) => {
            const inFocus = focusSymbols?.includes(sym) ?? false;
            const held = positionSymbols?.includes(sym) ?? false;
            // 只有传了 onAddFocus 才露按钮；已关注/已持有的行不显示（上面关注卡里看得到）
            const canAdd = !!onAddFocus && !inFocus && !held;
            return (
              <div
                key={sym}
                onClick={() => onPick(sym)}
                className="w-full flex items-center gap-1 px-2.5 py-2 rounded-lg hover:bg-slate-800/70 active:bg-slate-800 transition-colors cursor-pointer"
              >
                <span className="flex-1 text-[11px] text-slate-300 leading-relaxed">{brief}</span>
                {canAdd && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddFocus(sym);
                    }}
                    disabled={focusFull}
                    title={focusFull ? tx(lang, 'Focus list full (6)', '关注已满 6 只') : tx(lang, `+ Follow ${sym}`, `＋关注 ${sym}`)}
                    aria-label={tx(lang, `+ Follow ${sym}`, `＋关注 ${sym}`)}
                    className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-blue-500/40 text-blue-300 hover:bg-blue-500/15 active:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {tx(lang, '+ Follow', '＋关注')}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
