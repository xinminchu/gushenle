'use client';

import { useEffect, useState } from 'react';
import { Flame, ShieldAlert } from 'lucide-react';
import { getRhythm } from '@/lib/market';
import type { RhythmResponse } from '@/lib/rhythm';

/** 二分测试4b：只有诊断文案区（无复盘面板、无图表） */
export default function TestDiagInner() {
  const [data, setData] = useState<RhythmResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRhythm('AAPL', '3M')
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => console.error('获取失败:', err))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const judgment = data?.judgment ?? null;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试4b：只有诊断文案区</h1>
      {loading && <p style={{ fontSize: 13 }}>加载中…</p>}
      {judgment && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            {judgment.overheated ? (
              <Flame className="w-5 h-5 text-red-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
            )}
            <span className="text-lg font-bold">{judgment.status}</span>
          </div>
          <div className="text-4xl font-extrabold mb-2">{judgment.score}分</div>
          <p className="text-sm text-slate-300 leading-relaxed">{judgment.advice}</p>
          <div className="mt-2 text-xs text-slate-500">
            位置 {judgment.pos} · 趋势 {judgment.trend} · 速度 {judgment.vel}
          </div>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果闪退，凶手就是诊断文案区；如果正常，凶手就是复盘面板。
      </p>
    </div>
  );
}
