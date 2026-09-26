'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  fillPicks,
  fetchScanPool,
  prepareBuyReveal,
  fmtPct,
  type BuyRevealItem,
} from './gameUtils';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'setup' | 'loading' | 'ready' | 'rolling' | 'bought' | 'reveal';

interface DieStyle {
  id: string;
  name: string;
  shape: 'square' | 'round';
  bg: string;
  pip: string;
}

const DIE_STYLES: DieStyle[] = [
  { id: 'classic', name: '经典白', shape: 'square', bg: '#f1f5f9', pip: '#1e293b' },
  { id: 'red', name: '中国红', shape: 'square', bg: '#dc2626', pip: '#ffffff' },
  { id: 'green', name: '赌场绿', shape: 'round', bg: '#16a34a', pip: '#ffffff' },
  { id: 'black', name: '墨玉黑', shape: 'round', bg: '#1e293b', pip: '#f8fafc' },
];

const PREF_KEY = 'gushenle_dice_pref_v1';

function loadPref(): { count: 1 | 2; style: string } {
  try {
    const j = JSON.parse(localStorage.getItem(PREF_KEY) || '{}') as {
      count?: number;
      style?: string;
    };
    return {
      count: j.count === 2 ? 2 : 1,
      style: DIE_STYLES.some((s) => s.id === j.style) ? (j.style as string) : 'classic',
    };
  } catch {
    return { count: 1, style: 'classic' };
  }
}

