'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  readWatchlist,
  DEFAULT_WATCH,
  fetchSeries,
  fmtPct,
  bullBearColors,
  type Candle,
} from './gameUtils';
import { recordPlay, recordSession } from '@/lib/gameStats';

type Phase = 'setup' | 'loading' | 'ready' | 'spinning' | 'landed' | 'reveal';

interface WheelStock {
  symbol: string;
  name: string;
  pct: number; // "买入日"前一交易日涨跌幅
  next5: number; // 买入后 5 天涨跌幅
}

const SIZE = 300;
const C = SIZE / 2;
const R = 132;

const TIPS = [
  '💡 《漫步华尔街》说：蒙眼扔飞镖选的股票，长期真没输给专家多少——转盘也一样，短期涨跌大多是噪音，随机选股赢大盘不稀奇。',
  '💡 转盘停在哪只全凭运气，但"拿住"靠的是纪律。运气给机会，纪律保成果。',
  '💡 真实交易里可没有"揭晓"按钮——买之前先想好：跌了怎么办，涨了怎么办。',
];

export default function WheelGame() {
  const [phase, setPhase] = useState<Phase>('setup');
  const [stocks, setStocks] = useState<WheelStock[]>([]);
  const [dayLabel, setDayLabel] = useState('');
  const [qqq5, setQqq5] = useState(0);
  const [winIdx, setWinIdx] = useState(-1);
  const [angle, setAngle] = useState(0);
  const [score, setScore] = useState(0);
  const [tip, setTip] = useState('');
  const [err, setErr] = useState('');
  const angleRef = useRef(0);
  const rafRef = useRef(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const { up, down } = bullBearColors();

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (scoreRef.current > 0) recordPlay('wheel', scoreRef.current);
    };
  }, []);

  // ---- 准备数据：随机挑历史某一天当"买入日"（照抄 DartGame） ----
  const prepare = useCallback(async (): Promise<boolean> => {
    const raw = readWatchlist().slice(0, 12);
    const wl = raw.length >= 3 ? raw : DEFAULT_WATCH;
    const all = await Promise.all([...wl.map((w) => fetchSeries(w.symbol)), fetchSeries('QQQ')]);
    const qqqSeries = all[all.length - 1];
    const items: { w: { symbol: string; name: string }; s: Candle[] }[] = [];
    wl.forEach((w, i) => {
      if (all[i] && all[i]!.length >= 40) items.push({ w, s: all[i]! });
    });
    if (items.length < 3 || !qqqSeries || qqqSeries.length < 40) {
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
      if (idxs.some((j) => j < 0) || qj === undefined || qj < 1 || qj + 5 >= qqqSeries.length)
        continue;
      const ds: WheelStock[] = items.map(({ w, s }, k) => {
        const j = idxs[k];
        return {
          symbol: w.symbol,
          name: w.name,
          pct: s[j].close / s[j - 1].close - 1,
          next5: s[j + 5].close / s[j].close - 1,
        };
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
    setWinIdx(-1);
    const ok = await prepare();
    setPhase(ok ? 'ready' : 'setup');
  };

  // ---- 转动：easeOutCubic 减速，2.5~3.5 秒停在随机扇区 ----
  const spin = () => {
    if (phase !== 'ready' || stocks.length === 0) return;
    setPhase('spinning');
    recordSession('wheel'); // 每次转动记一次游玩
    const n = stocks.length;
    const step = 360 / n;
    const target = Math.floor(Math.random() * n);
    // 指针固定在顶部(-90°)；扇区 i 的中心在轮盘本地坐标 -90 + (i+0.5)*step
    const cTarget = -90 + (target + 0.5) * step;
    const from = angleRef.current;
    let finalA = -90 - cTarget;
    while (finalA < from + 360 * 5) finalA += 360; // 至少转 5 圈
    const dur = 2500 + Math.random() * 1000;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const a = from + (finalA - from) * e;
      angleRef.current = a;
      setAngle(a);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setWinIdx(target);
        setPhase('landed');
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const hit = winIdx >= 0 ? stocks[winIdx] : null;
  const win = hit ? hit.next5 > qqq5 : false;

  const reveal = () => {
    if (win) setScore((v) => v + 100);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setPhase('reveal');
  };

  const again = () => {
    setWinIdx(-1);
    start();
  };

  // ---- 转盘 SVG ----
  const n = stocks.length;
  const step = n > 0 ? 360 / n : 360;
  const pt = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return `${(C + r * Math.cos(a)).toFixed(1)},${(C + r * Math.sin(a)).toFixed(1)}`;
  };
  const dimmed = phase === 'landed' || phase === 'reveal';

  const wheel = n > 0 && (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full aspect-square">
      {/* 底盘 */}
      <circle cx={C} cy={C} r={R + 12} fill="#0b1220" stroke="#334155" strokeWidth="2" />
      <g transform={`rotate(${angle} ${C} ${C})`}>
        {stocks.map((s, i) => {
          const a0 = -90 + i * step;
          const a1 = -90 + (i + 1) * step;
          const mid = (a0 + a1) / 2;
          const ma = (mid * Math.PI) / 180;
          const tx = C + R * 0.62 * Math.cos(ma);
          const ty = C + R * 0.62 * Math.sin(ma);
          const isWin = i === winIdx;
          return (
            <g key={s.symbol} opacity={dimmed && !isWin ? 0.35 : 1}>
              <path
                d={`M ${C},${C} L ${pt(a0, R)} A ${R},${R} 0 0 1 ${pt(a1, R)} Z`}
                fill={i % 2 === 0 ? '#16233a' : '#0f1a2e'}
                stroke={isWin ? '#fbbf24' : '#334155'}
                strokeWidth={isWin ? 2.5 : 1}
              />
              <text
                x={tx}
                y={ty}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="15"
                fontWeight="bold"
                fill={s.pct >= 0 ? up : down}
              >
                {s.symbol}
              </text>
            </g>
          );
        })}
        {/* 中轴 */}
        <circle cx={C} cy={C} r={26} fill="#0b1220" stroke="#fbbf24" strokeWidth="2" />
        <text x={C} y={C} textAnchor="middle" dominantBaseline="middle" fontSize="20">
          🎡
        </text>
      </g>
      {/* 顶部指针（固定不动） */}
      <polygon
        points={`${C - 10},4 ${C + 10},4 ${C},26`}
        fill="#fbbf24"
        stroke="#0f172a"
        strokeWidth="1"
      />
    </svg>
  );

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <div className="text-center">
        <div className="text-base font-bold text-slate-200">🎡 转转盘买股</div>
        <div className="text-sm text-slate-500 mt-0.5">
          真实历史行情 · 随缘选股挑战 · 本局 {score} 分
        </div>
      </div>

      {phase === 'setup' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-xl p-3">
            《漫步华尔街》说：
            <span className="text-slate-100 font-semibold">蒙眼扔飞镖选的股票，不输华尔街专家</span>
            。今天换个玩法——自选股摆上转盘，转到哪只就"买入"哪只，再看它后 5
            天能不能跑赢大盘。
          </p>
          <p className="text-sm text-slate-500 leading-relaxed px-1">
            小说明：用历史上的某一天当"买入日"，这样才能揭晓后 5 天的真实走势。
            <span className="text-violet-300/80">💡 创意：@vipdongxia</span>
          </p>
          {err && <p className="text-xs text-rose-300 px-1">{err}</p>}
          <button
            onClick={start}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-base font-bold"
          >
            开始转转盘
          </button>
        </div>
      )}

      {phase === 'loading' && (
        <p className="text-center text-sm text-slate-400 py-10">正在准备转盘…🎡</p>
      )}

      {(phase === 'ready' || phase === 'spinning') && (
        <div className="space-y-2">
          {wheel}
          <p className="text-center text-sm text-slate-500">
            买入日 {dayLabel} · 扇区颜色 = 前一交易日涨跌
          </p>
          <button
            onClick={spin}
            disabled={phase !== 'ready'}
            className="w-full py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-base font-bold"
          >
            {phase === 'ready' ? '🎡 转动！' : '转盘转动中…'}
          </button>
        </div>
      )}

      {phase === 'landed' && hit && (
        <div className="space-y-2">
          {wheel}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-base font-bold text-slate-100">
              🎡 转到了！{hit.name}（{hit.symbol}）
            </p>
            <p className="text-sm text-slate-400 mt-1">
              前一日涨跌 <span style={{ color: hit.pct >= 0 ? up : down }}>{fmtPct(hit.pct)}</span>
              ，已"买入"
            </p>
          </div>
          <button
            onClick={reveal}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-base font-bold"
          >
            揭晓后 5 天走势
          </button>
        </div>
      )}

      {phase === 'reveal' && hit && (
        <div className="space-y-2">
          <div
            className={`rounded-xl p-3 text-center text-sm leading-relaxed border ${
              win
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-slate-500/10 border-slate-600/40 text-slate-300'
            }`}
          >
            <p className="font-semibold text-base">{win ? '🚀 缘分赢了！+100 分' : '📉 这次大盘更稳'}</p>
            <p className="mt-1 tabular-nums">
              {hit.name} 后 5 天{' '}
              <span style={{ color: hit.next5 >= 0 ? up : down }}>{fmtPct(hit.next5)}</span>
              {' · '}大盘 QQQ{' '}
              <span style={{ color: qqq5 >= 0 ? up : down }}>{fmtPct(qqq5)}</span>
            </p>
          </div>
          <p className="text-sm text-slate-400 leading-relaxed px-1">{tip}</p>
          <button
            onClick={again}
            className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-base font-bold"
          >
            再转一次
          </button>
        </div>
      )}
    </div>
  );
}
