'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fillPicks, prepareBuyReveal, fmtPct, type BuyRevealItem } from './gameUtils';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'setup' | 'loading' | 'ready' | 'walking' | 'bought' | 'reveal';

const N = 5; // 5x5
const STEPS = 20;

const TIPS = [
  '💡 1973 年《漫步华尔街》就说：股价像酒鬼走位——下一步往哪走，跟上一步没关系。',
  '💡 酒鬼 20 步还没走出这 5×5，说明随机游走也会"均值回归"——拿住，别慌。',
  '💡 别笑酒鬼：真有实验让猴子扔飞镖选股，长期没输给基金经理多少。',
];

interface Pos {
  r: number;
  c: number;
}

export default function DrunkardGame() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [candidates] = useState(() => fillPicks(N * N));
  const [stocks, setStocks] = useState<BuyRevealItem[]>([]);
  const [dayLabel, setDayLabel] = useState('');
  const [qqq5, setQqq5] = useState(0);
  const [pos, setPos] = useState<Pos>({ r: 2, c: 2 });
  const [trail, setTrail] = useState<Pos[]>([]);
  const [stepsLeft, setStepsLeft] = useState(STEPS);
  const [score, setScore] = useState(0);
  const [tip, setTip] = useState('');
  const [err, setErr] = useState('');
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const timerRef = useRef(0);
  const posRef = useRef<Pos>({ r: 2, c: 2 });

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      if (scoreRef.current > 0) recordPlay('drunk', scoreRef.current);
    };
  }, []);

  const start = async () => {
    setPhase('loading');
    setErr('');
    const r = await prepareBuyReveal(candidates);
    if (!r || r.items.length < N * N) {
      setErr('行情数据没拉全，换个网络再试一次');
      setPhase('setup');
      return;
    }
    setStocks(r.items);
    setDayLabel(r.dayLabel);
    setQqq5(r.qqq5);
    posRef.current = { r: 2, c: 2 };
    setPos({ r: 2, c: 2 });
    setTrail([]);
    setStepsLeft(STEPS);
    setPhase('ready');
  };

  const step = (p: Pos): Pos => {
    const dirs = [
      { r: -1, c: 0 },
      { r: 1, c: 0 },
      { r: 0, c: -1 },
      { r: 0, c: 1 },
    ];
    // 撞墙就反弹：只选不出界的方向
    const valid = dirs.filter(
      (d) => p.r + d.r >= 0 && p.r + d.r < N && p.c + d.c >= 0 && p.c + d.c < N,
    );
    const d = valid[Math.floor(Math.random() * valid.length)];
    return { r: p.r + d.r, c: p.c + d.c };
  };

  const walk = () => {
    if (phase !== 'ready') return;
    setPhase('walking');
    let left = STEPS;
    timerRef.current = window.setInterval(() => {
      const np = step(posRef.current);
      posRef.current = np;
      setPos(np);
      setTrail((t) => [...t, np]);
      left--;
      setStepsLeft(left);
      if (left <= 0) {
        window.clearInterval(timerRef.current);
        setPhase('bought');
      }
    }, 300);
  };

  const idx = pos.r * N + pos.c;
  const pick = phase === 'bought' || phase === 'reveal' ? stocks[idx] : null;
  const win = pick ? pick.next5 > qqq5 : false;
  const trailSet = new Set(trail.map((p) => p.r * N + p.c));

  const reveal = () => {
    if (win) setScore((v) => v + 100);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setPhase('reveal');
  };

  const cell = (i: number) => {
    const s = stocks[i];
    const isHere = i === idx && (phase === 'walking' || phase === 'ready' || phase === 'bought');
    const visited = trailSet.has(i);
    return (
      <div
        key={s.symbol}
        className={`rounded-md border px-0.5 py-1 text-center transition-all ${
          isHere
            ? 'border-amber-400 bg-amber-500/25 scale-110 z-10'
            : visited
              ? 'border-slate-700 bg-slate-800/70'
              : 'border-slate-800 bg-slate-900/60'
        }`}
      >
        {isHere ? (
          <div className="text-lg leading-none">🥴</div>
        ) : (
          <>
            <div className="text-[9px] font-bold text-slate-200 leading-tight truncate">
              {s.symbol}
            </div>
            <div className="text-[8px] text-slate-500 leading-tight truncate">{s.name}</div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🥴 酒鬼走位买股</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史行情 · 随机游走挑战 · 本局 {score} 分
        </div>
      </div>

      {phase === 'setup' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            诺奖得主说股价就是<span className="text-slate-100 font-semibold">酒鬼走位</span>：
            25 只股票摆成 5×5，酒鬼从中间出发随机游走 20 步，
            <span className="text-slate-100 font-semibold">晕倒在哪只就"买入"哪只</span>，
            再看它后 5 天能不能跑赢大盘。
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            小说明：用历史上的某一天当"昨日"，这样才能揭晓后 5 天的真实走势。
            <span className="text-violet-300/80">💡 创意来自 @vipdongxia</span>
          </p>
          {err && <p className="text-[11px] text-rose-300 px-1">{err}</p>}
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold"
          >
            酒鬼就位
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <p className="text-center text-xs text-slate-400 py-10">酒鬼正在热身…🥴</p>
      )}

      {(phase === 'ready' || phase === 'walking') && (
        <div className="space-y-2">
          <div className="grid grid-cols-5 gap-1">
            {stocks.map((_, i) => cell(i))}
          </div>
          <p className="text-center text-[11px] text-slate-500">
            "昨日"（{dayLabel}）·{" "}
            {phase === 'ready' ? '酒鬼已就位，点开始让他走' : `走位中…还剩 ${stepsLeft} 步`}
          </p>
          <button
            onClick={walk}
            disabled={phase !== 'ready'}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-bold"
          >
            {phase === 'ready' ? '🥴 开走！' : '酒鬼走位中…'}
          </button>
        </div>
      )}

      {phase === 'bought' && pick && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-1 opacity-60">
            {stocks.map((_, i) => cell(i))}
          </div>
          <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-slate-100">
              🥴 酒鬼晕倒在 {pick.name}（{pick.symbol}）
            </p>
            <p className="text-xs text-slate-400 mt-1">
              "昨日"涨幅 {fmtPct(pick.pct)}，已"买入"——愿天意保佑他
            </p>
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
              {win ? '🚀 酒鬼赢了！+100 分' : '📉 这次大盘更稳'}
            </p>
            <p className="mt-1 tabular-nums">
              {pick.name} 后 5 天 {fmtPct(pick.next5)} · 大盘 QQQ {fmtPct(qqq5)}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">{tip}</p>
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold"
          >
            再走一次
          </button>
        </div>
      )}
    </div>
  );
}
