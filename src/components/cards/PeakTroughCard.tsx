'use client';

import React, { useEffect, useState } from 'react';

interface PeakTroughData {
  index: number;
  price: number;
  type: 'peak' | 'trough';
}

export default function PeakTroughCard() {
  const [prices, setPrices] = useState<number[]>([]);
  const [points, setPoints] = useState<PeakTroughData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. 请求数据
    fetch('/api/stock')
      .then((res) => res.json())
      .then((resData) => {
        const data: number[] = resData.data;
        setPrices(data);

        // 2. 波峰波谷计算算法 (Swing High / Swing Low)
        const detected: PeakTroughData[] = [];
        for (let i = 2; i < data.length - 2; i++) {
          if (data[i] > data[i - 1] && data[i] > data[i - 2] && data[i] > data[i + 1] && data[i] > data[i + 2]) {
            detected.push({ index: i, price: data[i], type: 'peak' });
          } else if (data[i] < data[i - 1] && data[i] < data[i - 2] && data[i] < data[i + 1] && data[i] < data[i + 2]) {
            detected.push({ index: i, price: data[i], type: 'trough' });
          }
        }
        setPoints(detected);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 text-center animate-pulse">
        加载波峰波谷分析数据中...
      </div>
    );
  }

  const latestPeak = points.filter((p) => p.type === 'peak').pop();
  const latestTrough = points.filter((p) => p.type === 'trough').pop();

  return (
    <div className="w-full max-w-md bg-slate-900/90 border border-slate-800 rounded-xl p-4 mt-4 text-white shadow-lg">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-3">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
          📈 波峰波谷决策卡片
        </h3>
        <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded border border-slate-700">
          极值智能识别
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs mb-3">
        <div className="bg-slate-950 p-2.5 rounded-lg border border-red-500/20">
          <div className="text-slate-400 text-[10px]">近期阻力波峰 (Peak)</div>
          <div className="text-base font-bold text-red-400 mt-0.5">
            {latestPeak ? `$${latestPeak.price}` : '计算中...'}
          </div>
        </div>
        <div className="bg-slate-950 p-2.5 rounded-lg border border-emerald-500/20">
          <div className="text-slate-400 text-[10px]">近期支撑波谷 (Trough)</div>
          <div className="text-base font-bold text-emerald-400 mt-0.5">
            {latestTrough ? `$${latestTrough.price}` : '计算中...'}
          </div>
        </div>
      </div>

      {/* 近期价格走势简明预览 */}
      <div className="text-[11px] text-slate-400">
        最新检测到 <span className="text-slate-200 font-semibold">{points.length}</span> 个关键转向点。结合情绪调节：
        <p className="text-[10px] text-emerald-400/90 mt-1">
          💡 “波峰不追高，波谷不恐慌，冷静操作是第一准则。”
        </p>
      </div>
    </div>
  );
}