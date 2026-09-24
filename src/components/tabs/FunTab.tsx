'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Flame, X, Trophy } from 'lucide-react';
import { loadStats, recordPlay, recordSession, type GameId, type GameStat } from '@/lib/gameStats';
import { useAuth } from '@/context/AuthContext';
import WishPool from '../games/WishPool';
import Leaderboard from '../games/Leaderboard';

// 游戏按需加载：点开哪个才下载哪个，不拖慢首页
const ClipperGame = dynamic(() => import('../games/ClipperGame'), { ssr: false });
const Cool30Game = dynamic(() => import('../games/Cool30Game'), { ssr: false });
const BigTechGame = dynamic(() => import('../games/BigTechGame'), { ssr: false });
const KLineBoxGame = dynamic(() => import('../games/KLineBoxGame'), { ssr: false });
const CutLossGame = dynamic(() => import('../games/CutLossGame'), { ssr: false });
const HoldBackGame = dynamic(() => import('../games/HoldBackGame'), { ssr: false });
const NewsTrapGame = dynamic(() => import('../games/NewsTrapGame'), { ssr: false });
const DcaGame = dynamic(() => import('../games/DcaGame'), { ssr: false });
const DartGame = dynamic(() => import('../games/DartGame'), { ssr: false });
const MoleGame = dynamic(() => import('../games/MoleGame'), { ssr: false });
const EncyclopediaGame = dynamic(() => import('../games/EncyclopediaGame'), { ssr: false });

