'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchSeries, syntheticCandles, drawCandles, shortDate, fmtPct, type Candle } from './gameUtils';
import { kindMeta } from '@/lib/financeCalendar';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'loading' | 'ready' | 'answered';

/**
 * 全部为核实过的真实历史事件（2026-09 核实）。
 * 玩法核心：内容本身不重要，重要的是"内容 vs 市场预期"的差值。
 */
interface TrapEvent {
  date: string;
  kind: 'fomc' | 'cpi' | 'nonfarm';
  title: string;
  /** 当时新闻怎么写 */
  headline: string;
  /** 揭晓时讲透这个陷阱 */
  lesson: string;
}

const EVENTS: TrapEvent[] = [
  {
    date: '2024-08-02',
    kind: 'nonfarm',
    title: '美国 7 月非农就业报告',
    headline: '新增就业仅 11.4 万（预期 17.5 万），失业率升至 4.3%，市场开始定价"衰退"',
    lesson: '坏消息=跌？这次是的。但注意：坏消息也抬升了降息预期——同一个数据，多头和空头各取所需。',
  },
  {
    date: '2024-09-18',
    kind: 'fomc',
    title: '美联储议息决议',
    headline: '宣布降息 50 个基点（幅度超部分预期），但鲍威尔发言偏鹰：别指望每次都这么降',
    lesson: '降息 50bp 是大利好吧？结果美股过山车，收盘把涨幅全抹平——利好兑现的那一刻，就是多头获利了结的号角。',
  },
  {
    date: '2024-12-18',
    kind: 'fomc',
    title: '美联储议息决议',
    headline: '降息 25bp 符合预期，但点阵图大放鹰：明年只降息 2 次（之前说 4 次）',
    lesson: '降息了还暴跌？因为市场看的从来不是"降没降"，而是"下一步"。点阵图一鹰，等于告诉市场：好日子提前结束了。',
  },
  {
    date: '2025-09-17',
    kind: 'fomc',
    title: '美联储议息决议',
    headline: '降息 25bp，2025 年首次降息。但这次"已被充分定价"，鲍威尔称只是风险管理式降息',
    lesson: '同样的 25bp，这次市场却补涨——因为"符合预期"本身就是利好。涨跌不取决于消息好坏，取决于消息和预期的差值。',
  },
  {
    date: '2025-12-10',
    kind: 'fomc',
    title: '美联储议息决议',
    headline: '年内第三次降息 25bp，点阵图显示明年只降 1 次（偏鹰），但完全符合市场预期',
    lesson: '点阵图偏鹰，市场却上涨——2024 年 12 月的前车之鉴还记得吗？同样的鹰，这次因为"早被知道了"，就不是事了。',
  },
];

interface Round {
  event: TrapEvent;
  candles: Candle[]; // 16 根：事件日前 10 + 事件日 + 后 5
  fwd: number;
  up: boolean;
}

export default function NewsTrapGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [verdict, setVerdict] = useState('');
  const [verdictGood, setVerdictGood] = useState(false);
  const [gained, setGained] = useState(0);
  const [lesson, setLesson] = useState('');
  const scoreRef = useRef(0);
  scoreRef.current = score;

  const newRound = useCallback(async () => {
    setPhase('loading');
    setVerdict('');
    setLesson('');
    const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];

    let series = await fetchSeries('QQQ');
    if (!series) series = await fetchSeries('SPY');
    if (!series) series = syntheticCandles(400);

    let idx = series.findIndex((c) => c.date >= event.date);
    if (idx < 10 || idx + 5 >= series.length) idx = 10 + Math.floor(Math.random() * (series.length - 16));
    const candles = series.slice(idx - 10, idx + 6);
    const fwd = (candles[15].close - candles[10].close) / candles[10].close;
    setRound({ event, candles, fwd, up: fwd >= 0 });
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
        ? `🎯 猜对了！事件后 5 天${round.up ? '涨' : '跌'} ${fmtPct(round.fwd)}，+${pts} 分${newStreak >= 2 ? `（${newStreak} 连击🔥）` : ''}`
        : `❌ 打脸！事件后 5 天实际${round.up ? '涨' : '跌'} ${fmtPct(round.fwd)}`,
    );
    setLesson(round.event.lesson);
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
  }, [round, phase]);

  const meta = round ? kindMeta(round.event.kind) : null;

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">📰 消息面陷阱</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史大事件 · 猜大盘 5 日涨跌 · 本局 {score} 分
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
            <div className="px-1 pb-1 space-y-1.5">
              <div className="flex items-center gap-1.5">
                {meta && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.chip}`}>
                    {meta.icon} {meta.label}
                  </span>
                )}
                <span className="text-[10px] text-slate-500">{shortDate(round.event.date)}</span>
              </div>
              <p className="text-xs font-semibold text-slate-200">🗞️ {round.event.title}</p>
              <p className="text-[11px] text-amber-200/90 leading-relaxed bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                {round.event.headline}
              </p>
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
              <p className="text-[11px] text-slate-400 leading-relaxed px-1">💡 {lesson}</p>
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
