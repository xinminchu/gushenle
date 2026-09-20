'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw } from 'lucide-react';

interface Cool30GameProps {
  onClose: () => void;
}

export default function Cool30Game({ onClose }: Cool30GameProps) {
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [gameOver, setGameOver] = useState(false);

  // 砖块列表
  const [bricks, setBricks] = useState([
    { id: 1, text: '冲动追高' },
    { id: 2, text: '凭感觉打' },
    { id: 3, text: '听信喊单' },
    { id: 4, text: '频繁交易' },
    { id: 5, text: '恐慌割肉' },
    { id: 6, text: '盲目加仓' },
  ]);

  useEffect(() => {
    if (timeLeft <= 0) {
      setGameOver(true);
      return;
    }
    const timer = setInterval(() => setTimeLeft((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const hitBrick = (id: number) => {
    if (gameOver) return;
    setScore((prev) => prev + 1);
    setBricks((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col justify-between p-4 overflow-hidden touch-none">
      {/* 顶栏 */}
      <div className="flex justify-between items-center bg-slate-900/90 border border-slate-800 p-3 rounded-xl mt-2">
        <div className="text-xs">
          <span className="text-slate-400">击碎情绪砖块: </span>
          <span className="text-emerald-400 font-bold text-sm ml-1">{score}</span>
        </div>
        <div className="text-xs">
          <span className="text-slate-400">沉思倒计时: </span>
          <span className="text-amber-400 font-bold text-sm ml-1">{timeLeft}s</span>
        </div>
        <button onClick={onClose} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 游戏画布区 */}
      <div className="relative flex-1 my-4 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-4 flex flex-col justify-between items-center overflow-hidden">
        {!gameOver ? (
          <>
            {/* 砖块阵列 */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {bricks.map((brick) => (
                <button
                  key={brick.id}
                  onClick={() => hitBrick(brick.id)}
                  className="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold py-3 rounded-xl active:scale-90 transition-transform shadow"
                >
                  🧱 {brick.text}
                </button>
              ))}
            </div>

            {/* 底部沉思弹板 */}
            <div className="w-32 h-4 bg-emerald-500 rounded-full shadow-lg shadow-emerald-500/30 animate-pulse mt-auto mb-4"></div>
          </>
        ) : (
          <div className="my-auto flex flex-col items-center justify-center space-y-4 text-center">
            <h2 className="text-xl font-bold text-emerald-400">冷静沉思完成！</h2>
            <p className="text-xs text-slate-300">
              30 秒沉思撞球结束，成功清空 <span className="text-amber-400 font-bold">{score}</span> 个交易杂念！
            </p>
            <button
              onClick={() => {
                setScore(0);
                setTimeLeft(30);
                setBricks([
                  { id: 1, text: '冲动追高' },
                  { id: 2, text: '凭感觉打' },
                  { id: 3, text: '听信喊单' },
                  { id: 4, text: '频繁交易' },
                  { id: 5, text: '恐慌割肉' },
                  { id: 6, text: '盲目加仓' },
                ]);
                setGameOver(false);
              }}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-xs px-4 py-2 rounded-xl font-medium"
            >
              <RefreshCw className="w-4 h-4" /> 再撞一次
            </button>
          </div>
        )}
      </div>

      <div className="text-center text-[10px] text-slate-500 pb-2">
        💡 点击砖块触发撞球反弹，把所有冲动杂念通通撞碎
      </div>
    </div>
  );
}