// src/components/AccuracyPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, History } from 'lucide-react';

interface Signal {
  date: string;
  score: number;
  status: string;
  type: 'overheat' | 'oversold';
  nextReturn: number;
  hit: boolean;
}

interface AccuracyData {
  available: boolean;
  reason?: string;
  stats?: {
    total: number;
    accuracy: number | null;
    overheat: { total: number; accuracy: number | null };
    oversold: { total: number; accuracy: number | null };
  };
  recent?: Signal[];
  rule?: string;
}

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v}%`;
}

export default function AccuracyPanel({ symbol }: { symbol: string }) {
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/accuracy?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => console.error('复盘数据获取失败:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="h-24 animate-pulse bg-slate-800/50 rounded-xl" />
      </div>
    );
  }

  if (!data || !data.available || !data.stats) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h2 className="text-base font-semibold mb-2 text-slate-200 flex items-center gap-2">
          <History className="w-4 h-4 text-slate-400" /> 判断复盘
        </h2>
        <p className="text-xs text-slate-500">{data?.reason ?? '暂无复盘数据'}</p>
      </div>
    );
  }

  const { stats, recent = [], rule } = data;
  const acc = stats.accuracy ?? 0;
  const accColor = acc >= 60 ? 'text-emerald-400' : acc >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 className="text-base font-semibold mb-3 text-slate-200 flex items-center gap-2">
        <History className="w-4 h-4 text-slate-400" /> 判断复盘
        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
          近一年信号 · 次日验证
        </span>
      </h2>

      <div className="flex items-center gap-5">
        <div className="text-center shrink-0">
          <div className={`text-4xl font-extrabold ${accColor}`}>{fmtPct(stats.accuracy)}</div>
          <div className="text-[10px] text-slate-400 mt-1">综合准确率</div>
        </div>
        <div className="flex-1 space-y-2 text-xs">
          <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
            <span className="text-slate-400">过热信号 {stats.overheat.total} 次</span>
            <span className="font-semibold text-slate-200">
              命中 {fmtPct(stats.overheat.accuracy)}
            </span>
          </div>
          <div className="flex justify-between bg-slate-800/50 rounded-lg px-3 py-2">
            <span className="text-slate-400">超卖信号 {stats.oversold.total} 次</span>
            <span className="font-semibold text-slate-200">
              命中 {fmtPct(stats.oversold.accuracy)}
            </span>
          </div>
        </div>
      </div>

      {recent.length > 0 && (
        <div className="mt-3 space-y-1">
          {recent.slice(0, 5).map((s) => (
            <div
              key={s.date}
              className="flex items-center justify-between text-[11px] bg-slate-800/30 rounded-lg px-3 py-1.5"
            >
              <span className="text-slate-400">
                {s.date.slice(5)} · {s.status} {s.score}分
              </span>
              <span className="flex items-center gap-1.5">
                <span className={s.nextReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  次日 {s.nextReturn >= 0 ? '+' : ''}
                  {s.nextReturn}%
                </span>
                {s.hit ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <X className="w-3.5 h-3.5 text-rose-400" />
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {rule && <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">命中规则：{rule}</p>}
    </div>
  );
}
