'use client';

import React, { useState } from 'react';
import { X, TrendingUp, TrendingDown, HelpCircle, RefreshCw } from 'lucide-react';

interface KLineBoxGameProps {
  onClose: () => void;
}

export default function KLineBoxGame({ onClose }: KLineBoxGameProps) {
  const [revealed, setRevealed] = useState(false);
  const [guess, setGuess] = useState<'up' | 'down' | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  // 盲盒数据
  const currentCase = {
    symbol: 'NVDA (2023.10)',
    pattern: '蓄势回调末期，动能分化',
    actualOutcome: 'up',
    desc: '在经过两周横盘震荡后，由于 AI 芯片强劲需求，后市开启了强劲主升浪[cite: 1]。',
  };

  const handleGuess = (choice: 'up' | 'down') => {
    setGuess(choice);
    setIsCorrect(choice === currentCase.actualOutcome);
    setRevealed(true);
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col justify-between p-4 overflow-hidden touch-none">
      <div className="flex justify-between items-center bg-slate-900/90 border border-slate-800 p-3 rounded-xl mt-2">
        <h3 className="text-xs font-bold text-slate-100 flex items-center gap-1">
          <HelpCircle className="w-4 h-4 text-emerald-400" /> 历史 K 线盲盒[cite: 1]
        </h3>
        <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="my-auto space-y-4">
        {/* K 线图形展现卡片 */}
        <div className="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl text-center space-y-3">
          <p className="text-xs text-slate-400">匿名标的形态：<span className="text-slate-200 font-bold">{currentCase.pattern}</span></p>
          
          {/* 模拟盲盒 K 线走向视觉 */}
          <div className="h-32 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center p-4">
            <div className="flex items-end gap-2 h-20">
              <div className="w-3 bg-emerald-500 h-10 rounded-t"></div>
              <div className="w-3 bg-rose-500 h-14 rounded-t"></div>
              <div className="w-3 bg-emerald-500 h-8 rounded-t"></div>
              <div className="w-3 bg-slate-700 h-12 rounded-t animate-pulse"></div>
              <div className="text-xl ml-2 font-bold text-amber-400">❓</div>
            </div>
          </div>

          {!revealed ? (
            <p className="text-xs text-slate-300">凭定力猜测：接下来 5 个交易日将如何走？[cite: 1]</p>
          ) : (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className={`text-sm font-bold ${isCorrect ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isCorrect ? '🎉 猜对了！定力极佳！' : '😅 猜错了！盲目冲动啦！'}
              </span>
              <p className="text-xs text-slate-400">{currentCase.symbol}：{currentCase.desc}</p>
            </div>
          )}
        </div>

        {/* 猜测按钮 */}
        {!revealed ? (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleGuess('up')}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-lg active:scale-95 transition-all"
            >
              <TrendingUp className="w-4 h-4" /> 突破上涨
            </button>
            <button
              onClick={() => handleGuess('down')}
              className="bg-rose-600 hover:bg-rose-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-1.5 text-xs shadow-lg active:scale-95 transition-all"
            >
              <TrendingDown className="w-4 h-4" /> 下跌回调
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setRevealed(false);
              setGuess(null);
            }}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-3 rounded-xl flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> 抽取下一张盲盒
          </button>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-500 pb-2">
        💡 真实历史数据模拟，帮助建立对 K 线走势的理性感知[cite: 1]
      </div>
    </div>
  );
}