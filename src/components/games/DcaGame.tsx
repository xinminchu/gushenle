'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  readWatchlist,
  fetchSeries,
  syntheticCandles,
  drawLines,
  fmtPct,
  type Candle,
} from './gameUtils';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'setup' | 'guess' | 'racing' | 'done';

const PERIODS = [
  { months: 12, label: '1 年' },
  { months: 24, label: '2 年' },
  { months: 36, label: '3 年' },
];

const MONTHLY = 1000;

interface Race {
  symbol: string;
  name: string;
  months: number;
  lumpVals: number[];
  dcaVals: number[];
  lumpFinal: number;
  dcaFinal: number;
  startDate: string;
  endDate: string;
}

const TIPS = [
  '💡 定投赢的不是收益，是"拿得住"。梭哈赢的时候很爽，输的时候直接心态爆炸。',
  '💡 数据里你会发现：定投很少大胜，但也很少大败——它买的是"睡得着觉"。',
  '💡 梭哈本质上是在赌"入场时点"。而择时，是连基金经理都做不好的事。',
  '💡 真实世界里，定投最大的敌人不是市场，是中途断供的那只手。',
];

export default function DcaGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [list] = useState(readWatchlist);
  const [symbol, setSymbol] = useState(() => {
    try {
      return readWatchlist()[0]?.symbol || 'AAPL';
    } catch {
      return 'AAPL';
    }
  });
  const [months, setMonths] = useState(24);
  const [race, setRace] = useState<Race | null>(null);
  const [guess, setGuess] = useState<'lump' | 'dca' | 'draw' | null>(null);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [resultText, setResultText] = useState('');
  const [resultGood, setResultGood] = useState(false);
  const [tip, setTip] = useState('');
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const raceTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (raceTimer.current) clearInterval(raceTimer.current);
      if (scoreRef.current > 0) recordPlay('dca', scoreRef.current);
    };
  }, []);

  const buildRace = useCallback(async (): Promise<Race | null> => {
    let series = await fetchSeries(symbol);
    if (!series) series = syntheticCandles(900);
    // 按月分组，取每月首个交易日
    const monthFirst: Candle[] = [];
    let cur = '';
    for (const c of series) {
      const m = c.date.slice(0, 7);
      if (m !== cur) {
        cur = m;
        monthFirst.push(c);
      }
    }
    const frames = monthFirst.slice(-months);
    if (frames.length < 6) return null;
    const m = frames.length;
    const lumpShares = (MONTHLY * m) / frames[0].close;
    const lumpVals: number[] = [];
    const dcaVals: number[] = [];
    let dcaShares = 0;
    for (let i = 0; i < m; i++) {
      dcaShares += MONTHLY / frames[i].close;
      lumpVals.push(lumpShares * frames[i].close);
      dcaVals.push(dcaShares * frames[i].close);
    }
    const name = list.find((w) => w.symbol === symbol)?.name || symbol;
    return {
      symbol,
      name,
      months: m,
      lumpVals,
      dcaVals,
      lumpFinal: lumpVals[m - 1],
      dcaFinal: dcaVals[m - 1],
      startDate: frames[0].date,
      endDate: frames[m - 1].date,
    };
  }, [symbol, months, list]);

  const startRace = async (g: 'lump' | 'dca' | 'draw') => {
    setPhase('racing');
    setGuess(g);
    const r = await buildRace();
    if (!r) {
      setPhase('setup');
      return;
    }
    setRace(r);
    setStep(0);
    let s = 0;
    if (raceTimer.current) clearInterval(raceTimer.current);
    raceTimer.current = setInterval(() => {
      s += 1;
      setStep(s);
      if (s >= r.months) {
        if (raceTimer.current) clearInterval(raceTimer.current);
        // 结算
        const diff = (r.dcaFinal - r.lumpFinal) / Math.max(r.dcaFinal, r.lumpFinal);
        const actual = Math.abs(diff) < 0.03 ? 'draw' : r.dcaFinal > r.lumpFinal ? 'dca' : 'lump';
        const correct = g === actual;
        const pts = correct ? 100 : 0;
        setScore((v) => v + pts);
        setResultGood(correct);
        const wname = actual === 'dca' ? '定投' : actual === 'lump' ? '梭哈' : '打平';
        setResultText(
          correct
            ? `🎯 猜对了！${wname}获胜（定投 ${fmtMoney(r.dcaFinal)} vs 梭哈 ${fmtMoney(r.lumpFinal)}），+100 分`
            : `😅 猜错了！实际是${wname}获胜（定投 ${fmtMoney(r.dcaFinal)} vs 梭哈 ${fmtMoney(r.lumpFinal)}）`,
        );
        setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
        setPhase('done');
      }
    }, 130);
  };

  // 画赛跑曲线
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !race) return;
    if (phase === 'racing' || phase === 'done') {
      const n = phase === 'done' ? race.months : Math.max(2, step);
      drawLines(canvas, [
        { label: '梭哈', color: '#f43f5e', values: race.lumpVals.slice(0, n) },
        { label: '定投', color: '#22c55e', values: race.dcaVals.slice(0, n) },
      ]);
    }
  }, [race, phase, step]);

  const fmtMoney = (v: number) =>
    '$' + Math.round(v).toLocaleString('en-US');

  const reset = () => {
    if (raceTimer.current) clearInterval(raceTimer.current);
    setPhase('setup');
    setRace(null);
    setGuess(null);
    setStep(0);
    setResultText('');
  };

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">💰 定投 vs 梭哈</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史行情 · 策略大赛跑 · 本局 {score} 分
        </div>
      </div>

      {phase === 'setup' && (
        <div className="space-y-3">
          <div>
            <p className="text-[11px] text-slate-500 mb-1.5">选一只股票</p>
            <div className="flex flex-wrap gap-1.5">
              {list.slice(0, 10).map((w) => (
                <button
                  key={w.symbol}
                  onClick={() => setSymbol(w.symbol)}
                  className={`text-[11px] px-2.5 py-1.5 rounded-full border ${
                    symbol === w.symbol
                      ? 'bg-sky-600 text-white border-sky-500 font-semibold'
                      : 'text-slate-400 border-slate-700'
                  }`}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 mb-1.5">选一段时间</p>
            <div className="flex gap-1.5">
              {PERIODS.map((p) => (
                <button
                  key={p.months}
                  onClick={() => setMonths(p.months)}
                  className={`flex-1 text-xs py-2 rounded-xl border font-medium ${
                    months === p.months
                      ? 'bg-sky-600 text-white border-sky-500'
                      : 'text-slate-400 border-slate-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            规则：梭哈开局一把投 {fmtMoney(MONTHLY * months)}；定投每月投 {fmtMoney(MONTHLY)}，共 {months} 个月。先猜谁赢，再看比赛！
          </p>
          <button
            onClick={() => setPhase('guess')}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            开始比赛
          </button>
        </div>
      )}

      {phase === 'guess' && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed">
            <span className="font-bold text-slate-100">{list.find((w) => w.symbol === symbol)?.name}</span>
            ，过去 {months / 12} 年，每月 {fmtMoney(MONTHLY)}
          </p>
          <p className="text-sm font-bold text-slate-100">你猜，谁笑到最后？</p>
          <div className="flex gap-2">
            <button
              onClick={() => startRace('lump')}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold"
            >
              🔥 梭哈
            </button>
            <button
              onClick={() => startRace('dca')}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
            >
              🌱 定投
            </button>
            <button
              onClick={() => startRace('draw')}
              className="flex-1 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-500 text-white text-sm font-bold"
            >
              🤝 差不多
            </button>
          </div>
        </div>
      )}

      {(phase === 'racing' || phase === 'done') && race && (
        <div className="space-y-2">
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
            <div className="flex items-center justify-between px-1 pb-1 text-[11px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> 梭哈
                <span className="text-slate-400 tabular-nums">
                  {fmtMoney(race.lumpVals[Math.max(0, Math.min(step, race.months - 1))] || 0)}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 定投
                <span className="text-slate-400 tabular-nums">
                  {fmtMoney(race.dcaVals[Math.max(0, Math.min(step, race.months - 1))] || 0)}
                </span>
              </span>
            </div>
            <canvas ref={canvasRef} className="w-full h-[200px]" />
            {phase === 'racing' && (
              <p className="text-center text-[11px] text-slate-500 pt-1 tabular-nums">
                第 {Math.min(step + 1, race.months)} / {race.months} 个月…
              </p>
            )}
          </div>

          {phase === 'done' && (
            <>
              <div
                className={`rounded-xl p-3 text-center text-xs leading-relaxed border ${
                  resultGood
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-slate-500/10 border-slate-600/40 text-slate-300'
                }`}
              >
                <p className="font-semibold">{resultText}</p>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed px-1">{tip}</p>
              <button
                onClick={reset}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
              >
                再比一场
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
