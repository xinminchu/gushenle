'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSeries, syntheticCandles, drawCandles, shortDate, fmtPct, type Candle } from './gameUtils';
import { getStaticEvents, kindMeta, type CalEvent } from '@/lib/financeCalendar';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'loading' | 'ready' | 'answered';

interface Round {
  event: CalEvent;
  candles: Candle[]; // 16 根：事件日前 10 + 事件日 + 后 5
  eventIdx: number; // 10
  fwd: number; // 事件日后 5 日涨跌幅
  up: boolean;
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const TIPS = [
  '💡 市场从不为"消息本身"涨跌，只为"超预期还是不及预期"涨跌。符合预期的利好，常常高开低走。',
  '💡 "利好出尽是利空"——靴子落地那一刻，多头就开始获利了结了。',
  '💡 盯着消息炒股的人，永远在追市场的影子。影子动的时候，身子早就动完了。',
  '💡 下次看到"突发利好"心跳加速时，先问自己：这个消息，价格里是不是已经包含一半了？',
];

export default function NewsTrapGame() {
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
    const today = todayStr();
    const pool = getStaticEvents().filter(
      (e) => (e.kind === 'fomc' || e.kind === 'cpi' || e.kind === 'nonfarm') && e.date < today && e.date >= '2024-01-01',
    );
    const event: CalEvent = pool.length > 0
      ? pool[Math.floor(Math.random() * pool.length)]
      : { date: '2025-06-18', title: '美联储议息决议', kind: 'fomc' };

    let series = await fetchSeries('QQQ');
    if (!series) series = await fetchSeries('SPY');
    if (!series) series = syntheticCandles(400);

    let idx = series.findIndex((c) => c.date >= event.date);
    if (idx < 10 || idx + 5 >= series.length) idx = 10 + Math.floor(Math.random() * (series.length - 16));
    const candles = series.slice(idx - 10, idx + 6); // 16 根
    const fwd = (candles[15].close - candles[10].close) / candles[10].close;
    setRound({ event, candles, eventIdx: 10, fwd, up: fwd >= 0 });
    setQ((v) => v + 1);
    setPhase('ready');
  }, []);

  useEffect(() => {
    newRound();
    return () => {
      if (scoreRef.current > 0) recordPlay('newstrap', scoreRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guess = (up: boolean) => {
    if (phase !== 'ready' || !round) return;
    const correct = up === round.up;
    const newStreak = correct ? streak + 1 : 0;
    const pts = correct ? 100 + (streak >= 1 ? 50 * streak : 0) : 0;
    setStreak(newStreak);
    setScore((s) => s + pts);
    setGained(pts);
    setVerdictGood(correct);
    setVerdict(
      correct
        ? `🎯 猜对了！事件后 5 天 ${round.up ? '涨' : '跌'} ${fmtPct(round.fwd)}，+${pts} 分${newStreak >= 2 ? `（${newStreak} 连击🔥）` : ''}`
        : `❌ 打脸了！你以为${up ? '涨' : '跌'}，实际${round.up ? '涨' : '跌'} ${fmtPct(round.fwd)}——消息和走势，经常反着来`,
    );
    setTip(TIPS[q % TIPS.length]);
    setPhase('answered');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !round) return;
    if (phase === 'ready') {
      drawCandles(canvas, round.candles.slice(0, 11), { markerAt: 10, markerLabel: '事件日' });
    } else if (phase === 'answered') {
      drawCandles(canvas, round.candles, {
        highlightFrom: 11,
        markerAt: 10,
        markerLabel: '事件日',
      });
    }
  }, [round, phase, q]);

  const meta = round ? kindMeta(round.event.kind) : null;

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">📰 消息面陷阱</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史事件 · 猜大盘 5 日涨跌 · 本局 {score} 分
          {streak >= 2 && <span className="text-orange-400"> · {streak} 连击🔥</span>}
        </div>
      </div>

      {phase === 'loading' || !round ? (
        <div className="h-[200px] flex items-center justify-center text-xs text-slate-500">
          正在翻历史旧账…
        </div>
      ) : (
        <>
          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-2">
            <div className="px-1 pb-1 space-y-1">
              <div className="flex items-center gap-1.5">
                {meta && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.chip}`}>
                    {meta.icon} {meta.label}
                  </span>
                )}
                <span className="text-[10px] text-slate-500">{shortDate(round.event.date)}</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">🗞️ {round.event.title}</p>
            </div>
            <canvas ref={canvasRef} className="w-full h-[200px]" />
          </div>

          {phase === 'ready' ? (
            <div className="bg-violet-500/10 border border-violet-500/30 rounded-xl p-3 text-center space-y-2">
              <p className="text-sm font-bold text-slate-100">消息落地后 5 个交易日，大盘会？</p>
              <div className="flex gap-2">
                <button
                  onClick={() => guess(true)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold"
                >
                  📈 看涨
                </button>
                <button
                  onClick={() => guess(false)}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold"
                >
                  📉 看跌
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                className={`rounded-xl p-3 text-center text-xs leading-relaxed border ${
                  verdictGood
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
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
