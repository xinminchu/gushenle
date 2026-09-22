'use client';

/** 二分测试7：只渲染复盘面板的加载状态（animate-pulse），不 fetch */
export default function TestLoadingInner() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试7：加载动画</h1>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
        只显示 animate-pulse 加载块，不请求 API
      </p>
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="h-24 animate-pulse bg-slate-800/50 rounded-xl" />
      </div>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果闪退，就是 animate-pulse 的问题；如果正常，问题在 fetch 或真实数据。
      </p>
    </div>
  );
}