// 3x3 点阵：每面点数对应的格子下标
const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, style, size = 72 }: { value: number; style: DieStyle; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        background: style.bg,
        borderRadius: style.shape === 'round' ? '50%' : size * 0.18,
        boxShadow: '0 4px 14px rgba(0,0,0,0.45), inset 0 2px 4px rgba(255,255,255,0.25)',
      }}
      className="grid grid-cols-3 grid-rows-3 select-none"
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="flex items-center justify-center">
          {PIPS[value]!.includes(i) && (
            <div
              style={{
                background: style.pip,
                width: '68%',
                height: '68%',
                borderRadius: '50%',
                boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

const TIPS = [
  '💡 掷骰子选股听起来离谱，但"昨日"涨幅最大的那只往往是追高陷阱——骰子顺手帮你避开了人性。',
  '💡 骰子管进场，纪律管出场：掷中哪只全凭运气，拿住多久全看纪律。',
  '💡 买股全看天意，拿股全看纪律——骰子只负责前一半。',
];

type Pick = { symbol: string; name: string };

export default function DiceGame() {
  const pref = useRef(loadPref());
  const [diceCount, setDiceCount] = useState<1 | 2>(pref.current.count);
  const [styleId, setStyleId] = useState(pref.current.style);
  const [phase, setPhase] = useState<Phase>('setup');
  const [candidates, setCandidates] = useState<Pick[]>(() =>
    fillPicks(pref.current.count === 2 ? 12 : 6),
  );
  const [stocks, setStocks] = useState<BuyRevealItem[]>([]);
  const [dayLabel, setDayLabel] = useState('');
  const [qqq5, setQqq5] = useState(0);
  const [faces, setFaces] = useState<number[]>([1]);
  const [score, setScore] = useState(0);
  const [tip, setTip] = useState('');
  const [err, setErr] = useState('');
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const timerRef = useRef(0);

  const style = DIE_STYLES.find((s) => s.id === styleId) || DIE_STYLES[0]!;
  const need = diceCount === 2 ? 12 : 6;

  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ count: diceCount, style: styleId }));
    } catch {
      /* 忽略 */
    }
  }, [diceCount, styleId]);

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      if (scoreRef.current > 0) recordPlay('dice', scoreRef.current);
    };
  }, []);

  const changeCount = (c: 1 | 2) => {
    setDiceCount(c);
    setCandidates(fillPicks(c === 2 ? 12 : 6));
  };

  /** 发牌：拉取候选的"昨日"+后5天数据 */
  const deal = async (picks: Pick[]) => {
    setPhase('loading');
    setErr('');
    const n = picks.length;
    const r = await prepareBuyReveal(picks);
    if (!r || r.items.length < n) {
      setErr('行情数据没拉全，换个网络再试一次');
      setPhase('setup');
      return;
    }
    setCandidates(picks.slice(0, n));
    setStocks(r.items.slice(0, n));
    setDayLabel(r.dayLabel);
    setQqq5(r.qqq5);
    setFaces(diceCount === 2 ? [1, 1] : [1]);
    setPhase('ready');
  };

  const start = () => deal(candidates.slice(0, need));

  /** 从律动扫描池随机抽一批新鲜候选（抽不到就用股票库随机补） */
  const pickFresh = async (n: number, exclude: Set<string>): Promise<Pick[]> => {
    const pool = await fetchScanPool();
    const fresh: Pick[] = [];
    if (pool.length >= n) {
      const avail = pool.filter((p) => !exclude.has(p.symbol.toUpperCase()));
      const src = avail.length >= n ? avail : pool;
      const used = new Set<number>();
      while (fresh.length < n && used.size < src.length) {
        const i = Math.floor(Math.random() * src.length);
        if (used.has(i)) continue;
        used.add(i);
        fresh.push({ symbol: src[i]!.symbol, name: src[i]!.name });
      }
    }
    if (fresh.length < n) {
      // 扫描池不够：股票库随机补（fillPicks 已打乱）
      const fb = fillPicks(n + 20).filter((p) => !exclude.has(p.symbol));
      for (const p of fb) {
        if (fresh.length >= n) break;
        if (!fresh.some((f) => f.symbol === p.symbol)) fresh.push(p);
      }
    }
    return fresh;
  };

  /** 换一批：从律动扫描池（有律动分的股票）随机抽，抽不到就用股票库随机补 */
  const reshuffle = async () => {
    setPhase('loading');
    setErr('');
    const fresh = await pickFresh(need, new Set(candidates.map((c) => c.symbol)));
    if (fresh.length < need) {
      setErr('候选没凑齐，重试一次');
      setPhase('setup');
      return;
    }
    deal(fresh);
  };

  /** setup 页的换一批：只换预览，不拉行情 */
  const reshufflePreview = async () => {
    const fresh = await pickFresh(need, new Set(candidates.map((c) => c.symbol)));
    if (fresh.length >= need) setCandidates(fresh);
  };

  /** 掷骰子：1 颗=点数即第几只；2 颗=第一颗定区（1-3上半区/4-6下半区），第二颗定区内第几只 */
  const roll = () => {
    if (phase !== 'ready') return;
    setPhase('rolling');
    const n = diceCount === 2 ? 2 : 1;
    const finals = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * 6));
    let ticks = 0;
    timerRef.current = window.setInterval(() => {
      ticks++;
      setFaces(finals.map(() => 1 + Math.floor(Math.random() * 6)));
      if (ticks >= 14) {
        window.clearInterval(timerRef.current);
        setFaces(finals);
        setPhase('bought');
      }
    }, 90);
  };

  const pickIndex = (() => {
    if (phase !== 'bought' && phase !== 'reveal') return -1;
    if (diceCount === 2) {
      const zone = faces[0]! <= 3 ? 0 : 6;
      return zone + (faces[1]! - 1);
    }
    return faces[0]! - 1;
  })();
  const pick = pickIndex >= 0 ? stocks[pickIndex] : null;
  const win = pick ? pick.next5 > qqq5 : false;

  const reveal = () => {
    if (win) setScore((v) => v + 100);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setPhase('reveal');
  };

  const numLabel = (i: number) =>
    ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'][i];

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🎲 掷骰子买股</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史行情 · 天意选股挑战 · 本局 {score} 分
        </div>
      </div>

      {phase === 'setup' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            买股全看天意：候选股票一字排开，
            <span className="text-slate-100 font-semibold">掷出几点就"买入"第几只</span>，
            再看它后 5 天能不能跑赢大盘。骰子从不追高，也从不割肉。
          </p>

          {/* 骰子数量 */}
          <div>
            <p className="text-[11px] text-slate-400 mb-1.5 px-1">骰子数量</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { c: 1 as const, label: '1 颗骰子', desc: '6 只候选' },
                  { c: 2 as const, label: '2 颗骰子', desc: '12 只候选 · 第一颗定区' },
                ]
              ).map((o) => (
                <button
                  key={o.c}
                  onClick={() => changeCount(o.c)}
                  className={`rounded-xl border px-2 py-2 text-center transition ${
                    diceCount === o.c
                      ? 'border-amber-500/70 bg-amber-500/15'
                      : 'border-slate-700 bg-slate-900/60'
                  }`}
                >
                  <div
                    className={`text-xs font-bold ${diceCount === o.c ? 'text-amber-200' : 'text-slate-200'}`}
                  >
                    {o.label}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{o.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 骰子样式 */}
          <div>
            <p className="text-[11px] text-slate-400 mb-1.5 px-1">骰子样式</p>
            <div className="grid grid-cols-4 gap-2">
              {DIE_STYLES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStyleId(s.id)}
                  className={`rounded-xl border py-2 flex flex-col items-center gap-1 transition ${
                    styleId === s.id
                      ? 'border-amber-500/70 bg-amber-500/10'
                      : 'border-slate-700 bg-slate-900/60'
                  }`}
                >
                  <Die value={5} style={s} size={34} />
                  <span
                    className={`text-[10px] ${styleId === s.id ? 'text-amber-200' : 'text-slate-400'}`}
                  >
                    {s.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 候选预览 + 换一批 */}
          <div>
            <div className="flex items-center justify-between mb-1.5 px-1">
              <p className="text-[11px] text-slate-400">本轮候选（自选优先）</p>
              <button
                onClick={reshufflePreview}
                className="text-[11px] text-sky-300 border border-sky-500/40 rounded-full px-2.5 py-1 bg-sky-500/10"
              >
                🔀 换一批
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {candidates.slice(0, need).map((c, i) => (
                <div
                  key={c.symbol}
                  className="rounded-lg border border-slate-700 bg-slate-900/60 px-1 py-1.5 text-center"
                >
                  <div className="text-[10px] text-amber-300 font-bold">{numLabel(i)}</div>
                  <div className="text-[11px] font-bold text-slate-200">{c.symbol}</div>
                  <div className="text-[9px] text-slate-500 truncate">{c.name}</div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-slate-600 mt-1 px-1">
              换一批：从律动扫描池（有律动分的股票）里随机抽
            </p>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            小说明：用历史上的某一天当"昨日"，这样才能揭晓后 5 天的真实走势。
            <span className="text-violet-300/80">💡 创意来自 @vipdongxia</span>
          </p>
          {err && <p className="text-[11px] text-rose-300 px-1">{err}</p>}
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
          >
            摆好骰子
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <p className="text-center text-xs text-slate-400 py-10">正在请骰子就位…🎲</p>
      )}

      {(phase === 'ready' || phase === 'rolling') && (
        <div className="space-y-3">
          <div className="flex items-end justify-center gap-4 py-3">
            {faces.map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className={phase === 'rolling' ? 'animate-bounce' : ''}>
                  <Die value={f} style={style} size={diceCount === 2 ? 64 : 84} />
                </div>
                {diceCount === 2 && (
                  <span className="text-[10px] text-slate-500">
                    {i === 0 ? '定区(≤3上/≥4下)' : '定位'}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 max-h-44 overflow-y-auto">
            {stocks.map((s, i) => (
              <div
                key={s.symbol}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-1 py-1.5 text-center"
              >
                <div className="text-[10px] text-amber-300 font-bold">{numLabel(i)}</div>
                <div className="text-[11px] font-bold text-slate-200">{s.symbol}</div>
                <div className="text-[9px] text-slate-500 truncate">{s.name}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-slate-500">
            "昨日"（{dayLabel}）· {diceCount === 2 ? '第一颗定区、第二颗定位' : '掷出几点买第几只'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={reshuffle}
              className="flex-1 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-200 text-sm font-bold"
            >
              🔀 换一批
            </button>
            <button
              onClick={roll}
              disabled={phase !== 'ready'}
              className="flex-[2] py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold"
            >
              {phase === 'ready' ? '🎲 掷骰子！' : '骰子滚动中…'}
            </button>
          </div>
        </div>
      )}

      {phase === 'bought' && pick && (
        <div className="space-y-3">
          <div className="flex justify-center gap-3 py-2">
            {faces.map((f, i) => (
              <Die key={i} value={f} style={style} size={56} />
            ))}
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-slate-100">
              🎲 天意已定！买入 {pick.name}（{pick.symbol}）
            </p>
            <p className="text-xs text-slate-400 mt-1">"昨日"涨幅 {fmtPct(pick.pct)}</p>
          </div>
          <button
            onClick={reveal}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            揭晓后 5 天走势
          </button>
        </div>
      )}

      {phase === 'reveal' && pick && (
        <div className="space-y-2">
          <div
            className={`rounded-xl p-3 text-center text-xs leading-relaxed border ${
              win
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-slate-500/10 border-slate-600/40 text-slate-300'
            }`}
          >
            <p className="font-semibold text-sm">
              {win ? '🚀 天意赢了！+100 分' : '📉 这次大盘更稳'}
            </p>
            <p className="mt-1 tabular-nums">
              {pick.name} 后 5 天 {fmtPct(pick.next5)} · 大盘 QQQ {fmtPct(qqq5)}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">{tip}</p>
          <div className="flex gap-2">
            <button
              onClick={reshuffle}
              className="flex-1 py-2.5 rounded-xl border border-sky-500/40 bg-sky-500/10 text-sky-200 text-sm font-bold"
            >
              🔀 换一批
            </button>
            <button
              onClick={start}
              className="flex-[2] py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
            >
              再掷一次
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
