'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

/** 首页三行的大白话标题（用户定版；中间行名字暂定） */
const HOT_LABEL = '涨得欢';
const MIDDLE_LABEL = '看一眼';
const COLD_LABEL = '跌得凶';

interface ScanItem {
  symbol: string;
  name: string;
  score: number;
  changePct: number | null;
  pattern?: 'rebound' | 'streak';
}

interface ScanPayload {
  ok: boolean;
  empty?: boolean;
  scanDate?: string;
  hot?: ScanItem[];
  middle?: ScanItem[];
  cold?: ScanItem[];
}

/**
 * 首页「今日信号」：每天收盘后批处理扫精选池，摆三行
 * 🔥 涨得欢：冲高过热，按分从高到低前 5 —— 别追，当心有套（栏杆，淡红底）
 * 👀 看一眼：|综合分-50| 最小的前 5（离两头都远）—— 中间行名字暂定（淡绿底，观察中）
 * 🥶 跌得凶：模型判定跌过头了，按分从低到高前 5 —— 慎出，不卖飞（栏杆，淡红底）
 * 不展示律动分；点一只直接跳到它的价格走势。只展示数据 + 大白话，不做买入推荐。
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

  if (
    !data ||
    !data.hot ||
    (data.hot.length === 0 && (data.middle || []).length === 0 && (data.cold || []).length === 0)
  ) {
    return null;
  }
  const md = data.scanDate || '';

  // tone: 上下两行是栏杆（淡红底），中间行观察区（淡绿底）
  const row = (items: ScanItem[], label: string, sub: string | undefined, tone: 'red' | 'green') => (
    <div
      className={`mb-2 last:mb-0 rounded-lg border px-2 py-2 ${
        tone === 'red' ? 'bg-red-950/50 border-red-900/50' : 'bg-green-950/40 border-green-900/50'
      }`}
    >
      <div className="mb-1.5">
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        {sub && <span className="text-[10px] text-slate-500 ml-1.5">{sub}</span>}
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
              {s.pattern && (
                <div
                  className={`text-[9px] leading-tight mt-0.5 ${
                    s.pattern === 'rebound' ? 'text-emerald-300' : 'text-sky-300'
                  }`}
                >
                  {s.pattern === 'rebound' ? '反弹' : '连跌'}
                </div>
              )}
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
          `🔥 ${HOT_LABEL}`,
          en ? 'don\u2019t chase, avoid getting trapped' : '别追，当心有套',
          'red',
        )}
      {(data.middle || []).length > 0 &&
        row(data.middle || [], `👀 ${MIDDLE_LABEL}`, en ? 'closest to score 50' : '离50分最近', 'green')}
      {(data.cold || []).length > 0 &&
        row(
          data.cold || [],
          `🥶 ${COLD_LABEL}`,
          en ? 'oversold, don\u2019t sell the bottom' : '跌过头了 · 慎出，不卖飞',
          'red',
        )}
      <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
        {en
          ? '📌 Hot: be cautious entering, don\u2019t get trapped at the top; Oversold: be cautious exiting, don\u2019t sell the bottom; Take a look: far from both extremes — all three describe conditions, you make your own calls.'
          : '📌 涨得欢：慎入，防套牢；跌得凶：慎出，不卖飞；看一眼：离两头都远——三行都是状态，买卖自己定。'}
      </div>
    </div>
  );
}
