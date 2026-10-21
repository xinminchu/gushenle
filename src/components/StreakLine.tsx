'use client';

import { useMemo } from 'react';
import { symbolStreaks, breadthUpCount, type Streak } from '@/lib/streaks';
import type { RhythmResponse } from '@/lib/rhythm';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

function streakText(s: Streak, symbol: string, lang: string): string {
  switch (s.kind) {
    case 'up':
      return tx(lang, `${symbol} up ${s.days}d in a row`, `${symbol} 已连续 ${s.days} 个交易日收涨`);
    case 'down':
      return tx(lang, `${symbol} down ${s.days}d in a row`, `${symbol} 已连续 ${s.days} 个交易日收跌`);
    case 'aboveMA':
      return tx(lang, `${symbol} above 50-day MA ${s.days}d`, `${symbol} 已连续 ${s.days} 日站上 50 日均线`);
    case 'belowMA':
      return tx(lang, `${symbol} below 50-day MA ${s.days}d`, `${symbol} 已连续 ${s.days} 日跌破 50 日均线`);
    case 'volUp':
      return tx(lang, `${symbol} volume expanding ${s.days}d`, `${symbol} 已连续 ${s.days} 个交易日放量`);
    case 'volDown':
      return tx(lang, `${symbol} volume shrinking ${s.days}d`, `${symbol} 已连续 ${s.days} 个交易日缩量`);
  }
}

/**
 * streak 小统计（今日页）：一行事实型描述，无 streak（N<2）时整行隐藏。
 * 数据全部来自已有 /api/rhythm 日线，不新增数据源。
 */
export default function StreakLine({
  symbol,
  data,
  wlData,
}: {
  symbol: string;
  data: RhythmResponse | null;
  wlData: Record<string, RhythmResponse>;
}) {
  const { lang } = useLanguage();

  const parts = useMemo(() => {
    if (!data || data.series.length === 0) return null;
    const out: string[] = [];
    // 当前标的：取最显著的两条 streak
    const own = symbolStreaks(data.series).slice(0, 2);
    for (const s of own) out.push(streakText(s, symbol, lang));
    // 自选广度：连续收涨 2 日+ 的有几只
    const { up, total } = breadthUpCount(wlData);
    if (total > 0 && up >= 2) {
      out.push(tx(lang, `${up}/${total} watchlist up 2d+`, `自选股中 ${up}/${total} 只连续 2 日+上涨`));
    }
    return out.length > 0 ? out : null;
  }, [data, wlData, symbol, lang]);

  if (!parts) return null;
  return (
    <div className="text-[11px] leading-relaxed text-slate-400">
      <span className="text-slate-500">📊</span> {parts.join(' · ')}
    </div>
  );
}
