'use client';

import { History, Check, X } from 'lucide-react';

/** 二分测试5：只渲染复盘面板用的三个图标，看是不是图标的问题 */
export default function TestIconsInner() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试5：图标</h1>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
        只渲染 History / Check / X 三个图标
      </p>
      <div style={{ display: 'flex', gap: 16, fontSize: 24 }}>
        <History className="w-6 h-6 text-slate-400" />
        <Check className="w-6 h-6 text-emerald-400" />
        <X className="w-6 h-6 text-rose-400" />
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果闪退，就是这几个图标的问题；如果正常，问题在复盘面板的数据渲染或动画。
      </p>
    </div>
  );
}
