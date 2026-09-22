'use client';

import { useEffect, useState } from 'react';

/** 二分测试8：只 fetch /api/accuracy，显示原始 JSON，不经过复盘面板 UI */
export default function TestFetchInner() {
  const [text, setText] = useState<string>('加载中…');
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    const t0 = Date.now();
    let cancelled = false;
    fetch('/api/accuracy?symbol=AAPL')
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) {
          setText(t);
          setElapsed(Date.now() - t0);
        }
      })
      .catch((err) => {
        if (!cancelled) setText('fetch 失败: ' + String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试8：fetch 原始数据</h1>
      <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
        只请求 /api/accuracy，显示原始返回（耗时 {elapsed}ms）
      </p>
      <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#1e293b', padding: 12, borderRadius: 8 }}>
        {text.slice(0, 2000)}
      </pre>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果闪退，就是这个 API 的请求或数据有问题；如果正常，问题在复盘面板用真实数据渲染时。
      </p>
    </div>
  );
}
