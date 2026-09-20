'use client';

import React, { useState } from 'react';
import { X, Sparkles, RefreshCw } from 'lucide-react';

interface BigTechGameProps {
  onClose: () => void;
}

export default function BigTechGame({ onClose }: BigTechGameProps) {
  const [score, setScore] = useState(0);
  const [fact, setFact] = useState('点击相同的巨头图标进行消除！');

  const techList = [
    { name: 'NVDA', icon: '🟢', fact: '英伟达最初成立于一家 Denny\'s 餐厅内[cite: 1]。' },
    { name: 'AAPL', icon: '🍎', fact: '苹果公司最初的 LOGO 包含牛顿在苹果树下的画像[cite: 1]。' },
    { name: 'MSFT', icon: '💻', fact: '微软 1985 年推出的 Windows 1.0 售价仅 99 美元[cite: 1]。' },
    { name: 'TSLA', icon: '⚡', fact: '特斯拉以发明家尼古拉·特斯拉的名字命名[cite: 1]。' },
  ];

  const handleTileClick = (tech: typeof techList[0]) => {
    setScore((prev) => prev + 10);
    setFact(tech.fact);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col justify-between p-4 overflow-hidden touch-none">
      <div className="flex justify-between items-center bg-slate-900/90 border border-slate-800 p-3 rounded-xl mt-2">
        <div className="text-xs">
          <span className="text-slate-400">消除积分: </span>
          <span className="text-emerald-400 font-bold text-sm ml-1">{score}</span>
        </div>
        <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 巨头 4x4 矩阵 */}
      <div className="my-auto space-y-4">
        <div className="bg-slate-900/80 border border-slate-800 p-3 rounded-xl text-center">
          <p className="text-xs text-amber-400 font-medium flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> 巨头冷知识
          </p>
          <p className="text-xs text-slate-300 mt-1">{fact}</p>
        </div>

        <div className="grid grid-cols-4 gap-2.5">
          {Array.from({ length: 16 }).map((_, idx) => {
            const item = techList[idx % techList.length];
            return (
              <button
                key={idx}
                onClick={() => handleTileClick(item)}
                className="bg-slate-800/90 border border-slate-700/80 hover:border-emerald-500 rounded-xl py-4 flex flex-col items-center justify-center active:scale-95 transition-transform"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-bold text-slate-300 mt-1">{item.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-center text-[10px] text-slate-500 pb-2">
        💡 美股巨头大乱斗：点击连消，解锁冷知识[cite: 1]
      </div>
    </div>
  );
}