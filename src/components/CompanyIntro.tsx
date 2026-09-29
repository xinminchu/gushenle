'use client';

import React from 'react';
import { sectorLabel, themeLabel, type StockInfo } from '@/lib/stockList';
import type { Lang } from '@/lib/i18n';
import { tx, zh2hant } from '@/lib/hant';

/**
 * 🏢 公司介绍：大白话一句话 + 板块/主题标签。
 * 数据来自本地 stockList.ts（原创大白话，非券商翻译腔），零外部依赖、零维护。
 * 名单库里没有的自选代码不显示。
 */
export default function CompanyIntro({ info, lang = 'zh' }: { info: StockInfo; lang?: Lang }) {
  const en = lang === 'en';
  if (!info.blurb && info.themes.length === 0) return null;
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-3 py-2.5">
      <div className="text-[10px] text-slate-500 mb-1">{tx(lang, '🏢 What this company does', '🏢 这家公司是干嘛的')}</div>
      <p className="text-xs text-slate-300 leading-relaxed">
        <span className="text-slate-100 font-medium">{tx(lang, info.en, info.zh)}</span>
        {!en && info.blurb && (
          <>
            <span className="text-slate-500">：</span>
            {zh2hant(lang, info.blurb)}
          </>
        )}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1">
        {info.sector && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
            {sectorLabel(info.sector, lang)}
          </span>
        )}
        {info.themes.slice(0, 3).map((t) => (
          <span
            key={t}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50"
          >
            {themeLabel(t, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}
