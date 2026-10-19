'use client';

import { useEffect, useState } from 'react';
import { getRhythm } from '@/lib/market';
import { analyzeDrops, type DrawdownStats } from '@/lib/drawdownHistory';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 历史对照：大跌体检卡里的一小块"历史锚"。
 *
 * 今天 QQQ 跌了 X%，历史上同样跌幅的日子后来都怎么样了？
 * 三行字：频率 → 收复中位 → 最惨一次。只摆事实，不预测。
 */

interface Props {
  /** 今日 QQQ 跌幅（负数，如 -2.31） */
  dropPct: number;
}

export default function DrawdownHistory({ dropPct }: Props) {
  const { lang } = useLanguage();
  const [stats, setStats] = useState<DrawdownStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await getRhythm('QQQ', '3y', { lang: 'zh' });
        if (cancelled) return;
        const bars = r.series
          .filter((p) => p.close > 0)
          .map((p) => ({ date: p.date, close: p.close }));
        // 用"今天跌了多少"做阈值：历史上同样量级的大跌，后来怎么样
        const threshold = Math.min(dropPct, -1);
        setStats(analyzeDrops(bars, threshold));
      } catch {
        if (!cancelled) setStats(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dropPct]);

  if (!stats || stats.count === 0) return null;

  const absDrop = Math.abs(stats.threshold).toFixed(1).replace(/\.0$/, '');
  const line1 = tx(
    lang,
    `In the past ${stats.spanYears} yrs, QQQ fell over ${absDrop}% in a single day ${stats.count} times.`,
    `过去 ${stats.spanYears} 年里，QQQ 单日跌超 ${absDrop}% 有 ${stats.count} 次。`,
  );
  const line2 =
    stats.medianRecoverDays != null
      ? tx(
          lang,
          `${stats.recoveredCount} of them recovered, median ${stats.medianRecoverDays} trading days.`,
          `其中 ${stats.recoveredCount} 次收复了失地，中位用时 ${stats.medianRecoverDays} 个交易日。`,
        )
      : tx(
          lang,
          `None recovered within the data window.`,
          `数据窗口内没有一次收复失地。`,
        );
  const w = stats.worst;
  const line3 = w
    ? w.recoverDays == null
      ? tx(
          lang,
          `Worst: ${w.date} (${w.dropPct}%) — never recovered since.`,
          `最惨的是 ${w.date} 那次（${w.dropPct}%），之后再没涨回去。`,
        )
      : tx(
          lang,
          `Worst: ${w.date} (${w.dropPct}%), took ${w.recoverDays} trading days to recover.`,
          `最惨的是 ${w.date}（${w.dropPct}%），用了 ${w.recoverDays} 个交易日才回来。`,
        )
    : null;

  return (
    <div className="mt-2.5 rounded-xl border border-amber-500/25 bg-amber-950/20 px-3 py-2.5">
      <p className="text-[11px] font-semibold text-amber-200/90">
        {tx(lang, '📜 Historical context', '📜 历史对照')}
      </p>
      <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-slate-300">
        <li>· {line1}</li>
        <li>· {line2}</li>
        {line3 && <li>· {line3}</li>}
      </ul>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
        {tx(
          lang,
          'History shows probabilities, not this time. Not investment advice.',
          '历史只告诉你概率，不告诉你这次。不构成投资建议。',
        )}
      </p>
    </div>
  );
}
