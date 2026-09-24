'use client';

import React, { useEffect, useRef, useState } from 'react';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'idle' | 'running' | 'done';

const DURATION = 60;

const TEMPTATIONS = [
  '🚀 分析师上调目标价！',
  '🚀 隔壁老王晒单：三天 20%！',
  '🚀 成交量暴增三倍！',
  '🚀 大 V 发文：看到翻倍！',
  '🚀 直线拉升，再不上车晚了！',
];

interface Trade {
  entry: number;
  exit: number;
  pct: number;
  crashed: boolean;
}

export default function HoldBackGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(DURATION);
  const [tempt, setTempt] = useState('');
  const [score, setScore] = useState(0);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [holding, setHolding] = useState<number | null>(null); // 持仓成本
  const [pnl, setPnl] = useState(0); // 当前浮盈亏 %
  const [endText, setEndText] = useState('');
  const [crashFlash, setCrashFlash] = useState(false);

  const prices = useRef<number[]>([]);
  const priceRef = useRef(100);
  const holdingRef = useRef<number | null>(null);
  const crashIn = useRef(false);
  const holdSec = useRef(0);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);
  const reported = useRef(false);
  const scoreRef = useRef(0);
  const tradesRef = useRef<Trade[]>([]);
  scoreRef.current = score;
  tradesRef.current = trades;

  const draw = (crashed: boolean) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = 2;
    const W = canvas.clientWidth || 320;
    const H = canvas.clientHeight || 180;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const ps = prices.current;
    if (ps.length < 2) return;
    let hi = Math.max(...ps);
    let lo = Math.min(...ps);
    const pad = (hi - lo) * 0.15 || 1;
    hi += pad;
    lo -= pad;
    const x = (i: number) => (i / (ps.length - 1)) * W;
    const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    ctx.strokeStyle = 'rgba(148,163,184,0.12)';
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      ctx.beginPath();
      ctx.moveTo(0, (H / 4) * g);
      ctx.lineTo(W, (H / 4) * g);
      ctx.stroke();
    }
    // 持仓成本线
    if (holdingRef.current !== null) {
      ctx.strokeStyle = '#fbbf24';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y(holdingRef.current));
      ctx.lineTo(W, y(holdingRef.current));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = crashed ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ps.forEach((v, i) => {
      if (i === 0) ctx.moveTo(x(i), y(v));
      else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();
    const last = ps[ps.length - 1];
    ctx.fillStyle = crashed ? '#ef4444' : '#22c55e';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(last.toFixed(1), W - 52, y(last) - 8);
  };

  const clearTimers = () => {
    timers.current.forEach(clearInterval);
    timers.current = [];
  };

  useEffect(() => clearTimers, []);

  const pushPrice = (v: number) => {
    priceRef.current = v;
    prices.current.push(v);
    if (prices.current.length > 240) prices.current.shift();
  };

  const finish = () => {
    clearTimers();
    // 60 秒到：按市价平掉未平仓位
    let finalScore = scoreRef.current;
    const ts = [...tradesRef.current];
    if (holdingRef.current !== null) {
      const pct = (priceRef.current - holdingRef.current) / holdingRef.current;
      const pts = Math.max(0, Math.round(pct * 100 * 20));
      finalScore += pts;
      ts.push({ entry: holdingRef.current, exit: priceRef.current, pct, crashed: false });
      holdingRef.current = null;
      setHolding(null);
    }
    setTrades(ts);
    setScore(finalScore);
    const wins = ts.filter((t) => t.pct > 0.005).length;
    const crashed = ts.filter((t) => t.crashed).length;
    let text: string;
    if (ts.length === 0) {
      finalScore += 80;
      setScore(finalScore);
      text = `🧘 60 秒一次没出手，+80 分。空仓也是一种策略——至少，你没亏。`;
    } else {
      text = `📊 追高 ${ts.length} 次，赚了 ${wins} 次${crashed > 0 ? `，被埋 ${crashed} 次` : ''}。`;
      if (wins === ts.length && crashed === 0)
        text += '这次全赚？别飘——追高十次九次是运气，第十次是学费。';
      else if (crashed > 0)
        text += '追高就像接飞刀：接到几次刀把，就觉得自己是刀客了，直到那次接到刀刃。';
      else text += '有赚有亏才是常态。问题是：扣掉那几次被埋，长期还赚吗？';
    }
    setEndText(text);
    setPhase('done');
    if (!reported.current) {
      reported.current = true;
      recordPlay('holdback', finalScore);
    }
  };

  const start = () => {
    clearTimers();
    reported.current = false;
    prices.current = [100];
    priceRef.current = 100;
    holdingRef.current = null;
    crashIn.current = false;
    holdSec.current = 0;
    setLeft(DURATION);
    setTempt('');
    setScore(0);
    setTrades([]);
    setHolding(null);
    setPnl(0);
    setEndText('');
    setCrashFlash(false);
    setPhase('running');
    draw(false);

    // 价格引擎：100ms 一跳，整体上飘 + 噪声 + 偶发脉冲
    timers.current.push(
      setInterval(() => {
        if (crashIn.current) return;
        const last = priceRef.current;
        const spike = Math.random() < 0.05 ? last * 0.02 : 0;
        const drift = holdingRef.current !== null ? 0.0008 : 0.0012; // 持有时涨得慢一点，勾引你"再等等"
        pushPrice(last + last * drift + (Math.random() - 0.48) * last * 0.006 + spike);
        if (holdingRef.current !== null) {
          setPnl(((priceRef.current - holdingRef.current) / holdingRef.current) * 100);
        }
        draw(false);
      }, 100),
    );

    // 闪崩判定：每秒一次，持有越久概率越高
    timers.current.push(
      setInterval(() => {
        if (holdingRef.current === null || crashIn.current) return;
        holdSec.current += 1;
        const p = Math.min(0.45, 0.03 + holdSec.current * 0.025);
        if (Math.random() < p) {
          // 闪崩！
          crashIn.current = true;
          setCrashFlash(true);
          let n = 0;
          const dive = setInterval(() => {
            pushPrice(priceRef.current * 0.97);
            draw(true);
            if (++n > 25) {
              clearInterval(dive);
              const entry = holdingRef.current!;
              const pct = (priceRef.current - entry) / entry;
              setTrades((ts) => [...ts, { entry, exit: priceRef.current, pct, crashed: true }]);
              holdingRef.current = null;
              setHolding(null);
              setPnl(0);
              crashIn.current = false;
              holdSec.current = 0;
              setTimeout(() => setCrashFlash(false), 1200);
            }
          }, 60);
        }
      }, 1000),
    );

    // 倒计时
    timers.current.push(
      setInterval(() => {
        setLeft((v) => {
          if (v <= 1) {
            finish();
            return 0;
          }
          return v - 1;
        });
      }, 1000),
    );

    // 诱惑弹幕
    let ti = 0;
    timers.current.push(
      setInterval(() => {
        setTempt(TEMPTATIONS[ti++ % TEMPTATIONS.length]);
      }, 8000),
    );
  };

  const buy = () => {
    if (holdingRef.current !== null || crashIn.current) return;
    holdingRef.current = priceRef.current;
    holdSec.current = 0;
    setHolding(priceRef.current);
    setPnl(0);
  };

  const sell = () => {
    if (holdingRef.current === null || crashIn.current) return;
    const entry = holdingRef.current;
    const pct = (priceRef.current - entry) / entry;
    const pts = Math.max(0, Math.round(pct * 100 * 20));
    setScore((s) => s + pts);
    setTrades((ts) => [...ts, { entry, exit: priceRef.current, pct, crashed: false }]);
    holdingRef.current = null;
    setHolding(null);
    setPnl(0);
  };

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🚫 忍住别追高</div>
        <div className="text-[11px] text-slate-500 mt-0.5">追高模拟器：买入可能赚，拿着可能崩</div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2 relative">
        <div className="flex items-baseline justify-between px-1 pb-1">
          <span className="text-xs font-semibold text-slate-300">某妖股分时图</span>
          <span className="flex items-center gap-2">
            {holding !== null && (
              <span className={`text-xs font-bold tabular-nums ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                浮盈 {pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%
              </span>
            )}
            {phase === 'running' && (
              <span className="text-sm font-bold text-amber-300 tabular-nums">{left}s</span>
            )}
          </span>
        </div>
        <canvas ref={canvasRef} className="w-full h-[180px]" />
        {crashFlash && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-rose-600/95 text-white text-sm font-black px-4 py-2 rounded-xl animate-bounce">
              ⚡ 闪崩！被套了…
            </div>
          </div>
        )}
        {tempt && phase === 'running' && holding === null && !crashFlash && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-rose-600/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full animate-bounce whitespace-nowrap">
            {tempt}
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <div className="text-center space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            规则变了：<span className="text-slate-200 font-semibold">买入真的可能赚钱</span>——但拿得越久，闪崩概率越高。
            <br />
            赚了就跑还是贪到被埋？60 秒见分晓。不出手也行，+80 分。
          </p>
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            开始挑战
          </button>
        </div>
      )}

      {phase === 'running' && (
        <div className="space-y-2">
          {holding === null ? (
            <button
              onClick={buy}
              className="w-full py-4 rounded-xl bg-rose-600 text-white text-lg font-black animate-pulse shadow-lg shadow-rose-900/50"
            >
              🤑 点我追高，马上起飞！
            </button>
          ) : (
            <button
              onClick={sell}
              className="w-full py-4 rounded-xl bg-emerald-600 text-white text-lg font-black shadow-lg shadow-emerald-900/50"
            >
              💰 落袋为安（{pnl >= 0 ? '+' : ''}{pnl.toFixed(1)}%）
            </button>
          )}
          <p className="text-center text-[11px] text-slate-500">
            本局 {score} 分 · 已交易 {trades.length} 次
          </p>
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-2">
          <div className="rounded-xl p-3 text-center text-xs leading-relaxed border bg-slate-500/10 border-slate-600/40 text-slate-200">
            <p className="font-semibold">{endText}</p>
            <p className="text-amber-300 font-bold mt-1">本局 {score} 分</p>
          </div>
          {trades.length > 0 && (
            <div className="text-[11px] text-slate-500 space-y-0.5 px-1">
              {trades.map((t, i) => (
                <p key={i}>
                  第{i + 1}笔：{t.crashed ? '⚡闪崩被埋' : `${t.pct >= 0 ? '+' : ''}${(t.pct * 100).toFixed(1)}%`}
                </p>
              ))}
            </div>
          )}
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">
            💡 追高最毒的地方：它真的会让你先赚几次。赚的那几次不是技术，是运气在收门票。
          </p>
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            再来一局
          </button>
        </div>
      )}
    </div>
  );
}
