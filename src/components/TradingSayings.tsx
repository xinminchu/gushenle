// 今日页「经验语录」卡：民间流传的交易老话，每天轮换一条，可点「换一条」。
// 纯分享、非建议：卡片底部固定免责声明，语录不与任何个股/信号挂钩。
'use client';

import React, { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import { SAYINGS } from '@/lib/sayings';

export default function TradingSayings() {
  const { lang } = useLanguage();
  // 每天第一条按日期定，同日打开不变；之后点「换一条」顺序轮换
  const dailyIdx = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
    return dayOfYear % SAYINGS.length;
  }, []);
  const [offset, setOffset] = useState(0);
  const saying = SAYINGS[(dailyIdx + offset) % SAYINGS.length];

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-100">
          💬 {tx(lang, 'Trading Sayings', '经验语录')}
          <span className="ml-2 text-[10px] font-normal text-slate-500">
            {tx(lang, 'old market wisdom, shared as-is', '过来人老话 · 原样分享')}
          </span>
        </span>
        <button
          onClick={() => setOffset((o) => o + 1)}
          className="text-[11px] text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-lg px-2.5 py-1 flex items-center gap-1 transition-colors"
        >
          <RefreshCw className="w-3 h-3" />
          {tx(lang, 'Another', '换一条')}
        </button>
      </div>
      <p className="text-sm text-slate-200 leading-relaxed">
        {tx(lang, saying.en, saying.zh)}
      </p>
      <p className="text-[11px] text-slate-500">
        —— {tx(lang, saying.fromEn, saying.fromZh)}
      </p>
      <p className="text-[10px] text-slate-600 border-t border-slate-800 pt-2">
        {tx(
          lang,
          'Shared experience only — not investment advice. Your trades, your call.',
          '纯经验分享，不是投资建议；买卖自己定。',
        )}
      </p>
    </div>
  );
}
