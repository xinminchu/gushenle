// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
// 如果你把刚才的 UI 代码提炼成了组件（如 RhythmDashboard），可以直接导入
// import RhythmDashboard from '@/components/RhythmDashboard';

export default function HomePage() {
  const [symbol, setSymbol] = useState('AAPL');
  const [range, setRange] = useState('1M');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 获取真实 API 数据
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/rhythm?symbol=${symbol}&range=${range}`);
        const result = await res.json();
        setData(result);
      } catch (err) {
        console.error("加载谷峰律动数据失败", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [symbol, range]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* 顶部 Header / 标的切换控制 */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">今日看板 · 谷峰律动</h1>
        
        <div className="flex gap-2">
          {['AAPL', 'NVDA', 'TSLA', 'MSFT'].map((item) => (
            <button
              key={item}
              onClick={() => setSymbol(item)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                symbol === item 
                  ? 'bg-blue-600 text-white font-medium' 
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 数据展示面板 */}
      {loading ? (
        <div className="h-96 flex items-center justify-center text-slate-400">
          加载律动数据中...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧/上方：律动卡片 & 图表区 */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-3xl font-extrabold">${data?.latestPrice}</span>
                <span className="ml-3 text-xs px-2 py-1 bg-slate-800 rounded text-slate-300">
                  律动分位数: {data?.rhythmPos}%
                </span>
              </div>
              
              {/* 时间范围切换 */}
              <div className="flex bg-slate-800 rounded-lg p-1 text-xs">
                {['1W', '1M', '3M', '1Y'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded ${
                      range === r ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 图表渲染区域 (结合你的 Recharts / ECharts 或动态 SVG) */}
            <div className="h-80 w-full flex items-center justify-center border border-dashed border-slate-800 rounded">
              {/* 在这里插入你的曲线/图表组件 */}
              <p className="text-sm text-slate-500">谷峰律动波段图表 (波峰: {data?.peak} | 波谷: {data?.valley})</p>
            </div>
          </div>

          {/* 右侧：今日信号与状态 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h2 className="text-lg font-semibold mb-3">今日律动诊断</h2>
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="text-xs text-slate-400 mb-1">当前信号状态</div>
                <div className="text-xl font-bold text-emerald-400">
                  {data?.rhythmPos < 20 ? '临谷 (超卖区间)' : data?.rhythmPos > 80 ? '临峰 (超买区间)' : '律动区间震荡'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}