export default function FunTab() {
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<GameId, GameStat> | null>(null);
  const { user } = useAuth();

  // 打开游戏即记一次游玩（统一口径）
  const openGame = (id: string) => {
    recordSession(id as GameId);
    setStats(loadStats());
    setActiveGame(id);
  };

  // 每次进入娱乐页刷新战绩；监听 iframe 游戏的结算事件
  useEffect(() => {
    setStats(loadStats());
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; game?: string; score?: number } | null;
      if (!d || d.type !== 'gushenle-game-event' || !d.game) return;
      const game = d.game as GameId;
      if (game === 'clipper' || game === 'cool30' || game === 'bigtech') {
        recordPlay(game, d.score || 0);
        setStats(loadStats());
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // 关闭游戏弹窗后刷新战绩（kline 的落袋/自动结算发生在卸载时）
  useEffect(() => {
    if (activeGame === null) setStats(loadStats());
  }, [activeGame]);

  const games: {
    id: string;
    name: string;
    icon: string;
    level: string;
    hot?: boolean;
    credit?: string;
  }[] = [
    {
      id: 'clipper',
      name: '韭菜咯咯乐',
      icon: '✂️',
      level: '🟢 极低',
      hot: true,
    },
    {
      id: 'cool30',
      name: '沉思撞球 30 秒',
      icon: '🎱',
      level: '🟢 极低',
      hot: true,
    },
    {
      id: 'bigtech',
      name: '美股巨头大乱斗',
      icon: '🏢',
      level: '🟡 中等',
    },
    {
      id: 'kline',
      name: '历史 K 线盲盒',
      icon: '📦',
      level: '🟡 中等',
    },
    {
      id: 'cutloss',
      name: '割肉还是卧倒',
      icon: '🔪',
      level: '🟡 中等',
      hot: true,
    },
    {
      id: 'holdback',
      name: '忍住别追高',
      icon: '🚫',
      level: '🟡 中等',
      hot: true,
    },
    {
      id: 'newstrap',
      name: '消息面陷阱',
      icon: '📰',
      level: '🟡 中等',
    },
    {
      id: 'dca',
      name: '定投 vs 梭哈',
      icon: '💰',
      level: '🟢 极低',
    },
    {
      id: 'dart',
      name: '飞镖选股',
      icon: '🎯',
      level: '🟢 极低',
      hot: true,
      credit: '@大西洋龙虾',
    },
    {
      id: 'mole',
      name: '高管打地鼠',
      icon: '🔨',
      level: '🟢 极低',
      hot: true,
      credit: '@麻牛',
    },
    {
      id: 'encyclopedia',
      name: '股票大百科',
      icon: '📚',
      level: '🟢 极低',
      hot: true,
      credit: '@ecfollower',
    },
  ];

  const getGameTitle = (id: string | null) => {
    const game = games.find((g) => g.id === id);
    return game ? game.name : '小游戏';
  };

  // 按游玩次数排序，玩得多的排前面
  const sortedGames = [...games].sort(
    (a, b) => (stats?.[b.id as GameId]?.plays || 0) - (stats?.[a.id as GameId]?.plays || 0)
  );

  // 列数自适应：9 个及以内 3 列（9 个正好 3x3），超过 9 个换 4 列
  const cols = sortedGames.length > 9 ? 4 : 3;
  const compact = cols === 4;

  return (
    <div className="p-4 space-y-5 pb-24 max-w-md mx-auto relative">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">娱乐乐 Fun Play</h1>
        <p className="text-xs text-slate-400 mt-0.5">
          随时想解压、想玩盲盒时点进来，建立理性投资心态
        </p>
        {!user && (
          <p className="text-[11px] text-amber-400/90 mt-1.5 flex items-center gap-1">
            <Trophy className="w-3 h-3 shrink-0" />
            游客模式：分数只保存在这台设备，登录后跟你走
          </p>
        )}
      </header>

      {/* 🏆 英雄榜：全站次数/总分/排行 */}
      <Leaderboard />

      {/* 游戏小方块 */}
      <div className={`grid ${cols === 4 ? 'grid-cols-4' : 'grid-cols-3'} gap-2`}>
        {sortedGames.map((game) => {
          const st = stats?.[game.id as GameId];
          return (
            <button
              key={game.id}
              onClick={() => openGame(game.id)}
              className={`relative bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 active:scale-[0.97] rounded-xl text-left transition-all ${
                compact ? 'p-2' : 'p-3'
              }`}
            >
              {game.hot && (
                <span className="absolute top-1.5 right-1.5 bg-amber-500/20 text-amber-400 text-[9px] px-1 py-0.5 rounded flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5" /> 热门
                </span>
              )}
              <div className={compact ? 'text-xl mb-1' : 'text-2xl mb-1.5'}>{game.icon}</div>
              <div
                className={`font-bold text-slate-100 leading-snug ${
                  compact ? 'text-[10px]' : 'text-xs'
                } ${game.hot ? 'pr-7' : ''}`}
              >
                {game.name}
              </div>
              {game.credit && (
                <div className="text-[9px] text-violet-300/80 mt-0.5 truncate">💡 {game.credit}</div>
              )}
              <div className="text-[10px] text-slate-500 mt-1 truncate">
                {st && st.plays > 0 ? (
                  compact ? (
                    <span className="flex items-center gap-0.5">
                      <Trophy className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                      {st.plays} 次
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                      玩了 {st.plays} 次 · {st.totalScore} 分
                    </span>
                  )
                ) : compact ? (
                  <span className="text-emerald-400/80">NEW</span>
                ) : (
                  '还没玩过，来试试'
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* 敬请期待 */}
      <div className="border border-dashed border-slate-700 rounded-xl py-4 px-3 text-center">
        <p className="text-xs text-slate-400">🌊 一大波精彩股票主题游戏正在赶来……</p>
        <p className="text-[10px] text-slate-600 mt-1">等不及？去下面的许愿池点一个，我们优先开发</p>
      </div>

      {/* 游戏许愿池 */}
      <WishPool />

      {/* 游戏全屏/Modal 弹窗容器 */}
      {activeGame && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* 弹窗顶部栏 */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700">
              <span className="font-bold text-slate-200 text-sm">
                {getGameTitle(activeGame)}
              </span>
              <button
                onClick={() => setActiveGame(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 游戏内容区 */}
            <div className="p-2 overflow-y-auto flex-1 flex justify-center items-center">
              {activeGame === 'clipper' && <ClipperGame />}
              {activeGame === 'cool30' && <Cool30Game />}
              {activeGame === 'bigtech' && <BigTechGame />}
              {activeGame === 'kline' && <KLineBoxGame />}
              {activeGame === 'cutloss' && <CutLossGame />}
              {activeGame === 'holdback' && <HoldBackGame />}
              {activeGame === 'newstrap' && <NewsTrapGame />}
              {activeGame === 'dca' && <DcaGame />}
              {activeGame === 'dart' && <DartGame />}
              {activeGame === 'mole' && <MoleGame />}
              {activeGame === 'encyclopedia' && <EncyclopediaGame />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}