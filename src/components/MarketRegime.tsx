// 今日页「大盘阶段」条：一句话直说现在大盘是牛、是熊、还是震荡，再给一句依据。
// 判据只用 QQQ 的两条均线关系（价格 vs 200 日线、50 日线 vs 200 日线），
// 都是可核对的事实，不预测、不喊买卖。数据走 /api/rhythm（range=1Y 够算 MA200）。
'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import type { RhythmResponse } from '@/lib/rhythm';

type Regime = 'bull' | 'bear' | 'sidewaysStrong' | 'sidewaysWeak';

const ma = (closes: number[], n: number): number | null =>
  closes.length >= n
    ? closes.slice(-n).reduce((a, b) => a + b, 0) / n
    : null;

export default function MarketRegime() {
  const { lang } = useLanguage();
  const [info, setInfo] = useState<{
    regime: Regime;
    last: number;
    ma50: number;
    ma200: number;
    status: string;
    score: number;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/rhythm?symbol=QQQ&range=1Y&lang=${lang}`)
      .then((r) => r.json())
      .then((j: RhythmResponse) => {
        if (!alive || !j.series || j.series.length === 0) return;
        const closes = j.series.map((p) => p.close);
        const ma50 = ma(closes, 50);
        const ma200 = ma(closes, 200);
        if (ma50 == null || ma200 == null) return;
        const last = closes[closes.length - 1];
        const above200 = last >= ma200;
        const ma50Above = ma50 >= ma200;
        const regime: Regime = above200
          ? ma50Above
            ? 'bull'
            : 'sidewaysStrong'
          : ma50Above
            ? 'sidewaysWeak'
            : 'bear';
        setInfo({
          regime,
          last,
          ma50,
          ma200,
          status: j.judgment.status,
          score: j.judgment.score,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [lang]);

  if (!info) return null;

  const label =
    info.regime === 'bull'
      ? tx(lang, 'Bull phase', '牛市阶段')
      : info.regime === 'bear'
        ? tx(lang, 'Bear phase', '熊市阶段')
        : tx(lang, 'Sideways phase', '震荡阶段');
  const labelColor =
    info.regime === 'bull'
      ? 'text-emerald-400'
      : info.regime === 'bear'
        ? 'text-rose-400'
        : 'text-amber-300';
  const verdict =
    info.regime === 'bull'
      ? tx(lang, 'Long and short trends both point up.', '长线短线都在往上。')
      : info.regime === 'bear'
        ? tx(lang, 'Long and short trends both point down.', '长线短线都在往下。')
        : info.regime === 'sidewaysStrong'
          ? tx(lang, 'The long trend is intact; the short term is chopping.', '长线还没坏，短线在拉锯。')
          : tx(lang, 'The long trend has cracked; the short term is still fighting.', '长线已经转弱，短线还在挣扎。');
  const pct = ((info.last - info.ma200) / info.ma200) * 100;
  const basis = tx(
    lang,
    `QQQ closed at ${info.last.toFixed(2)}, ${pct >= 0 ? 'above' : 'below'} its 200-day line (${info.ma200.toFixed(2)}) by ${Math.abs(pct).toFixed(1)}%; the 50-day line (${info.ma50.toFixed(2)}) sits ${info.ma50 >= info.ma200 ? 'above' : 'below'} the 200-day line. QQQ rhythm read: ${info.status} (${info.score}).`,
    `看纳指 QQQ：收 ${info.last.toFixed(2)}，在 200 日线（${info.ma200.toFixed(2)}）${pct >= 0 ? '上' : '下'}方 ${Math.abs(pct).toFixed(1)}%；50 日线（${info.ma50.toFixed(2)}）在 200 日线${info.ma50 >= info.ma200 ? '上' : '下'}方。QQQ 律动判断：${info.status}（${info.score} 分）。`,
  );

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-100">
          🧭 {tx(lang, 'Market phase', '大盘阶段')}
        </span>
        <span className={`text-lg font-bold ${labelColor}`}>{label}</span>
        <span className="text-xs text-slate-300">{verdict}</span>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{basis}</p>
    </div>
  );
}
