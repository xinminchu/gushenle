// src/components/AccuracyPanel.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { Check, X, History } from 'lucide-react';
import { tx } from '@/lib/hant';

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

interface LedgerRow {
  day: string;
  status_key: string;
  signals: number;
  hits: number;
  accuracy: number | null;
  baseline: number | null;
  edge: number | null;
}

/** 台账趋势小折线（准确率 %，动态区间） */
function LedgerSparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 120;
  const h = 30;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const xy = values.map(
    (v, i) =>
      [
        pad + (i / (values.length - 1)) * (w - pad * 2),
        h - pad - ((v - min) / span) * (h - pad * 2),
      ] as const,
  );
  const d = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill="#38bdf8" />
    </svg>
  );
}

export default function AccuracyPanel({ symbol }: { symbol: string }) {
  const { lang } = useLanguage();
  const [data, setData] = useState<AccuracyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/accuracy?symbol=${encodeURIComponent(symbol)}&lang=${lang}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => console.error('accuracy fetch failed:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    fetch(`/api/accuracy?view=ledger&symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && Array.isArray(json.ledger)) setLedger(json.ledger);
      })
      .catch((err) => console.error('ledger fetch failed:', err));
    return () => {
      cancelled = true;
    };
  }, [symbol, lang]);

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
          <History className="w-4 h-4 text-slate-400" /> {tx(lang, 'Backtest', '判断复盘')}
          <span className="text-[10px] font-normal text-slate-500">{symbol}</span>
        </h2>
        <p className="text-xs text-slate-500">{data?.reason ?? (tx(lang, 'No backtest data', '暂无复盘数据'))}</p>
      </div>
    );
  }

  const { stats, recent = [], rule } = data;
  const acc = stats.accuracy ?? 0;
  const accColor = acc >= 60 ? 'text-emerald-400' : acc >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
      <h2 className="text-base font-semibold mb-2 text-slate-200 flex items-center gap-2">
        <History className="w-4 h-4 text-slate-400" /> {tx(lang, 'Backtest', '判断复盘')}
        <span className="text-[10px] font-normal text-slate-500">{symbol}</span>
        <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
          {tx(lang, '1Y signals · next-day verified', '近一年信号 · 次日验证')}
        </span>
      </h2>
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        {tx(lang, 'Not a prediction — it answers one question: were past “don’t chase / don’t catch the knife” warnings actually right?', '不预测涨跌，只回答一个问题：过去的“别追 / 别抄底”警告，到底准不准？')}
      </p>

      <div className="flex items-center gap-5">
        <div className="text-center shrink-0">
          <div className={`text-4xl font-extrabold ${accColor}`}>{fmtPct(stats.accuracy)}</div>
          <div className="text-[10px] text-slate-400 mt-1">{tx(lang, 'Overall accuracy', '综合准确率')}</div>
        </div>
        <div className="flex-1 text-xs space-y-1.5">
          <div className="text-slate-400">
            {tx(lang, `${stats.total} signals · ${stats.sampleDays} days`, `${stats.total} 个信号 · ${stats.sampleDays} 天样本`)}
          </div>
          <div className="text-slate-500 text-[11px] leading-relaxed">
            {tx(lang, `Baseline (natural hit rate, all days): don't-chase ${fmtPct(stats.baseline.chase)} · bounce ${fmtPct(stats.baseline.bounce)}`, `基线（同期所有交易日天然命中率）：别追类 ${fmtPct(stats.baseline.chase)} · 反弹类 ${fmtPct(stats.baseline.bounce)}`)}
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
          // 一句人话结论：这个警告到底值不值得听
          const verdict =
            st.total === 0
              ? { text: tx(lang, 'Never triggered in the past year', '过去一年没出现过'), cls: 'text-slate-500' }
              : st.edge == null || st.accuracy == null
                ? null
                : st.edge >= 5
                  ? { text: tx(lang, 'Reliable warning — worth heeding', '这个警告比较准，出现时多掂量一下'), cls: 'text-emerald-400' }
                  : st.edge <= -5
                    ? { text: tx(lang, 'Often wrong — take with a grain of salt', '这个警告经常报错，别太当真'), cls: 'text-rose-400' }
                    : { text: tx(lang, 'Barely better than guessing', '跟瞎猜差不多，参考价值不大'), cls: 'text-slate-500' };
          return (
            <div key={key} className="bg-slate-800/50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-300 font-medium">{st.label}</span>
                <span className="text-[10px] text-slate-500">{tx(lang, `${st.total}×`, `${st.total}次`)}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-100">{fmtPct(st.accuracy)}</span>
                <span className={`text-[10px] ${edgeColor}`}>{tx(lang, `vs baseline ${fmtEdge(st.edge)}%`, `超基线 ${fmtEdge(st.edge)}%`)}</span>
              </div>
              {verdict && (
                <div className={`mt-0.5 text-[10px] leading-snug ${verdict.cls}`}>{verdict.text}</div>
              )}
            </div>
          );
        })}
      </div>

      {recent.length > 0 && (
        <div className="mt-3">
          <div className="text-[10px] text-slate-600 mb-1">
            {tx(lang, '✓ = warning proved right · ✗ = warning proved wrong (grades the warning, not the move)', '✓ = 警告应验了 · ✗ = 警告报错了（评的是警告准不准，不是涨跌好坏）')}
          </div>
          <div className="space-y-1">
          {recent.slice(0, 5).map((s) => (
            <div
              key={s.date}
              className="flex items-center justify-between text-[11px] bg-slate-800/30 rounded-lg px-3 py-1.5"
            >
              <span className="text-slate-400">
                {s.date.slice(5)} · {s.status} {tx(lang, `${s.score} pts`, `${s.score}分`)}
                {s.tier === 'high' && <span className="text-slate-600">{tx(lang, ' · high-vol', ' · 高波')}</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <span className={s.nextReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {tx(lang, 'next day ', '次日 ')}{s.nextReturn >= 0 ? '+' : ''}
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
        </div>
      )}

      {rule && <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">{tx(lang, 'Hit rule: ', '命中规则：')}{rule}</p>}

      {/* 📒 台账：每天收盘后自动跑一遍回测，把准确率按天存下来 */}
      <div className="mt-3 pt-3 border-t border-slate-800">
        <div className="text-[11px] text-slate-400 font-medium mb-2">
          {tx(lang, 'Ledger: daily accuracy log', '📒 台账：准确率日报')}
        </div>
        {(() => {
          const overall = ledger.filter((r) => r.status_key === 'all' && r.accuracy != null);
          if (overall.length === 0) {
            return (
              <p className="text-[11px] text-slate-600">
                {tx(lang, 'Collecting… one entry is logged after each close.', '收集中…每天收盘后记一笔，攒够天数这里会出现走势。')}
              </p>
            );
          }
          const vals = overall.slice(-30).map((r) => r.accuracy as number);
          const first = vals[0];
          const lastV = vals[vals.length - 1];
          const delta = Math.round((lastV - first) * 10) / 10;
          return (
            <div className="flex items-center gap-3">
              <LedgerSparkline values={vals} />
              <div className="text-[11px] text-slate-500 leading-relaxed">
                <div>
                  {tx(lang, `Overall ${lastV}% · ${overall.length} days logged`, `综合 ${lastV}% · 已记 ${overall.length} 天`)}
                </div>
                <div className={delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {tx(lang, `${delta >= 0 ? '+' : ''}${delta} pts since tracking`, `开始记录以来 ${delta >= 0 ? '+' : ''}${delta} 个百分点`)}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
