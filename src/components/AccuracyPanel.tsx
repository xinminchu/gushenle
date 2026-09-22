// src/components/AccuracyPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Check, X, History } from 'lucide-react';

interface Signal {
  date: string;
  score: number;
  status: string;
  statusKey: 'hotStrong' | 'overheated' | 'oversoldBottom' | 'weakLow';
  tier: 'high' | 'stable';
  nextReturn: number;
  hit: boolean;
}

interface StatusStat {
  label: string;
  total: number;
  accuracy: number | null;
  baseline: number | null;
  edge: number | null;
}

interface AccuracyData {
  available: boolean;
  reason?: string;
  stats?: {
    total: number;
    accuracy: number | null;
    sampleDays: number;
    baseline: { chase: number | null; bounce: number | null };
    statuses: Record<Signal['statusKey'], StatusStat>;
  };
  recent?: Signal[];
  rule?: string;
}

const STATUS_ORDER: Signal['statusKey'][] = ['hotStrong', 'overheated', 'oversoldBottom', 'weakLow'];

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v}%`;
}

function fmtEdge(v: number | null): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v}`;
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
        <div className="flex-1 text-xs space-y-1.5">
          <div className="text-slate-400">
            {stats.total} 个信号 · {stats.sampleDays} 天样本
          </div>
          <div className="text-slate-500 text-[11px] leading-relaxed">
            基线（同期所有交易日天然命中率）：别追类 {fmtPct(stats.baseline.chase)} · 反弹类{' '}
            {fmtPct(stats.baseline.bounce)}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {stats.statuses &&
          STATUS_ORDER.map((key) => {
            const st = stats.statuses?.[key];
            if (!st) return null;
          const edgeColor =
            st.edge == null
              ? 'text-slate-500'
              : st.edge > 0
                ? 'text-emerald-400'
                : st.edge < 0
                  ? 'text-rose-400'
                  : 'text-slate-400';
          return (
            <div key={key} className="bg-slate-800/50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">{st.label}</span>
                <span className="text-[10px] text-slate-500">{st.total}次</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-100">{fmtPct(st.accuracy)}</span>
                <span className={`text-[10px] ${edgeColor}`}>超基线 {fmtEdge(st.edge)}%</span>
              </div>
            </div>
          );
        })}
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
                {s.tier === 'high' && <span className="text-slate-600"> · 高波</span>}
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
