'use client';

import React, { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';

interface ClipperGameProps {
  onClose: () => void;
}

export default function ClipperGame({ onClose }: ClipperGameProps) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameOver, setGameOver] = useState(false);

  // 模拟情绪词汇
  const [words, setWords] = useState([
    { id: 1, text: '梭哈追高', x: 20, y: 30 },
    { id: 2, text: 'FOMO 情绪', x: 60, y: 50 },
    { id: 3, text: '盲目听信', x: 30, y: 70 },
  ]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const handleCut = (id: number) => {
    if (gameOver) return;
    setScore((prev) => prev + 1);
    setWords((prev) => prev.filter((w) => w.id !== id));

    // 随机生成新词
    setTimeout(() => {
      const newWordList = ['盲目加仓', '恐慌割肉', '听说必涨', '凭感觉打', '听信喊单'];
      const randomText = newWordList[Math.floor(Math.random() * newWordList.length)];
      setWords((prev) => [
        ...prev,
        {
          id: Date.now(),
          text: randomText,
          x: Math.floor(Math.random() * 70) + 10,
          y: Math.floor(Math.random() * 60) + 20,
        },
      ]);
    }, 300);
  };

  return (
    // 使用 fixed inset-0 铺满全屏，z-[10000] 覆盖在导航栏之上
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col justify-between p-4 overflow-hidden touch-none">
      {/* 游戏顶部 Bar */}
      <div className="flex justify-between items-center bg-slate-900/90 border border-slate-800 p-3 rounded-xl mt-2">
        <div className="text-xs">
          <span className="text-slate-400">已割韭菜情绪: </span>
          <span className="text-emerald-400 font-bold text-sm ml-1">{score}</span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400">倒计时: </span>
          <span className="text-amber-400 font-bold text-sm ml-1">{timeLeft}s</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 游戏主画布区域 */}
      <div className="relative flex-1 my-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl overflow-hidden">
        {!gameOver ? (
          words.map((item) => (
            <button
              key={item.id}
              onClick={() => handleCut(item.id)}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              className="absolute bg-rose-500/20 border border-rose-500/50 text-rose-300 text-xs font-bold px-3 py-2 rounded-xl active:scale-95 transition-transform animate-bounce shadow-lg"
            >
              ✂️ {item.text}
            </button>
          ))
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4 bg-slate-950/90">
            <h2 className="text-xl font-bold text-emerald-400">解压成功！</h2>
            <p className="text-xs text-slate-300">
              你成功粉碎了 <span className="text-amber-400 font-bold">{score}</span> 个冲动情绪！
            </p>
            <button
              onClick={() => {
                setScore(0);
                setTimeLeft(30);
                setGameOver(false);
              }}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-4 py-2 rounded-xl font-medium"
            >
              <RefreshCw className="w-4 h-4" /> 再玩一次
            </button>
          </div>
        )}
      </div>

      {/* 游戏底部提示 */}
      <div className="text-center text-[10px] text-slate-500 pb-2">
        💡 点击/划过情绪词汇将其粉碎，冷静后再做交易决策
      </div>
    </div>
  );
}