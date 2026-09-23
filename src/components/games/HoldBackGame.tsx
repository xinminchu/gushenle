'use client';

import React, { useEffect, useRef, useState } from 'react';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'idle' | 'running' | 'won' | 'lost';

const DURATION = 60;

const TEMPTATIONS = [
  '🚀 利好！分析师上调目标价！',
  '🚀 隔壁老王晒单：三天赚 20%！',
  '🚀 突发：成交量暴增三倍！',
  '🚀 大 V 发文：这波看到翻倍！',
  '🚀 盘中直线拉升，不买就晚了！',
];

export default function HoldBackGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [left, setLeft] = useState(DURATION);
  const [tempt, setTempt] = useState('');
  const [score, setScore] = useState(0);
  const [endText, setEndText] = useState('');
  const reported = useRef(false);

  const prices = useRef<number[]>([]);
  const raf = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const temptTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const phaseRef = useRef<Phase>('idle');
  phaseRef.current = phase;

  const draw = (crash: boolean) => {
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
    // 网格线
    ctx.strokeStyle = 'rgba(148,163,184,0.12)';
    ctx.lineWidth = 1;
    for (let g = 1; g < 4; g++) {
      ctx.beginPath();
      ctx.moveTo(0, (H / 4) * g);
      ctx.lineTo(W, (H / 4) * g);
      ctx.stroke();
    }
    ctx.strokeStyle = crash ? '#ef4444' : '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ps.forEach((v, i) => {
      if (i === 0) ctx.moveTo(x(i), y(v));
      else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();
    // 当前价
    const last = ps[ps.length - 1];
    ctx.fillStyle = crash ? '#ef4444' : '#22c55e';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(last.toFixed(1), W - 52, y(last) - 8);
  };

  const stopAll = () => {
    cancelAnimationFrame(raf.current);
    if (timer.current) clearInterval(timer.current);
    if (temptTimer.current) clearInterval(temptTimer.current);
    timer.current = temptTimer.current = null;
  };

  useEffect(() => stopAll, []);

  const finish = (won: boolean, survivedSec: number) => {
    stopAll();
    if (won) {
      setScore(200);
      setEndText('🧘 定力满分！60 秒里诱惑不断，你一次都没点。追高？不存在的。');
      setPhase('won');
    } else {
      const pts = survivedSec * 2;
      setScore(pts);
      // 买入后表演一个跳水
      let p = prices.current[prices.current.length - 1] || 100;
      let n = 0;
      const dive = setInterval(() => {
        p *= 0.985;
        prices.current.push(p);
        if (prices.current.length > 240) prices.current.shift();
        draw(true);
        if (++n > 40) {
          clearInterval(dive);
          setEndText(`💸 追高被套！买入后一路跳水，这就是"涨太猛了"时候冲进去的下场。本局 ${pts} 分，下次忍住。`);
          setPhase('lost');
        }
      }, 50);
      return;
    }
    if (!reported.current) {
      reported.current = true;
      recordPlay('holdback', won ? 200 : survivedSec * 2);
    }
  };

  // lost 分支里 recordPlay 在 dive 结束后调——抽出来统一
  useEffect(() => {
    if (phase === 'lost' && !reported.current) {
      reported.current = true;
      recordPlay('holdback', score);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const start = () => {
    stopAll();
    reported.current = false;
    prices.current = [100];
    setLeft(DURATION);
    setTempt('');
    setScore(0);
    setEndText('');
    setPhase('running');

    // 价格：上飘 + 噪声 + 偶发脉冲，诱惑拉满
    const tick = () => {
      if (phaseRef.current !== 'running') return;
      const ps = prices.current;
      const last = ps[ps.length - 1];
      const spike = Math.random() < 0.06 ? last * 0.03 : 0;
      const next = last + last * 0.0012 + (Math.random() - 0.48) * last * 0.006 + spike;
      ps.push(next);
      if (ps.length > 240) ps.shift();
      draw(false);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    timer.current = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) {
          finish(true, DURATION);
          return 0;
        }
        return v - 1;
      });
    }, 1000);

    let ti = 0;
    temptTimer.current = setInterval(() => {
      setTempt(TEMPTATIONS[ti++ % TEMPTATIONS.length]);
    }, 9000);
  };

  const buy = () => {
    if (phase !== 'running') return;
    finish(false, DURATION - left);
  };

  const reset = () => {
    stopAll();
    reported.current = false;
    setPhase('idle');
    setLeft(DURATION);
    setTempt('');
    setEndText('');
    prices.current = [];
  };

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🚫 忍住别追高</div>
        <div className="text-[11px] text-slate-500 mt-0.5">60 秒，管住手就是胜利</div>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2 relative">
        <div className="flex items-baseline justify-between px-1 pb-1">
          <span className="text-xs font-semibold text-slate-300">某妖股分时图</span>
          {phase === 'running' && (
            <span className="text-sm font-bold text-amber-300 tabular-nums">{left}s</span>
          )}
        </div>
        <canvas ref={canvasRef} className="w-full h-[180px]" />
        {tempt && phase === 'running' && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-rose-600/90 text-white text-[11px] font-bold px-3 py-1.5 rounded-full animate-bounce whitespace-nowrap">
            {tempt}
          </div>
        )}
      </div>

      {phase === 'idle' && (
        <div className="text-center space-y-2">
          <p className="text-xs text-slate-400 leading-relaxed px-2">
            股价一路飙升，利好一个接一个，"买入"按钮疯狂闪烁。
            <br />
            规则：<span className="text-slate-200 font-semibold">60 秒内一次都别点</span>，点了就追高被套。
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
        <button
          onClick={buy}
          className="w-full py-4 rounded-xl bg-rose-600 text-white text-lg font-black animate-pulse shadow-lg shadow-rose-900/50"
        >
          🤑 点我买入，马上起飞！
        </button>
      )}

      {(phase === 'won' || phase === 'lost') && (
        <div className="space-y-2">
          <div
            className={`rounded-xl p-3 text-center text-xs leading-relaxed border ${
              phase === 'won'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}
          >
            <p className="font-semibold">{endText}</p>
            <p className="text-amber-300 font-bold mt-1">本局 {score} 分</p>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">
            💡 追高时的心跳，和游戏里一模一样。区别是：游戏里输的是积分，实盘里输的是真钱。
          </p>
          <button
            onClick={reset}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            再来一局
          </button>
        </div>
      )}
    </div>
  );
}
