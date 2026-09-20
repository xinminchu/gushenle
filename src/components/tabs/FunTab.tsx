'use client';

import React, { useState } from 'react';
import { Gamepad2, Play, Flame } from 'lucide-react';
import ClipperGame from '../games/ClipperGame';
import Cool30Game from '../games/Cool30Game';
import BigTechGame from '../games/BigTechGame';
import KLineBoxGame from '../games/KLineBoxGame';

export default function FunTab() {
  const [activeGame, setActiveGame] = useState<string | null>(null);

  const games = [
    {
      id: 'clipper',
      name: '韭菜割割乐 (Clipper Party)',
      desc: '划线切碎“追高”、“梭哈”等冲动情绪词汇，30秒强行解压[cite: 1]。',
      level: '🟢 极低',
      hot: true,
    },
    {
      id: 'cool30',
      name: '沉思撞球 30 秒',
      desc: '经典 H5 弹砖块解压小游戏，过热/追高冲动时的冷静降温神器[cite: 1]。',
      level: '🟢 极低',
      hot: true,
    },
    {
      id: 'bigtech',
      name: '美股巨头大乱斗',
      desc: '4x4 矩阵消除，边消边看美股巨头冷知识[cite: 1]。',
      level: '🟡 中等',
    },
    {
      id: 'kline',
      name: '历史 K 线盲盒',
      desc: '抽取真实历史 K 线，盲猜涨跌测试投资定力[cite: 1]。',
      level: '🟡 中等',
    },
  ];

  return (
    <div className="p-4 space-y-5 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">娱乐乐 Fun Play</h1>
        <p className="text-xs text-slate-400 mt-0.5">随时想解压、想玩盲盒时点进来，建立理性投资心态[cite: 1]</p>
      </header>

      {/* 游戏列表 */}
      <div className="space-y-3">
        {games.map((game) => (
          <div
            key={game.id}
            className="bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-4 space-y-3 transition-all"
          >
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-100 text-sm">{game.name}</h3>
                  {game.hot && (
                    <span className="bg-amber-500/20 text-amber-400 text-[9px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> 热门
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">{game.desc}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-1 border-t border-slate-700/40">
              <span className="text-[10px] text-slate-500">AI 难度: {game.level}</span>
              <button
                onClick={() => {
                  setActiveGame(game.id);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors"
              >
                <Play className="w-3 h-3 fill-current" /> 立即开始
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 4 大全屏小游戏弹窗挂载 */}
      {activeGame === 'clipper' && <ClipperGame onClose={() => setActiveGame(null)} />}
      {activeGame === 'cool30' && <Cool30Game onClose={() => setActiveGame(null)} />}
      {activeGame === 'bigtech' && <BigTechGame onClose={() => setActiveGame(null)} />}
      {activeGame === 'kline' && <KLineBoxGame onClose={() => setActiveGame(null)} />}
    </div>
  );
}