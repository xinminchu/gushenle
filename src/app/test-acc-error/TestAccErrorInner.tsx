'use client';

import React from 'react';
import AccuracyPanel from '@/components/AccuracyPanel';

/** 错误边界：捕获真实 AccuracyPanel 的 JS 错误并显示 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error: String(error?.message || error) };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // 把错误显示在页面上
    (this as any).errorInfo = String(info?.componentStack || '').slice(0, 500);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 16, background: '#7f1d1d', color: '#fecaca', borderRadius: 8, fontSize: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>捕获到 JS 错误（不是闪退）：</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{this.state.error}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function TestAccErrorInner() {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试11：真实组件 + 错误边界</h1>
      <ErrorBoundary>
        <AccuracyPanel symbol="AAPL" />
      </ErrorBoundary>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果显示红色错误信息，就是 JS 错误；如果还是闪退，就是 Web 进程崩溃。
      </p>
    </div>
  );
}
