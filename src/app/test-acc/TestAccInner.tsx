'use client';

import AccuracyPanel from '@/components/AccuracyPanel';

/** 二分测试4a：只有复盘面板 */
export default function TestAccInner() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试4a：只有复盘面板</h1>
      <AccuracyPanel symbol="AAPL" />
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果闪退，凶手就是复盘面板；如果正常，凶手就是诊断文案区。
      </p>
    </div>
  );
}
