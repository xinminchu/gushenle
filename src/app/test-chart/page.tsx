import { Suspense } from 'react';
import TestChartInner from './TestChartInner';

export default function TestChartPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16, color: '#94a3b8' }}>加载中…</div>}>
      <TestChartInner />
    </Suspense>
  );
}
