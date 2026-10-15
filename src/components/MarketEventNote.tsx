'use client';

import { MARKET_EVENT } from '@/lib/piis';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 事件归因一句话：大跌/大涨日 Sam 在 lib/piis.ts 手写 driver，资讯页置顶显示。
 * 只讲"为什么发生"，不预测、不给操作建议。active=false 时自动隐藏。
 */
export default function MarketEventNote() {
  const { lang } = useLanguage();
  if (!MARKET_EVENT.active) return null;
  return (
    <section className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-teal-300">
          {tx(lang, '🧭 Market Note', '🧭 市场注脚')}
        </h2>
        <span className="text-xs text-slate-400">
          {tx(lang, MARKET_EVENT.dateEn, MARKET_EVENT.dateZh)}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-slate-100 leading-snug">
        {tx(lang, MARKET_EVENT.titleEn, MARKET_EVENT.titleZh)}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">
        {tx(lang, MARKET_EVENT.bodyEn, MARKET_EVENT.bodyZh)}
      </p>
    </section>
  );
}
