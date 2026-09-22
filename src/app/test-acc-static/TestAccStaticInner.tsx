'use client';

import { Check, X, History } from 'lucide-react';

/** 二分测试6：复盘面板的 UI 结构，但用硬编码数据，不 fetch，不经过加载动画 */
const HARDCODED = {
  available: true,
  stats: {
    total: 173,
    accuracy: 64.2,
    sampleDays: 250,
    baseline: { chase: 63.1, bounce: 71.9 },
    statuses: {
      hotStrong: { label: '高位稳着涨', total: 118, accuracy: 66.1, baseline: 63.1, edge: 3 },
      overheated: { label: '涨太猛了', total: 30, accuracy: 60, baseline: 63.1, edge: -3.1 },
      weakLow: { label: '还在往下跌', total: 25, accuracy: 52, baseline: 63.1, edge: -11.1 },
      oversoldBottom: { label: '跌过头了', total: 0, accuracy: null, baseline: 71.9, edge: null },
    },
  },
  recent: [
    { date: '2026-09-18', score: 91, status: '高位稳着涨', statusKey: 'hotStrong', tier: 'stable', nextReturn: 0.85, hit: false },
    { date: '2026-09-17', score: 95, status: '高位稳着涨', statusKey: 'hotStrong', tier: 'stable', nextReturn: -0.26, hit: true },
  ],
  rule: '四状态分别验证',
};

function fmtPct(v: number | null): string {
  return v == null ? '—' : `${v}%`;
}

function fmtEdge(v: number | null): string {
  if (v == null) return '—';
  return `${v >= 0 ? '+' : ''}${v}`;
}

const STATUS_ORDER = ['hotStrong', 'overheated', 'oversoldBottom', 'weakLow'] as const;

export default function TestAccStaticInner() {
  const data = HARDCODED;
  const stats = data.stats;
  const acc = stats.accuracy ?? 0;
  const accColor = acc >= 60 ? 'text-emerald-400' : acc >= 50 ? 'text-amber-400' : 'text-rose-400';

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试6：复盘面板硬编码数据</h1>
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
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {STATUS_ORDER.map((key) => {
            const st = (stats.statuses as any)[key];
            if (!st) return null;
            const edgeColor = st.edge == null ? 'text-slate-500' : st.edge > 0 ? 'text-emerald-400' : st.edge < 0 ? 'text-rose-400' : 'text-slate-400';
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
        <div className="mt-3 space-y-1">
          {data.recent.slice(0, 5).map((s) => (
            <div key={s.date} className="flex items-center justify-between text-[11px] bg-slate-800/30 rounded-lg px-3 py-1.5">
              <span className="text-slate-400">
                {s.date.slice(5)} · {s.status} {s.score}分
              </span>
              <span className="flex items-center gap-1.5">
                <span className={s.nextReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  次日 {s.nextReturn >= 0 ? '+' : ''}{s.nextReturn}%
                </span>
                {s.hit ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-rose-400" />}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] text-slate-600 leading-relaxed">命中规则：{data.rule}</p>
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果闪退，问题在 UI 结构本身；如果正常，问题在 fetch 或加载动画。
      </p>
    </div>
  );
}
