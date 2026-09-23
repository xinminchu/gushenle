'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  readWatchlist,
  fetchSeries,
  syntheticCandles,
  drawCandles,
  shortDate,
  fmtPct,
  type Candle,
} from './gameUtils';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'loading' | 'ready' | 'answered';

interface Round {
  symbol: string;
  name: string;
  candles: Candle[]; // 30 根：前 20 作答区 + 后 10 揭晓区
  decision: number; // 19：决策点下标
  fwd: number; // 决策点后 10 日涨跌幅
  dropFromHigh: number; // 决策点相对 20 日内高点的回撤
}

const TIPS = [
  '💡 历史数据里，大跌之后 10 天内 V 型反弹的次数，比你直觉以为的多得多。',
  '💡 割肉最大的成本不是手续费，是"卖在地板上"之后，眼睁睁看着它涨回去。',
  '💡 问自己：如果现在是空仓，你会在这个位置做空它吗？不会的话，割肉就是情绪在替你做决定。',
  '💡 真正的止损是买入前就定好的纪律，不是跌到肉疼时的临场发挥。',
];

export default function CutLossGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [verdict, setVerdict] = useState('');
  const [verdictGood, setVerdictGood] = useState(false);
  const [gained, setGained] = useState(0);
  const [tip, setTip] = useState('');
  const [q, setQ] = useState(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const newRound = useCallback(async () => {
    setPhase('loading');
    setVerdict('');
    setTip('');
    const list = readWatchlist();
    const pick = list[Math.floor(Math.random() * list.length)];
    let series = await fetchSeries(pick.symbol);
    if (!series) series = syntheticCandles(400);

    // 找"两难时刻"：相对 20 日内高点回撤 ≥6% 的点
    const cands: number[] = [];
    for (let i = 60; i < series.length - 11; i++) {
      let hi = -Infinity;
      for (let k = i - 20; k <= i; k++) hi = Math.max(hi, series[k].close);
      const dd = (series[i].close - hi) / hi;
      if (dd <= -0.06) cands.push(i);
    }
    const di = cands.length > 0
      ? cands[Math.floor(Math.random() * cands.length)]
      : 40 + Math.floor(Math.random() * (series.length - 51));
    const candles = series.slice(di - 19, di + 11); // 30 根
    let hi = -Infinity;
    for (let k = 0; k < 20; k++) hi = Math.max(hi, candles[k].close);
    setRound({
      symbol: pick.symbol,
      name: pick.name,
      candles,
      decision: 19,
      fwd: (candles[29].close - candles[19].close) / candles[19].close,
      dropFromHigh: (candles[19].close - hi) / hi,
    });
    setQ((v) => v + 1);
    setPhase('ready');
  }, []);

  // 卸载时结算本局积分
  useEffect(() => {
    newRound();
    return () => {
      if (scoreRef.current > 0) recordPlay('cutloss', scoreRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (hold: boolean) => {
    if (phase !== 'ready' || !round) return;
    const { fwd } = round;
    let pts = 0;
    let newStreak = streak;
    let good = false;
    let text = '';
    if (fwd >= 0.02) {
      // 卧倒正确
      if (hold) {
        pts = 100 + (streak >= 1 ? 50 * streak : 0);
        newStreak = streak + 1;
        good = true;
        text = `🎯 卧倒正确！10 天后 ${fmtPct(fwd)}，+${pts} 分${newStreak >= 2 ? `（${newStreak} 连击🔥）` : ''}`;
      } else {
        newStreak = 0;
        text = `💸 卖飞了！10 天后反弹 ${fmtPct(fwd)}，你割在了地板上`;
      }
    } else if (fwd <= -0.02) {
      // 割肉正确
      if (!hold) {
        pts = 100 + (streak >= 1 ? 50 * streak : 0);
        newStreak = streak + 1;
        good = true;
        text = `🎯 割得漂亮！10 天后又跌 ${fmtPct(fwd)}，+${pts} 分${newStreak >= 2 ? `（${newStreak} 连击🔥）` : ''}`;
      } else {
        newStreak = 0;
        text = `📉 卧倒挨刀！10 天后又跌 ${fmtPct(fwd)}，越套越深`;
      }
    } else {
      // 横盘
      if (hold) {
        pts = 50;
        newStreak = streak + 1;
        good = true;
        text = `😌 横盘震荡 ${fmtPct(fwd)}，拿着不亏，+50 分`;
      } else {
        newStreak = 0;
        text = `🧾 白交一笔手续费！10 天 ${fmtPct(fwd)}，割了个寂寞`;
      }
    }
    setStreak(newStreak);
    setScore((s) => s + pts);
    setGained(pts);
    setVerdictGood(good);
    setVerdict(text);
    setTip(TIPS[q % TIPS.length]);
    setPhase('answered');
  };

  // 画 K 线
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !round) return;
    if (phase === 'ready') {
      drawCandles(canvas, round.candles.slice(0, 20), {
        markerAt: 19,
        markerLabel: '现在',
      });
    } else if (phase === 'answered') {
      drawCandles(canvas, round.candles, {
        highlightFrom: 20,
        markerAt: 19,
        markerLabel: '决策点',
      });
    }
  }, [round, phase, q]);

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🔪 割肉还是卧倒</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史 K 线 · 大跌中途定格 · 本局 {score} 分
          {streak >= 2 && <span className="text-orange-400"> · {streak} 连击🔥</span>}
        </div>
      </div>

      {phase === 'loading' || !round ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-slate-500">
          正在抽取一段真实历史…
        </div>
      ) : (
        <>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
            <div className="flex items-baseline justify-between px-1 pb-1">
              <span className="text-xs font-semibold text-slate-300">
                {round.name} <span className="text-slate-500 font-normal">{round.symbol}</span>
              </span>
              <span className="text-[10px] text-slate-500">
                {shortDate(round.candles[0].date)} ~ {shortDate(round.candles[phase === 'ready' ? 19 : 29].date)}
              </span>
            </div>
            <canvas ref={canvasRef} className="w-full h-[200px]" />
          </div>

          {phase === 'ready' ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center space-y-2">
              <p className="text-xs text-amber-200">
                从近期高点已跌 <span className="font-bold">{fmtPct(round.dropFromHigh)}</span>，手在抖了…
              </p>
              <p className="text-sm font-bold text-slate-100">现在，你怎么选？</p>
              <div className="flex gap-2">
                <button
                  onClick={() => choose(false)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold"
                >
                  🔪 割肉离场
                </button>
                <button
                  onClick={() => choose(true)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                >
                  🛏️ 卧倒装死
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className={`rounded-xl p-3 text-center text-xs leading-relaxed border ${
                  verdictGood
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                }`}
              >
                <p className="font-semibold">{verdict}</p>
                {gained > 0 && <p className="text-amber-300 font-bold mt-1">+{gained} 分</p>}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed px-1">{tip}</p>
              <button
                onClick={newRound}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
              >
                再来一局
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
