'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  readWatchlist,
  fetchSeries,
  fmtPct,
  bullBearColors,
  type Candle,
} from './gameUtils';
import { recordPlay } from '@/lib/gameStats';

type Phase = 'setup' | 'loading' | 'aim' | 'flying' | 'hit' | 'reveal';

interface DartStock {
  symbol: string;
  name: string;
  pct: number; // "昨日"涨跌幅
  next5: number; // 后 5 天涨跌幅
  x: number;
  y: number;
}

const SIZE = 300;
const C = SIZE / 2;
const R_MIN = 48;
const R_MAX = 130;

const TIPS = [
  '💡 《漫步华尔街》里，蒙眼扔飞镖选的股票组合，长期真没输给专家多少——因为短期涨跌大多是噪音。',
  '💡 飞镖命中哪只全凭运气，但"拿住"靠的是纪律。运气给机会，纪律保成果。',
  '💡 盘面上离靶心越远，说明"昨日"涨得越猛——而追高，往往就是从这儿开始的。',
];

const polar = (theta: number, r: number) => ({
  x: C + r * Math.cos(theta),
  y: C + r * Math.sin(theta),
});

export default function DartGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('setup');
  const [list] = useState(readWatchlist);
  const [stocks, setStocks] = useState<DartStock[]>([]);
  const [dayLabel, setDayLabel] = useState('');
  const [qqq5, setQqq5] = useState(0);
  const [hitIdx, setHitIdx] = useState(-1);
  const [score, setScore] = useState(0);
  const [tip, setTip] = useState('');
  const [err, setErr] = useState('');
  const dartPos = useRef<{ x: number; y: number } | null>(null);
  const rafRef = useRef(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (scoreRef.current > 0) recordPlay('dart', scoreRef.current);
    };
  }, []);

  // ---- 画飞镖盘 ----
  const draw = useCallback((dart?: { x: number; y: number } | null) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { up, down } = bullBearColors();
    ctx.clearRect(0, 0, SIZE, SIZE);

    // 底盘
    ctx.beginPath();
    ctx.arc(C, C, R_MAX + 14, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1220';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    // 同心圆环
    ctx.lineWidth = 1;
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(C, C, R_MIN + ((R_MAX - R_MIN) * k) / 3, 0, Math.PI * 2);
      ctx.strokeStyle = '#1e293b';
      ctx.stroke();
    }
    // 扇区线
    const n = stocks.length;
    ctx.strokeStyle = '#1e293b';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / n;
      ctx.beginPath();
      ctx.moveTo(C + Math.cos(a) * 18, C + Math.sin(a) * 18);
      ctx.lineTo(C + Math.cos(a) * (R_MAX + 14), C + Math.sin(a) * (R_MAX + 14));
      ctx.stroke();
    }
    // 靶心
    ctx.beginPath();
    ctx.arc(C, C, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#f43f5e';
    ctx.fill();

    // 股票点位
    ctx.textAlign = 'center';
    stocks.forEach((s, i) => {
      const isHit = phase === 'hit' || phase === 'reveal' ? i === hitIdx : false;
      ctx.beginPath();
      ctx.arc(s.x, s.y, isHit ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = s.pct >= 0 ? up : down;
      ctx.fill();
      ctx.lineWidth = isHit ? 3 : 1.5;
      ctx.strokeStyle = isHit ? '#fbbf24' : '#0f172a';
      ctx.stroke();
      ctx.font = 'bold 10px system-ui';
      ctx.fillStyle = isHit ? '#fbbf24' : '#e2e8f0';
      ctx.fillText(s.symbol, s.x, s.y - 12);
      ctx.font = '9px system-ui';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(fmtPct(s.pct), s.x, s.y + 20);
    });

    // 飞镖
    if (dart) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(dart.x, dart.y - 30);
      ctx.lineTo(dart.x, dart.y);
      ctx.stroke();
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.moveTo(dart.x - 7, dart.y - 30);
      ctx.lineTo(dart.x + 7, dart.y - 30);
      ctx.lineTo(dart.x, dart.y - 20);
      ctx.closePath();
      ctx.fill();
    }
  }, [stocks, phase, hitIdx]);

  useEffect(() => {
    if (phase === 'aim' || phase === 'hit' || phase === 'reveal') draw(dartPos.current);
  }, [phase, stocks, hitIdx, draw]);

  // ---- 准备数据：随机挑历史某一天当"昨日" ----
  const prepare = useCallback(async (): Promise<boolean> => {
    const wl = readWatchlist().slice(0, 8);
    if (wl.length < 3) {
      setErr(`自选只有 ${wl.length} 只股票，至少 3 只才能摆飞镖盘，去今日页「管理自选」加点吧`);
      return false;
    }
    const all = await Promise.all([...wl.map((w) => fetchSeries(w.symbol)), fetchSeries('QQQ')]);
    const qqqSeries = all[all.length - 1];
    const items: { w: { symbol: string; name: string }; s: Candle[] }[] = [];
    wl.forEach((w, i) => {
      if (all[i] && all[i]!.length >= 60) items.push({ w, s: all[i]! });
    });
    if (items.length < 3 || !qqqSeries || qqqSeries.length < 60) {
      setErr('行情数据没拉全，换个网络再试一次');
      return false;
    }
    const maps = items.map(({ s }) => {
      const m = new Map<string, number>();
      s.forEach((c, i) => m.set(c.date, i));
      return m;
    });
    const qMap = new Map<string, number>();
    qqqSeries.forEach((c, i) => qMap.set(c.date, i));
    const base = items[0].s;

    for (let t = 0; t < 30; t++) {
      const i = 10 + Math.floor(Math.random() * (base.length - 20));
      const D = base[i].date;
      const idxs = items.map(({ s }, k) => {
        const j = maps[k].get(D);
        return j === undefined || j < 1 || j + 5 >= s.length ? -1 : j;
      });
      const qj = qMap.get(D);
      if (idxs.some((j) => j < 0) || qj === undefined || qj < 1 || qj + 5 >= qqqSeries.length) continue;
      const n = items.length;
      const ds: DartStock[] = items.map(({ w, s }, k) => {
        const j = idxs[k];
        const pct = s[j].close / s[j - 1].close - 1;
        const next5 = s[j + 5].close / s[j].close - 1;
        const theta = -Math.PI / 2 + (k * Math.PI * 2) / n;
        const r = R_MIN + ((Math.max(-0.06, Math.min(0.06, pct)) + 0.06) / 0.12) * (R_MAX - R_MIN);
        const { x, y } = polar(theta, r);
        return { symbol: w.symbol, name: w.name, pct, next5, x, y };
      });
      setStocks(ds);
      setDayLabel(D);
      setQqq5(qqqSeries[qj + 5].close / qqqSeries[qj].close - 1);
      setErr('');
      return true;
    }
    setErr('没找到合适的历史日期，重试一次');
    return false;
  }, []);

  const start = async () => {
    setPhase('loading');
    dartPos.current = null;
    setHitIdx(-1);
    const ok = await prepare();
    setPhase(ok ? 'aim' : 'setup');
  };

  // ---- 扔飞镖 ----
  const throwDart = () => {
    if (phase !== 'aim' || stocks.length === 0) return;
    setPhase('flying');
    const ang = Math.random() * Math.PI * 2;
    const rr = Math.sqrt(Math.random()) * (R_MAX + 6);
    const target = polar(ang, rr);
    const from = { x: C, y: SIZE + 12 };
    const t0 = performance.now();
    const DUR = 900;
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / DUR);
      const e = 1 - Math.pow(1 - t, 3);
      const p = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e };
      dartPos.current = p;
      draw(p);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        let best = 0;
        let bestD = Infinity;
        stocks.forEach((s, i) => {
          const d = (s.x - target.x) ** 2 + (s.y - target.y) ** 2;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        setHitIdx(best);
        setPhase('hit');
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const hit = hitIdx >= 0 ? stocks[hitIdx] : null;
  const win = hit ? hit.next5 > qqq5 : false;

  const reveal = () => {
    if (win) setScore((v) => v + 100);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setPhase('reveal');
  };

  const again = () => {
    dartPos.current = null;
    setHitIdx(-1);
    start();
  };

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🎯 飞镖选股</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          真实历史行情 · 蒙眼选股挑战 · 本局 {score} 分
        </div>
      </div>

      {phase === 'setup' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            《漫步华尔街》说：<span className="text-slate-100 font-semibold">蒙眼扔飞镖选的股票，不输华尔街专家</span>。
            今天你就是那只手——自选股按"昨日"涨幅摆上飞镖盘（涨得越猛离靶心越远），扔中哪只就"买入"哪只，再看它后 5 天能不能跑赢大盘。
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            小说明：用历史上的某一天当"昨日"，这样才能揭晓后 5 天的真实走势。
            <span className="text-violet-300/80">💡 创意来自 @大西洋龙虾</span>
          </p>
          {err && <p className="text-[11px] text-rose-300 px-1">{err}</p>}
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            摆好飞镖盘
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <p className="text-center text-xs text-slate-400 py-10">正在摆飞镖盘…🎯</p>
      )}

      {(phase === 'aim' || phase === 'flying') && (
        <div className="space-y-2">
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="w-full aspect-square" />
          <p className="text-center text-[11px] text-slate-500">
            "昨日"（{dayLabel}）涨幅决定站位，离靶心越远涨得越猛
          </p>
          <button
            onClick={throwDart}
            disabled={phase !== 'aim'}
            className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-bold"
          >
            {phase === 'aim' ? '🎯 扔飞镖！' : '飞镖飞行中…'}
          </button>
        </div>
      )}

      {phase === 'hit' && hit && (
        <div className="space-y-2">
          <canvas ref={canvasRef} width={SIZE} height={SIZE} className="w-full aspect-square" />
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-slate-100">
              🎯 命中！{hit.name}（{hit.symbol}）
            </p>
            <p className="text-xs text-slate-400 mt-1">"昨日"涨幅 {fmtPct(hit.pct)}，已"买入"</p>
          </div>
          <button
            onClick={reveal}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            揭晓后 5 天走势
          </button>
        </div>
      )}

      {phase === 'reveal' && hit && (
        <div className="space-y-2">
          <div
            className={`rounded-xl p-3 text-center text-xs leading-relaxed border ${
              win
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-slate-500/10 border-slate-600/40 text-slate-300'
            }`}
          >
            <p className="font-semibold text-sm">
              {win ? '🚀 飞镖赢了！+100 分' : '📉 这次大盘更稳'}
            </p>
            <p className="mt-1 tabular-nums">
              {hit.name} 后 5 天 {fmtPct(hit.next5)} · 大盘 QQQ {fmtPct(qqq5)}
            </p>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">{tip}</p>
          <button
            onClick={again}
            className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-sm font-bold"
          >
            再扔一次
          </button>
        </div>
      )}
    </div>
  );
}
