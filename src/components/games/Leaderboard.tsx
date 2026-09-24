'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { GAME_NAMES, GameId } from '@/lib/gameStats';

/**
 * 🏆 英雄榜：全站游戏次数/总分/总排名 + 分游戏排行。
 * 数据走 /api/leaderboard（service_role 聚合，只含登录玩家）。
 * 接口不可用（没配 key / 表空）时整个组件自动隐藏。
 */

interface GameEntry {
  name: string;
  best: number;
  plays: number;
}
interface GlobalEntry {
  name: string;
  plays: number;
  score: number;
}
interface BoardData {
  totals: { plays: number; players: number; score: number };
  globalTop: GlobalEntry[];
  perGame: Record<string, GameEntry[]>;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n: number) => n.toLocaleString('en-US');

export default function Leaderboard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [tab, setTab] = useState<'all' | GameId>('all');

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((j) => {
        if (j && j.ok && j.totals) setData(j as BoardData);
      })
      .catch(() => {});
  }, []);

  if (!data) return null;

  const gameIds = (Object.keys(GAME_NAMES) as GameId[]).filter(
    (id) => data.perGame[id] && data.perGame[id].length > 0
  );

  const rows: Array<{ name: string; left: string; right: string }> =
    tab === 'all'
      ? data.globalTop.map((e) => ({
          name: e.name,
          left: `累计 ${fmt(e.score)} 分`,
          right: `${fmt(e.plays)} 次`,
        }))
      : (data.perGame[tab] || []).map((e) => ({
          name: e.name,
          left: `最高 ${fmt(e.best)} 分`,
          right: `${fmt(e.plays)} 次`,
        }));

  return (
    <section className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h2 className="text-sm font-bold text-slate-100">英雄榜</h2>
      </div>
      <p className="text-[11px] text-slate-400 mb-2.5">
        全站累计 <span className="text-amber-300 font-bold">{fmt(data.totals.plays)}</span> 次游玩
        · <span className="text-amber-300 font-bold">{fmt(data.totals.players)}</span> 位玩家
        · 累计 <span className="text-amber-300 font-bold">{fmt(data.totals.score)}</span> 分
      </p>

      <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-0.5 px-0.5">
        <button
          onClick={() => setTab('all')}
          className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition ${
            tab === 'all'
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
              : 'bg-slate-800 border-slate-700 text-slate-400'
          }`}
        >
          总榜
        </button>
        {gameIds.map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition ${
              tab === id
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 font-bold'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
          >
            {GAME_NAMES[id]}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-slate-500 py-2 text-center">还没人上榜，快来当第一个吧</p>
      ) : (
        <ol className="divide-y divide-slate-800/80">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center gap-2 py-1.5">
              <span className="w-6 text-center text-sm shrink-0">
                {MEDALS[i] || <span className="text-[11px] text-slate-500">{i + 1}</span>}
              </span>
              <span className="flex-1 text-xs text-slate-200 truncate">{r.name}</span>
              <span className="text-[11px] text-amber-300/90 font-semibold shrink-0">{r.left}</span>
              <span className="text-[10px] text-slate-500 shrink-0 w-14 text-right">{r.right}</span>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[10px] text-slate-600 mt-2">登录玩家自动上榜 · 游客分数只保存在本机</p>
    </section>
  );
}
