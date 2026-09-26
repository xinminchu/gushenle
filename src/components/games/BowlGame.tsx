'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { readWatchlist, fetchSeries, fmtPct, type Candle } from './gameUtils';
import { findStock } from '@/lib/stockList';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'setup' | 'loading' | 'shuffle' | 'pick' | 'won' | 'lost' | 'reveal';

interface BowlRound {
  symbol: string;
  name: string;
  winIdx: number;
  dayLabel: string;
  next5: number;
  qqq5: number;
}

const TIPS = [
  '💡 猜碗拼的是运气，但开碗后认识的这家公司，是实实在在的知识。',
  '💡 街头猜碗十猜九输——股市里也一样，别把运气当本事。',
  '💡 买入前先看"公司名片"：知道它是干什么的，才算认识这只股票。',
];

export default function BowlGame() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [round, setRound] = useState<BowlRound | null>(null);
  const [picked, setPicked] = useState(-1);
  const [score, setScore] = useState(0);
  const [tip, setTip] = useState('');
  const [err, setErr] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (scoreRef.current > 0) recordPlay('bowl', scoreRef.current);
    };
  }, []);

  // ---- 准备一局：随机抽一只股票 + 随机历史某天当"今天" ----
  const prepare = useCallback(async (): Promise<BowlRound | null> => {
    const pool = readWatchlist();
    const w = pool[Math.floor(Math.random() * pool.length)];
    const [series, qqqSeries] = await Promise.all([fetchSeries(w.symbol), fetchSeries('QQQ')]);
    if (!series || series.length < 40 || !qqqSeries || qqqSeries.length < 40) return null;
    const qMap = new Map<string, number>();
    qqqSeries.forEach((c, i) => qMap.set(c.date, i));
    for (let t = 0; t < 30; t++) {
      const i = 30 + Math.floor(Math.random() * (series.length - 40));
      const D = series[i].date;
      const qj = qMap.get(D);
      if (qj === undefined || qj + 5 >= qqqSeries.length || i + 5 >= series.length) continue;
      return {
        symbol: w.symbol,
        name: w.name,
        winIdx: Math.floor(Math.random() * 3),
        dayLabel: D,
        next5: series[i + 5].close / series[i].close - 1,
        qqq5: qqqSeries[qj + 5].close / qqqSeries[qj].close - 1,
      };
    }
    return null;
  }, []);

  const start = async () => {
    setPhase('loading');
    setPicked(-1);
    setErr('');
    const r = await prepare();
    if (!r) {
      setErr('行情数据没拉全，换个网络再试一次');
      setPhase('setup');
      return;
    }
    setRound(r);
    setPhase('shuffle');
    timerRef.current = setTimeout(() => setPhase('pick'), 1700);
  };

  const pick = (i: number) => {
    if (phase !== 'pick' || !round) return;
    setPicked(i);
    if (i === round.winIdx) {
      setScore((v) => v + 10);
      setPhase('won');
    } else {
      setPhase('lost');
    }
  };

  const buy = () => {
    if (!round) return;
    if (round.next5 > round.qqq5) setScore((v) => v + 20);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setPhase('reveal');
  };

  const info = round ? findStock(round.symbol) : undefined;
  const beatQqq = round ? round.next5 > round.qqq5 : false;

  const companyCard = round && (
    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-left space-y-1">
      <p className="text-sm font-bold text-slate-100">
        {round.symbol} <span className="font-normal text-slate-300">{info?.zh || round.name}</span>
      </p>
      <p className="text-[11px] text-slate-400">
        {info?.sector || ''}
        {(info?.themes || []).length > 0 && ` · ${(info!.themes as string[]).join(' / ')}`}
      </p>
      {info?.blurb && <p className="text-[11px] text-slate-300 leading-relaxed">📇 {info.blurb}</p>}
    </div>
  );

  const bowls = [0, 1, 2].map((i) => {
    const isWin = round != null && i === round.winIdx;
    const isPicked = i === picked;
    const revealed = phase === 'won' || phase === 'lost' || phase === 'reveal';
    return (
      <button
        key={i}
        onClick={() => pick(i)}
        disabled={phase !== 'pick'}
        className={`relative flex-1 py-4 rounded-xl border text-5xl transition-all
          ${phase === 'shuffle' ? 'bowl-shuffling' : ''}
          ${revealed && isWin ? 'border-amber-400/70 bg-amber-500/10' : 'border-slate-700 bg-slate-800/50'}
          ${phase === 'pick' ? 'hover:border-sky-500/60 active:scale-95 cursor-pointer' : 'cursor-default'}
          ${revealed && isPicked && !isWin ? 'opacity-60' : ''}`}
        style={phase === 'shuffle' ? { animationDelay: `${i * 0.18}s`, animationDuration: '0.55s' } : undefined}
      >
        🥣
        {revealed && isWin && (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold text-amber-300 whitespace-nowrap">
            {round!.symbol}
          </span>
        )}
        {revealed && isPicked && !isWin && (
          <span className="absolute top-1 right-2 text-lg">✖</span>
        )}
      </button>
    );
  });

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <style>{`
        @keyframes bowl-shuffle {
          0% { transform: translateX(0) rotate(0); }
          25% { transform: translateX(26px) rotate(10deg); }
          50% { transform: translateX(-26px) rotate(-10deg); }
          75% { transform: translateX(12px) rotate(5deg); }
          100% { transform: translateX(0) rotate(0); }
        }
        .bowl-shuffling { animation-name: bowl-shuffle; animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
      `}</style>

      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🥣 猜碗选股</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史行情 · 街头猜碗进股市 · 本局 {score} 分
        </div>
      </div>

      {phase === 'setup' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            三只碗，一只股票——<span className="text-slate-100 font-semibold">猜它藏在哪只碗里</span>。
            猜中开碗：先看它的"公司名片"，再决定买不买；买入后揭晓随后 5 天能不能跑赢大盘。
            猜错了也别走，看看股票到底藏在哪个碗里，认识一家公司不亏。
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            小说明：用历史上的某一天当"今天"，这样才能揭晓后 5 天的真实走势。
            <span className="text-violet-300/80">💡 创意来自 @路过</span>
          </p>
          {err && <p className="text-[11px] text-rose-300 px-1">{err}</p>}
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            扣碗、洗牌！
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <p className="text-center text-xs text-slate-400 py-10">正在扣碗…🥣</p>
      )}

      {(phase === 'shuffle' || phase === 'pick') && (
        <div className="space-y-2">
          <div className="flex gap-2">{bowls}</div>
          <p className="text-center text-[11px] text-slate-500">
            {phase === 'shuffle' ? '洗牌中…盯紧了！' : '猜：股票藏在哪只碗里？'}
          </p>
        </div>
      )}

      {phase === 'won' && round && (
        <div className="space-y-2">
          <div className="flex gap-2">{bowls}</div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-slate-100">🎉 猜中了！+10 分</p>
            <p className="text-[11px] text-slate-400 mt-0.5">股票就藏在这只碗里——先认识它，再决定买不买</p>
          </div>
          {companyCard}
          <div className="flex gap-2">
            <button
              onClick={buy}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
            >
              买入
            </button>
            <button
              onClick={() => start()}
              className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-bold"
            >
              看看就好，再来一碗
            </button>
          </div>
        </div>
      )}

      {phase === 'lost' && round && (
        <div className="space-y-2">
          <div className="flex gap-2">{bowls}</div>
          <div className="bg-slate-500/10 border border-slate-600/40 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-slate-200">🙈 猜错了，这只碗是空的</p>
            <p className="text-[11px] text-slate-400 mt-0.5">股票藏在金色那只碗里——认识一下，不亏</p>
          </div>
          {companyCard}
          <button
            onClick={() => start()}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            再来一碗
          </button>
        </div>
      )}

      {phase === 'reveal' && round && (
        <div className="space-y-2">
          {companyCard}
          <div
            className={`rounded-xl p-3 text-center text-xs leading-relaxed border ${
              beatQqq
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-slate-500/10 border-slate-600/40 text-slate-300'
            }`}
          >
            <p className="font-semibold text-sm">
              {beatQqq ? '🚀 跑赢大盘！再 +20 分' : '📉 这次大盘更稳'}
            </p>
            <p className="mt-1 tabular-nums">
              {round.symbol} 后 5 天 {fmtPct(round.next5)} · 大盘 QQQ {fmtPct(round.qqq5)}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">{tip}</p>
          <button
            onClick={() => start()}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            再来一碗
          </button>
        </div>
      )}
    </div>
  );
}
