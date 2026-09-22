// src/components/RhythmDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Flame } from 'lucide-react';
import RhythmChart from './RhythmChart';
import type { RhythmResponse } from '@/lib/rhythm';
import { statusForScore, scoreGradient } from '@/lib/rhythm';
import { useMarketAutoRefresh } from '@/hooks/useMarketAutoRefresh';

const SYMBOLS = ['AAPL', 'NVDA', 'TSLA', 'MSFT'];
const SYMBOL_NAMES: Record<string, string> = {
  AAPL: '苹果',
  NVDA: '英伟达',
  TSLA: '特斯拉',
  MSFT: '微软',
};
const RANGES = ['1W', '1M', '3M', '1Y'];
const RANGE_UNIT: Record<string, string> = { '1W': '周', '1M': '月', '3M': '季', '1Y': '年' };
const RANGE_LABEL: Record<string, string> = {
  '1W': '近 1 周',
  '1M': '近 1 月',
  '3M': '近 3 月',
  '1Y': '近 1 年',
};

export default function RhythmDashboard() {
  const [symbol, setSymbol] = useState('AAPL');
  const [range, setRange] = useState('1M');
  const [data, setData] = useState<RhythmResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // 收盘后自动刷新：页面开着过夜，第二天自动拉取最新收盘价
  const autoTick = useMarketAutoRefresh(
    data && data.series.length > 0 ? data.series[data.series.length - 1].date : undefined,
  );

  // 监听 symbol 与 range 变化，实时请求 API
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      setLoading(true);
      try {
        const res = await fetch(`/api/rhythm?symbol=${symbol}&range=${range}`);
        const json = (await res.json()) as RhythmResponse;
        if (!cancelled) setData(json);
      } catch (err) {
        console.error('获取律动数据失败:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [symbol, range, autoTick]);

  return (
    <div className="w-full space-y-6">
      {/* 顶部标题与股票切换按钮 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 whitespace-nowrap">
          今日看板 · 谷峰律动
        </h1>

        <div className="flex flex-wrap gap-2">
          {SYMBOLS.map((item) => (
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

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
          加载 {symbol} 真实律动数据中...
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：价格 + 真实走势图 */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-slate-100">${data.price}</span>
                  <span
                    className={`text-sm font-semibold ${
                      data.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {data.changePct >= 0 ? '+' : ''}
                    {data.changePct}%{range}
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-400">
                  律动分位数:{' '}
                  <span className="text-blue-400 font-bold">{data.rhythmPos}%</span>
                  {data.source === 'simulated' && (
                    <span className="ml-2 text-amber-400/80">(演示数据)</span>
                  )}
                </div>
              </div>

              <div className="flex bg-slate-800 rounded-lg p-1 text-xs self-start sm:self-auto">
                {RANGES.map((r) => (
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

            {/* 真实走势图 */}
            <RhythmChart series={data.series} height={240} />

            {/* 谷峰位置条：当前价在波谷-波峰区间中的位置 */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>
                  谷底 <strong className="text-emerald-400">${data.valley.price}</strong>
                  <span className="text-slate-500"> {data.valley.date}</span>
                </span>
                <span>
                  峰顶 <strong className="text-rose-400">${data.peak.price}</strong>
                  <span className="text-slate-500"> {data.peak.date}</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-rose-500">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-900 shadow"
                  style={{ left: `calc(${Math.min(100, Math.max(0, data.rhythmPos))}% - 8px)` }}
                />
              </div>
              <div className="mt-1.5 text-right text-[10px] text-slate-600">
                更新数据点: {data.series.length} 天 · 数据更新于{' '}
                {new Date(data.updatedAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>

          {/* 右侧：律动诊断（动量卡片逻辑：大分数 + 状态 + 价格 + 动量条） */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold mb-3 text-slate-200">
              律动诊断
              <span className="ml-2 text-xs font-normal text-slate-400">
                按{RANGE_LABEL[range] ?? range}区间计算
              </span>
            </h2>
            <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-100 text-lg">{symbol}</span>
                    <span className="text-xs text-slate-400">{SYMBOL_NAMES[symbol]}</span>
                    {data.rhythmPos >= 80 && (
                      <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                        <Flame className="w-3 h-3" /> 过热
                      </span>
                    )}
                    {data.source === 'simulated' && (
                      <span className="text-[10px] text-slate-500">演示数据</span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-3xl font-extrabold ${
                      data.rhythmPos >= 80 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {data.rhythmPos}
                  </div>
                  <div className="text-[10px] text-slate-400">{statusForScore(data.rhythmPos)}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-200 shrink-0">
                  ${data.price.toFixed(2)}
                </span>
                <span
                  className={`text-xs shrink-0 ${
                    data.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {data.changePct >= 0 ? '+' : ''}
                  {data.changePct}%/{RANGE_UNIT[range] ?? range}
                </span>
                <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${scoreGradient(
                      data.rhythmPos,
                    )} transition-all duration-700`}
                    style={{ width: `${data.rhythmPos}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400 leading-relaxed">
                {data.rhythmPos < 20 && '价格贴近区间谷底，情绪偏冷，适合回顾买入逻辑。'}
                {data.rhythmPos >= 20 &&
                  data.rhythmPos <= 80 &&
                  '价格在谷峰之间律动，按既定节奏持有即可。'}
                {data.rhythmPos > 80 && '价格逼近区间峰顶，情绪偏热，警惕追高冲动。'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
          数据加载失败，请稍后重试
        </div>
      )}
    </div>
  );
}
