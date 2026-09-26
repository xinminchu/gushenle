'use client';

import { useEffect, useState } from 'react';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';
import { GAME_NAMES, GAME_ICONS, GameId } from '@/lib/gameStats';

/**
 * 🏆 英雄榜：全站游戏次数/总分/总排名 + 分游戏排行。
 * 数据走 /api/leaderboard（service_role 聚合，只含登录玩家）。
 * 接口不可用（没配 key / 表空）时整个组件自动隐藏。
 *
 * - 整块可收放（状态记本地，默认展开）
 * - 榜单切换用多排小图标网格（图标与娱乐页 tile 一一对应，见 GAME_ICONS），
 *   桌面端悬停出游戏名，手机端点选后下方显示当前榜单名
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
const OPEN_KEY = 'gushenle_leaderboard_open_v1';
const fmt = (n: number) => n.toLocaleString('en-US');
const ALL_ICON = '👑'; // 总榜图标（与 🏆 标题图标区分）

function IconTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`group relative shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center transition active:scale-95 ${
        active
          ? 'bg-amber-500/20 border-amber-500/60 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
          : 'bg-slate-800/80 border-slate-700/80 hover:border-slate-500'
      }`}
    >
      <span className="text-xl leading-none">{icon}</span>
      {/* 桌面端悬停提示游戏名 */}
      <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-700 px-1.5 py-0.5 text-[10px] text-slate-100 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 z-10 hidden sm:block">
        {label}
      </span>
    </button>
  );
}

export default function Leaderboard() {
  const [data, setData] = useState<BoardData | null>(null);
  const [tab, setTab] = useState<'all' | GameId>('all');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(OPEN_KEY);
      if (v !== null) setOpen(v === '1');
    } catch {}
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((j) => {
        if (j && j.ok && j.totals) setData(j as BoardData);
      })
      .catch(() => {});
  }, []);

  const toggleOpen = () => {
    setOpen((v) => {
      try {
        localStorage.setItem(OPEN_KEY, v ? '0' : '1');
      } catch {}
      return !v;
    });
  };

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

  const tabLabel =
    tab === 'all' ? (
      <>
        {ALL_ICON} 总榜 <span className="text-slate-500 font-normal">· 按累计分</span>
      </>
    ) : (
      <>
        {GAME_ICONS[tab]} {GAME_NAMES[tab]}{' '}
        <span className="text-slate-500 font-normal">· 按最高分</span>
      </>
    );

  return (
    <section className="bg-slate-900/60 border border-slate-700/60 rounded-2xl p-3.5">
      {/* 头部：点整行收放 */}
      <button onClick={toggleOpen} className="w-full flex items-center gap-1.5 text-left">
        <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
        <h2 className="text-sm font-bold text-slate-100">英雄榜</h2>
        <span className="text-[10px] text-slate-500 truncate ml-1">
          {fmt(data.totals.players)} 位玩家 · 累计 {fmt(data.totals.score)} 分
        </span>
        <span className="ml-auto text-slate-500 shrink-0">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <>
          <p className="text-[11px] text-slate-400 mt-1 mb-2.5">
            全站累计 <span className="text-amber-300 font-bold">{fmt(data.totals.plays)}</span>{' '}
            次游玩 · <span className="text-amber-300 font-bold">{fmt(data.totals.players)}</span>{' '}
            位玩家 · 累计{' '}
            <span className="text-amber-300 font-bold">{fmt(data.totals.score)}</span> 分
          </p>

          {/* 榜单切换：多排小图标，无横向滚动 */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <IconTab
              icon={ALL_ICON}
              label="总榜"
              active={tab === 'all'}
              onClick={() => setTab('all')}
            />
            {gameIds.map((id) => (
              <IconTab
                key={id}
                icon={GAME_ICONS[id]}
                label={GAME_NAMES[id]}
                active={tab === id}
                onClick={() => setTab(id)}
              />
            ))}
          </div>

          {/* 当前榜单名（手机无悬停时看这里） */}
          <p className="text-[11px] text-slate-300 font-semibold mb-1">{tabLabel}</p>

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
                  <span className="text-[11px] text-amber-300/90 font-semibold shrink-0">
                    {r.left}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 w-14 text-right">
                    {r.right}
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="text-[10px] text-slate-600 mt-2">登录玩家自动上榜 · 游客分数只保存在本机</p>
        </>
      )}
    </section>
  );
}
