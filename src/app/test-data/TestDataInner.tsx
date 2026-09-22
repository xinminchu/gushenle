'use client';

import { useEffect, useState } from 'react';
import RhythmChart from '@/components/RhythmChart';
import { getRhythm } from '@/lib/market';
import type { RhythmResponse } from '@/lib/rhythm';

/**
 * 二分测试2：用真实 /api/rhythm 数据（AAPL 3M）喂给图表。
 * 如果这个页面闪退，说明问题在数据链路；如果正常，问题在主页其他组件。
 */
export default function TestDataInner() {
  const [data, setData] = useState<RhythmResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getRhythm('AAPL', '3M')
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err?.message || err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>二分测试2：真实数据</h1>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
        从 /api/rhythm 拉 AAPL 3M 真实数据，再喂给 K线+高低线图表（和线上主页一致）
      </p>
      {loading && <p style={{ fontSize: 13 }}>拉取数据中…</p>}
      {error && <p style={{ fontSize: 13, color: '#f87171' }}>拉取失败：{error}</p>}
      {data && (
        <>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            拿到 {data.series.length} 个点，综合分 {data.judgment.score}
          </p>
          <div style={{ background: '#020617', borderRadius: 12, padding: 8 }}>
            <RhythmChart series={data.series} height={300} chartType="candle" showRangeHL={true} />
          </div>
        </>
      )}
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果这个页面也闪退，说明问题在数据链路；如果正常，问题在主页其他组件（复盘面板等）。
      </p>
    </div>
  );
}
