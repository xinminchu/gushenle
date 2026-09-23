'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { loadColorScheme } from '../../lib/colorScheme';

/* ---------- 数据源：自选列表 ---------- */
const WATCH_KEY = 'gushenle:watchlist:v1';
const BEST_KEY = 'gushenle:kline:best:v1';
const DEFAULT_WATCH = [
  { symbol: 'AAPL', name: '苹果' },
  { symbol: 'NVDA', name: '英伟达' },
  { symbol: 'MSFT', name: '微软' },
  { symbol: 'TSLA', name: '特斯拉' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'MSTR', name: '微策略' },
];

function readWatchlist(): { symbol: string; name: string }[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return DEFAULT_WATCH;
    const j = JSON.parse(raw);
    const items = Array.isArray(j?.items) ? j.items : [];
    const cleaned = items
      .filter((it: unknown) => it && typeof (it as { symbol?: unknown }).symbol === 'string')
      .map((it: { symbol: string; name?: string }) => ({
        symbol: it.symbol.toUpperCase(),
        name: it.name || it.symbol.toUpperCase(),
      }));
    return cleaned.length > 0 ? cleaned : DEFAULT_WATCH;
  } catch {
    return DEFAULT_WATCH;
  }
}

type Candle = { date: string; open: number; high: number; low: number; close: number };

type Round = {
  symbol: string;
  name: string;
  candles: Candle[]; // 固定 25 根
  visible: number; // 作答前展示根数（常规 20，挑战 15）
  challenge: boolean;
  answerUp: boolean;
  startDate: string;
  endDate: string;
};

type Phase = 'loading' | 'ready' | 'answered';

function normalizeSeries(raw: unknown[]): Candle[] {
  return (raw || [])
    .filter((k) => k && typeof (k as { close?: unknown }).close === 'number' && typeof (k as { date?: unknown }).date === 'string')
    .map((k) => {
      const c = k as { date: string; open?: number; high?: number; low?: number; close: number };
      const close = c.close;
      return {
        date: c.date,
        open: typeof c.open === 'number' ? c.open : close,
        high: typeof c.high === 'number' ? c.high : close,
        low: typeof c.low === 'number' ? c.low : close,
        close,
      };
    });
}

/** 本地兜底：随机生成 25 根 K 线（日期倒推至今天） */
function syntheticCandles(symbol: string): Candle[] {
  const out: Candle[] = [];
  let price = 80 + Math.random() * 120;
  const today = new Date();
  for (let i = 24; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const open = price;
    const drift = (Math.random() - 0.47) * price * 0.04;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);
    out.push({
      date: d.toISOString().slice(0, 10),
      open, high, low, close,
    });
    price = close;
  }
  return out;
}

const shortDate = (d: string) => d.slice(5).replace('-', '/'); // MM/DD

/* ---------- 答后小悟：输了安慰、连对泼冷水 ---------- */
const TIP_WRONG = '💡 猜错了很正常：20 根 K 线猜 5 天，长期胜率就是 50% 上下。不是你笨，是短期涨跌本来接近随机。';
const TIP_STREAK = '💡 连击正旺，泼盆冷水：连对几次多半是运气，这时候最容易觉得自己"开悟了"——恰恰是最该冷静的时候。';
const TIPS_ROTATE = [
  '💡 同样 20 根线，放在牛市主升浪和震荡市里含义完全不同。光看形状不看市况，等于蒙。',
  '💡 感觉会骗人，台账不会。这个游戏就是在拿真实数据给你做"人肉回测"。',
  '💡 这个游戏真正的奖品不是积分，是让你对"看图猜涨跌"祛魅。',
  '💡 K 线里大多是噪声。人脑天生爱找规律，但短期价格里规律很少、噪声很多。',
];

