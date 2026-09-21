// src/components/RhythmDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';

export default function RhythmDashboard() {
  const [symbol, setSymbol] = useState('AAPL');
  const [range, setRange] = useState('1M');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 监听 symbol 与 range 变化，实时请求 API
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/rhythm?symbol=${symbol}&range=${range}`);
        const json = await res.json();
        if (!json.error) {
          setData(json);
        }
      } catch (err) {
        console.error('获取律动数据失败:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [symbol, range]);

  return (
    <div className="w-full space-y-6">
      {/* 顶部标题与股票切换按钮 - 解决竖排问题：移动端 flex-col 上下排，PC端 flex-row 左右排 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 whitespace-nowrap">
          今日看板 · 谷峰律动
        </h1>

        {/* 股票切换按钮组 */}
        <div className="flex flex-wrap gap-2">
          {['AAPL', 'NVDA', 'TSLA', 'MSFT'].map((item) => (
            <button
              key={item}
              onClick={() => setSymbol(item)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                symbol === item
                  ? 'bg-blue-600 text-white font-medium shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {/* 看板核心区域 */}
      {loading ? (
        <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
          加载 {symbol} 真实律动数据中...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧主要数据图表 */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
            {/* 价格与时间范围 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="text-3xl font-extrabold text-slate-100">
                  ${data?.latestPrice}
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  律动分位数: <span className="text-blue-400 font-bold">{data?.rhythmPos}%</span>
                </div>
              </div>

              {/* 时间范围切换 */}
              <div className="flex bg-slate-800 rounded-lg p-1 text-xs self-start sm:self-auto">
                {['1W', '1M', '3M', '1Y'].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      range === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* 图表展示框 */}
            <div className="h-64 w-full bg-slate-950/50 border border-slate-800/80 rounded-lg p-4 flex flex-col justify-between">
              <div className="flex justify-between text-xs text-slate-400 border-b border-slate-800 pb-2">
                <span>波峰 (Peak): <strong className="text-rose-400">${data?.peak}</strong></span>
                <span>波谷 (Valley): <strong className="text-emerald-400">${data?.valley}</strong></span>
              </div>
              
              {/* 这里可以保留简单的趋势线条或后期接入 ECharts */}
              <div className="my-auto text-center text-xs text-slate-500">
                {data?.symbol} 阶段区间: ${data?.valley} ~${data?.peak}
              </div>

              <div className="text-right text-[10px] text-slate-600">
                更新数据点: {data?.series?.length || 0} 天
              </div>
            </div>
          </div>

          {/* 右侧：律动诊断与信号 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
            <div>
              <h2 className="text-base font-semibold mb-3 text-slate-200">今日律动诊断</h2>
              <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
                <div className="text-xs text-slate-400 mb-1">当前信号状态</div>
                <div className={`text-lg font-bold ${
                  data?.rhythmPos < 20 
                    ? 'text-emerald-400' 
                    : data?.rhythmPos > 80 
                    ? 'text-rose-400' 
                    : 'text-blue-400'
                }`}>
                  {data?.rhythmPos < 20
                    ? '临谷 (超卖触底)'
                    : data?.rhythmPos > 80
                    ? '临峰 (超买冲高)'
                    : '律动区间震荡'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}