'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { STATUS_LABELS } from '@/lib/rhythm';

interface ScanItem {
  symbol: string;
  name: string;
  score: number;
  changePct: number | null;
}

interface ScanPayload {
  ok: boolean;
  empty?: boolean;
  scanDate?: string;
  hot?: ScanItem[];
  cold?: ScanItem[];
}

/**
 * 首页「今日信号」：每天收盘后批处理扫精选池，取
 * 🔥 涨太猛了（先别追）/ 🧊 跌过头了（别急着割）各前 5。
 * 只展示数据 + 大白话信号，不做买入推荐。
 */
export default function MarketSignalBoard({ onPick }: { onPick: (symbol: string) => void }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [data, setData] = useState<ScanPayload | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/market-scan')
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.ok && !j.empty) setData(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.hot || !data.cold || (data.hot.length === 0 && data.cold.length === 0)) {
    return null;
  }
  const md = data.scanDate ? data.scanDate.slice(5).replace('-', '/') : '';

  const row = (items: ScanItem[], label: string, hint: string) => (
    <div className="mb-2 last:mb-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        <span className="text-[10px] text-slate-500">{hint}</span>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {items.map((s) => {
          const up = (s.changePct ?? 0) > 0;
          return (
            <button
              key={s.symbol}
              onClick={() => onPick(s.symbol)}
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-1 py-1.5 text-center active:bg-slate-800"
            >
              <div className="text-[11px] font-bold text-slate-100 leading-tight">{s.symbol}</div>
              <div className="text-[9px] text-slate-500 leading-tight truncate">{s.name}</div>
              <div className="text-[10px] text-amber-300 font-semibold tabular-nums mt-0.5">
                {s.score}分
              </div>
              <div
                className={`text-[9px] tabular-nums ${
                  s.changePct == null
                    ? 'text-slate-500'
                    : up
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                }`}
              >
                {s.changePct == null ? '—' : `${up ? '+' : ''}${s.changePct}%`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-100">
          📡 {en ? 'Market Signals' : '今日信号'}
          {md && <span className="text-[10px] font-normal text-slate-500 ml-1.5">{md}</span>}
        </span>
        <span className="text-[10px] text-slate-500">{en ? 'data only' : '只摆数据·仅供参考'}</span>
      </div>
      {data.hot.length > 0 &&
        row(
          data.hot,
          `🔥 ${STATUS_LABELS.overheated}`,
          en ? "don't chase" : '先别追',
        )}
      {data.cold.length > 0 &&
        row(
          data.cold,
          `🧊 ${STATUS_LABELS.oversoldBottom}`,
          en ? "don't sell the bottom" : '别急着割',
        )}
    </div>
  );
}