export default function KLineBoxGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [round, setRound] = useState<Round | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [q, setQ] = useState(0);
  const [best, setBest] = useState({ best: 0, streak: 0 });
  const [resultText, setResultText] = useState('');
  const [resultGood, setResultGood] = useState(false);
  const [gained, setGained] = useState(0);
  const [tip, setTip] = useState('');

  const newRound = useCallback(async (streakNow: number) => {
    setPhase('loading');
    setResultText('');
    setTip('');
    const list = readWatchlist();
    const pick = list[Math.floor(Math.random() * list.length)];
    let candles: Candle[] | null = null;
    try {
      const r = await fetch(`/api/rhythm?symbol=${pick.symbol}&range=ALL`);
      const j = (await r.json()) as { series?: unknown[] };
      const series = normalizeSeries(j.series || []);
      if (series.length >= 30) {
        const start = Math.floor(Math.random() * (series.length - 29));
        candles = series.slice(start, start + 25);
      }
    } catch {
      candles = null;
    }
    if (!candles) candles = syntheticCandles(pick.symbol);
    const visible = streakNow >= 3 ? 15 : 20;
    const answerUp = candles[visible + 4].close >= candles[visible - 1].close;
    setRound({
      symbol: pick.symbol,
      name: pick.name,
      candles,
      visible,
      challenge: visible === 15,
      answerUp,
      startDate: candles[0].date,
      endDate: candles[24].date,
    });
    setQ((v) => v + 1);
    setPhase('ready');
  }, []);

  // 挂载：读最佳成绩 + 出第一题
  useEffect(() => {
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) {
        const j = JSON.parse(raw) as { best?: number; streak?: number };
        setBest({ best: j.best || 0, streak: j.streak || 0 });
      }
    } catch {
      /* 忽略 */
    }
    newRound(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guess = (up: boolean) => {
    if (phase !== 'ready' || !round) return; // 防连点
    const correct = up === round.answerUp;
    const newStreak = correct ? streak + 1 : 0;
    const pts = correct ? 100 + (newStreak >= 2 ? 50 * (newStreak - 2) : 0) : 0;
    const newScore = score + pts;
    setStreak(newStreak);
    setScore(newScore);
    setGained(pts);
    setResultGood(correct);
    setResultText(
      correct
        ? `🎯 猜对了！+${pts} 分${newStreak >= 2 ? `（${newStreak} 连击🔥）` : ''}`
        : '❌ 猜错了，连击清零，再接再厉！'
    );
    setTip(!correct ? TIP_WRONG : newStreak >= 3 ? TIP_STREAK : TIPS_ROTATE[q % TIPS_ROTATE.length]);
    const nb = { best: Math.max(best.best, newScore), streak: Math.max(best.streak, newStreak) };
    setBest(nb);
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(nb));
    } catch {
      /* 忽略 */
    }
    setPhase('answered');
  };

  /* ---------- 画 K 线 ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !round) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = 320, H = 200;
    const DPR = 2;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const scheme = loadColorScheme();
    const upColor = scheme === 'cn' ? '#ef4444' : '#22c55e';
    const dnColor = scheme === 'cn' ? '#22c55e' : '#ef4444';

    const padL = 38, padR = 8, padT = 14, padB = 18;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const N = 25;
    const slotW = plotW / N;
    const barW = Math.max(4, slotW * 0.62);

    const revealed = phase === 'answered';
    const count = revealed ? N : round.visible;

    let lo = Infinity, hi = -Infinity;
    round.candles.forEach((c) => {
      lo = Math.min(lo, c.low);
      hi = Math.max(hi, c.high);
    });
    if (hi - lo < 1e-9) { hi = lo + 1; }
    const pad = (hi - lo) * 0.08;
    hi += pad; lo -= pad;
    const y = (p: number) => padT + plotH - ((p - lo) / (hi - lo)) * plotH;

    // 未来 5 日区域底色
    const fx = padL + round.visible * slotW;
    ctx.fillStyle = 'rgba(148,163,184,0.08)';
    ctx.fillRect(fx, padT, W - padR - fx, plotH);
    ctx.strokeStyle = '#475569';
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(fx, padT, W - padR - fx, plotH);
    ctx.setLineDash([]);
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('未来 5 日', fx + (W - padR - fx) / 2, padT - 3);

    // 横向网格线 + 价格标签
    ctx.textAlign = 'right';
    for (let g = 0; g < 4; g++) {
      const p = lo + ((hi - lo) * g) / 3;
      const gy = y(p);
      ctx.strokeStyle = 'rgba(100,116,139,0.25)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, gy);
      ctx.lineTo(W - padR, gy);
      ctx.stroke();
      ctx.fillStyle = g === 0 ? '#f87171' : g === 3 ? '#4ade80' : '#64748b';
      ctx.fillText(p.toFixed(2), padL - 4, gy + 3);
    }

    // 蜡烛
    for (let i = 0; i < count; i++) {
      const c = round.candles[i];
      const cx = padL + i * slotW + slotW / 2;
      const isUp = c.close >= c.open;
      const col = isUp ? upColor : dnColor;
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, y(c.high));
      ctx.lineTo(cx, y(c.low));
      ctx.stroke();
      const yO = y(c.open), yC = y(c.close);
      ctx.fillStyle = col;
      const top = Math.min(yO, yC);
      const hgt = Math.max(2, Math.abs(yC - yO));
      ctx.fillRect(cx - barW / 2, top, barW, hgt);
    }

    // 日期标签
    ctx.fillStyle = '#64748b';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(shortDate(round.candles[0].date), padL, H - 5);
    ctx.textAlign = 'right';
    const lastShown = round.candles[count - 1].date;
    ctx.fillText(revealed ? shortDate(round.endDate) : shortDate(lastShown), W - padR, H - 5);
  }, [round, phase]);

  return (
    <div className="bg-[#0b0f19] rounded-2xl p-4 flex flex-col items-center">
      <div className="text-lg font-bold text-amber-400">历史 K 线盲盒</div>

      {/* 场次信息 */}
      <div className="mt-1 text-xs text-slate-400">
        {round ? (
          <>第 <b className="text-slate-200">{q}</b> 题 · <b className="text-slate-200">{round.symbol}</b> {round.name}</>
        ) : (
          '准备中…'
        )}
        {round?.challenge && (
          <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/40">
            🔥 挑战模式
          </span>
        )}
      </div>

      {/* HUD */}
      <div className="mt-2 text-xs text-slate-400 bg-[#10172a] border border-slate-700/60 rounded-full px-3 py-1">
        得分 <b className="text-slate-100">{score}</b>
        {' · '}连击 <b className="text-slate-100">{streak}</b>
        {' · '}最佳 <b className="text-amber-300">{best.best}</b> 分
        {best.streak > 0 && <span className="text-slate-500">（{best.streak} 连击）</span>}
      </div>

      {/* K 线画布 */}
      <canvas
        ref={canvasRef}
        width={640}
        height={400}
        className="w-full h-auto mt-3 rounded-xl bg-[#0f172a]"
      />

      {phase === 'loading' && (
        <div className="mt-3 text-sm text-slate-400">正在抽取真实 K 线…</div>
      )}

      {/* 作答按钮 */}
      {phase !== 'loading' && (
        <div className="w-full mt-3">
          {phase === 'ready' ? (
            <>
              <div className="text-center text-xs text-slate-500 mb-2">
                {round?.challenge
                  ? '只给你看 15 根 K 线，盲猜未来 5 个交易日相对最后一根收盘是涨是跌'
                  : '盲猜未来 5 个交易日相对最后一根收盘是涨是跌'}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => guess(true)}
                  className="flex-1 py-3 rounded-xl bg-green-500 font-bold text-white text-[15px] active:scale-95 transition"
                >
                  📈 看涨
                </button>
                <button
                  onClick={() => guess(false)}
                  className="flex-1 py-3 rounded-xl bg-red-500 font-bold text-white text-[15px] active:scale-95 transition"
                >
                  📉 看跌
                </button>
              </div>
            </>
          ) : (
            <>
              <div
                className={`text-center text-[15px] font-bold ${resultGood ? 'text-green-400' : 'text-red-400'}`}
              >
                {resultText}
              </div>
              {round && (
                <div className="text-center text-xs text-slate-400 mt-1 leading-relaxed">
                  这是 <b className="text-slate-200">{round.symbol}</b> {round.name}
                  <br />
                  {round.startDate} ~ {round.endDate} 这段真实走势
                </div>
              )}
              {tip && (
                <div className="mt-2 text-xs leading-relaxed text-amber-200/90 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-2">
                  {tip}
                </div>
              )}
              <button
                onClick={() => newRound(streak)}
                className="w-full mt-3 py-3 rounded-xl bg-blue-500 font-bold text-white text-[15px] active:scale-95 transition"
              >
                下一题 🔄
              </button>
            </>
          )}
        </div>
      )}

      <div className="mt-2 text-[10px] text-slate-600">
        猜对 +100 分，连击≥2 每次多 +50；猜错连击清零 · 3 连击进入挑战模式
      </div>
    </div>
  );
}
