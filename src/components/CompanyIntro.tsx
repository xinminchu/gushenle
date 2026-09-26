'use client';

import React from 'react';
import type { StockInfo } from '@/lib/stockList';

/**
 * 🏢 公司介绍：大白话一句话 + 板块/主题标签。
 * 数据来自本地 stockList.ts（原创大白话，非券商翻译腔），零外部依赖、零维护。
 * 名单库里没有的自选代码不显示。
 */
export default function CompanyIntro({ info }: { info: StockInfo }) {
  if (!info.blurb && info.themes.length === 0) return null;
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-3 py-2.5">
      <div className="text-[10px] text-slate-500 mb-1">🏢 这家公司是干嘛的</div>
      {info.blurb && (
        <p className="text-xs text-slate-300 leading-relaxed">
          <span className="text-slate-100 font-medium">{info.zh}</span>
          <span className="text-slate-500">：</span>
          {info.blurb}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap gap-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
          {info.sector}
        </span>
        {info.themes.slice(0, 3).map((t) => (
          <span
            key={t}
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50"
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}
