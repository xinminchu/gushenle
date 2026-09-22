'use client';

import { useEffect, useState } from 'react';

/** 二分测试10：用 r.json()（而不是 r.text()）解析 /api/accuracy，看是不是 json 解析的问题 */
export default function TestJsonInner() {
  const [text, setText] = useState<string>('加载中…');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/accuracy?symbol=AAPL')
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled) {
          // 把解析后的对象再转回字符串显示
          setText(JSON.stringify(json).slice(0, 2000));
        }
      })
      .catch((err) => {
        if (!cancelled) setText('json 解析失败: ' + String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: 16, background: '#0f172a', minHeight: '100vh', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>二分测试10：r.json() 解析</h1>
      <pre style={{ fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#1e293b', padding: 12, borderRadius: 8 }}>
        {text}
      </pre>
      <p style={{ fontSize: 12, color: '#64748b', marginTop: 12 }}>
        如果闪退，就是 r.json() 的问题；如果正常，问题在真实组件使用解析后数据的方式。
      </p>
    </div>
  );
}
