// 资讯页「探市全家桶 · 聪明钱动向」：自选股 90 天内部人交易（/api/insider ← SEC Form 4）
// 全部无数据时静默隐藏。文案只摆公开事实，不做任何解读、不下买卖结论。
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useWatchlist } from '@/components/WatchlistContext';
import { tx } from '@/lib/hant';
import type { Lang } from '@/lib/i18n';

interface InsiderSummary {
  buyShares: number;
  sellShares: number;
  insiderCount: number;
  filingCount: number;
}
interface InsiderData {
  symbol: string;
  unavailable?: boolean;
  summary?: InsiderSummary;
}

/** 股数格式化：1.2亿股 / 8.0万股 / 900股 */
function fmtShares(n: number, lang: Lang): string {
  if (n >= 1e8) return tx(lang, `${(n / 1e8).toFixed(1)}B shares`, `${(n / 1e8).toFixed(1)}亿股`);
  if (n >= 1e4) return tx(lang, `${(n / 1e4).toFixed(1)}K shares`, `${(n / 1e4).toFixed(1)}万股`);
  return tx(lang, `${Math.round(n)} shares`, `${Math.round(n)}股`);
}

export default function InsiderStrip() {
  const { items } = useWatchlist();
  const { lang } = useLanguage();
  const [rows, setRows] = useState<{ symbol: string; summary: InsiderSummary }[] | null>(null);

  useEffect(() => {
    let alive = true;
    const symbols = items
      .map((i) => i.symbol.toUpperCase())
      .filter((s) => /^[A-Z]{1,6}$/.test(s))
      .slice(0, 5);
    if (!symbols.length) {
      setRows([]);
      return;
    }
    Promise.all(
      symbols.map((s) =>
        fetch(`/api/insider?symbol=${encodeURIComponent(s)}`)
          .then((r) => r.json())
          .then((j: InsiderData) => ({ symbol: s, j }))
          .catch(() => ({ symbol: s, j: { unavailable: true } as InsiderData })),
      ),
    ).then((all) => {
      if (!alive) return;
      const ok = all
        .filter(
          ({ j }) =>
            !j.unavailable &&
            j.summary &&
            (j.summary.buyShares > 0 || j.summary.sellShares > 0),
        )
        .map(({ symbol, j }) => ({ symbol, summary: j.summary! }));
      setRows(ok);
    });
    return () => {
      alive = false;
    };
  }, [items]);

  if (!rows || rows.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] text-slate-500 shrink-0">
          {tx(lang, '🧭 Tanshi Bucket · Insider moves', '🧭 探市全家桶 · 聪明钱动向')}
        </span>
        <span className="text-[10px] text-slate-600 ml-auto shrink-0">
          {tx(lang, '90d · SEC Form 4', '近90天 · SEC Form 4')}
        </span>
      </div>
      <div className="mt-1 space-y-1">
        {rows.map(({ symbol, summary }) => {
          const net = summary.buyShares - summary.sellShares;
          return (
            <div key={symbol} className="text-[11px] leading-relaxed flex items-baseline gap-1.5 flex-wrap">
              <span className="font-semibold text-slate-200">{symbol}</span>
              <span className="text-slate-500">
                {tx(
                  lang,
                  `${summary.insiderCount} insider${summary.insiderCount > 1 ? 's' : ''}`,
                  `${summary.insiderCount}位内部人`,
                )}
              </span>
              {net > 0 && (
                <span className="text-emerald-400">
                  {tx(lang, `net bought ${fmtShares(net, lang)}`, `净买入 ${fmtShares(net, lang)}`)}
                </span>
              )}
              {net < 0 && (
                <span className="text-rose-400">
                  {tx(lang, `net sold ${fmtShares(-net, lang)}`, `净卖出 ${fmtShares(-net, lang)}`)}
                </span>
              )}
              {net === 0 && (
                <span className="text-slate-400">
                  {tx(
                    lang,
                    `bought ${fmtShares(summary.buyShares, lang)} / sold ${fmtShares(summary.sellShares, lang)}`,
                    `买入 ${fmtShares(summary.buyShares, lang)} / 卖出 ${fmtShares(summary.sellShares, lang)}`,
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-600 mt-1">
        {tx(
          lang,
          'Public SEC disclosures only — facts, not advice.',
          '数据来自 SEC 公开披露，仅为事实陈述，不构成建议。',
        )}
      </p>
    </div>
  );
}
