'use client';

import { latestPiisWeek } from '@/lib/piis';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/** PIIS 本周解读：每周 Sam 把 PIIS 周报浓缩成一句话公式 + 5–8 条一句话，贴在 lib/piis.ts 即上线。 */
export default function PiisWeekly() {
  const { lang } = useLanguage();
  const week = latestPiisWeek();
  return (
    <section className="rounded-2xl border border-indigo-500/30 bg-indigo-950/30 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-indigo-300">
          {tx(lang, '📊 PIIS This Week', '📊 PIIS 本周')}
        </h2>
        <span className="text-xs text-slate-400">
          {tx(lang, week.rangeEn, week.rangeZh)}
        </span>
      </div>

      {/* 一句话公式 */}
      <div className="mt-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 px-3 py-2.5">
        <p className="text-[11px] text-indigo-400/80 mb-0.5">
          {tx(lang, 'One-line formula', '一句话公式')}
        </p>
        <p className="text-sm font-semibold text-slate-100 leading-snug">
          {tx(lang, week.formulaEn, week.formulaZh)}
        </p>
      </div>

      <ul className="mt-2.5 space-y-2">
        {week.points.map((p, i) => (
          <li key={i} className="flex gap-2 text-[13px] leading-relaxed">
            <span className="flex-shrink-0 mt-0.5 rounded-md bg-slate-700/60 px-1.5 py-0.5 text-[11px] text-slate-300 h-fit">
              {tx(lang, p.tagEn, p.tag)}
            </span>
            <span className="text-slate-300">{tx(lang, p.en, p.zh)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
