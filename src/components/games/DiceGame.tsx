'use client';

import React, { useEffect, useRef, useState } from 'react';
import { fillPicks, prepareBuyReveal, fmtPct, type BuyRevealItem } from './gameUtils';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'setup' | 'loading' | 'ready' | 'rolling' | 'bought' | 'reveal';

const FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

const TIPS = [
  '💡 掷骰子选股听起来离谱，但"昨日"涨幅最大的那只往往是追高陷阱——骰子顺手帮你避开了人性。',
  '💡 6 只里掷中哪只全凭运气：运气管进场，纪律管出场。',
  '💡 买股全看天意，拿股全看纪律——骰子只负责前一半。',
];

export default function DiceGame() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [candidates] = useState(() => fillPicks(6));
  const [stocks, setStocks] = useState<BuyRevealItem[]>([]);
  const [dayLabel, setDayLabel] = useState('');
  const [qqq5, setQqq5] = useState(0);
  const [face, setFace] = useState(0);
  const [score, setScore] = useState(0);
  const [tip, setTip] = useState('');
  const [err, setErr] = useState('');
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const timerRef = useRef(0);

  useEffect(() => {
    return () => {
      window.clearInterval(timerRef.current);
      if (scoreRef.current > 0) recordPlay('dice', scoreRef.current);
    };
  }, []);

  const start = async () => {
    setPhase('loading');
    setErr('');
    const r = await prepareBuyReveal(candidates);
    if (!r || r.items.length < 6) {
      setErr('行情数据没拉全，换个网络再试一次');
      setPhase('setup');
      return;
    }
    setStocks(r.items);
    setDayLabel(r.dayLabel);
    setQqq5(r.qqq5);
    setFace(0);
    setPhase('ready');
  };

  const roll = () => {
    if (phase !== 'ready') return;
    setPhase('rolling');
    const final = Math.floor(Math.random() * 6);
    let ticks = 0;
    timerRef.current = window.setInterval(() => {
      ticks++;
      setFace(Math.floor(Math.random() * 6));
      if (ticks >= 14) {
        window.clearInterval(timerRef.current);
        setFace(final);
        setPhase('bought');
      }
    }, 90);
  };

  const pick = phase === 'bought' || phase === 'reveal' ? stocks[face] : null;
  const win = pick ? pick.next5 > qqq5 : false;

  const reveal = () => {
    if (win) setScore((v) => v + 100);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setPhase('reveal');
  };

  const numLabel = ['①', '②', '③', '④', '⑤', '⑥'];

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
            买股全看天意：<span className="text-slate-100 font-semibold">6 只股票一字排开，掷出几点就"买入"第几只</span>，
            再看它后 5 天能不能跑赢大盘。别小看骰子——它从不追高，也从不割肉。
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {candidates.map((c, i) => (
              <div
                key={c.symbol}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-1 py-1.5 text-center"
              >
                <div className="text-[10px] text-amber-300 font-bold">{numLabel[i]}</div>
                <div className="text-[11px] font-bold text-slate-200">{c.symbol}</div>
                <div className="text-[9px] text-slate-500 truncate">{c.name}</div>
              </div>
            ))}
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
          <div className="text-center py-4">
            <div
              className={`text-7xl inline-block ${phase === 'rolling' ? 'animate-bounce' : ''}`}
            >
              {FACES[face]}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {stocks.map((s, i) => (
              <div
                key={s.symbol}
                className="rounded-lg border border-slate-700 bg-slate-900/60 px-1 py-1.5 text-center"
              >
                <div className="text-[10px] text-amber-300 font-bold">{numLabel[i]}</div>
                <div className="text-[11px] font-bold text-slate-200">{s.symbol}</div>
                <div className="text-[9px] text-slate-500 truncate">{s.name}</div>
              </div>
            ))}
          </div>
          <p className="text-center text-[11px] text-slate-500">
            "昨日"（{dayLabel}）· 掷出几点买第几只
          </p>
          <button
            onClick={roll}
            disabled={phase !== 'ready'}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-bold"
          >
            {phase === 'ready' ? '🎲 掷骰子！' : '骰子滚动中…'}
          </button>
        </div>
      )}

      {phase === 'bought' && pick && (
        <div className="space-y-3">
          <div className="text-center py-2">
            <div className="text-6xl">{FACES[face]}</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-slate-100">
              🎲 {face + 1} 点！买入 {pick.name}（{pick.symbol}）
            </p>
            <p className="text-xs text-slate-400 mt-1">"昨日"涨幅 {fmtPct(pick.pct)}，天意已定</p>
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
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
          >
            再掷一次
          </button>
        </div>
      )}
    </div>
  );
}
