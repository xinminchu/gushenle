// src/components/games/ReplayGame.tsx
// 历史重演局：一段真实历史行情（隐去名字和日期），猜接下来 20 个交易日发生了什么。
// 揭晓给真实标的、真实日期、真实涨幅，并与同期 QQQ 对比——玩的是猜，学的是「个股 vs 大盘」。
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { zh2hant } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';
import { recordPlay } from '@/lib/gameStats';
import type { SeriesPoint } from '@/lib/box';

const POOL = ['QQQ', 'SPY', 'NVDA', 'AAPL', 'MSFT', 'TSLA', 'META', 'AMD', 'AMZN', 'MU', 'PLTR', 'IREN'];
const SEG = 60; // 展示段：60 个交易日
const FWD = 20; // 猜的窗口：之后 20 个交易日

type Bucket = 0 | 1 | 2 | 3; // 0 大涨 ≥+8 / 1 上涨 +2~+8 / 2 横盘 -2~+2 / 3 下跌 ≤-2
function bucketOf(pct: number): Bucket {
  if (pct >= 8) return 0;
  if (pct >= 2) return 1;
  if (pct > -2) return 2;
  return 3;
}

interface Episode {
  symbol: string;
  seg: number[]; // 归一化（起点=100）的展示段收盘
  fwd: number[]; // 揭晓后接上的 20 日归一化走势
  cutoffDate: string;
  endDate: string;
  pct: number; // 之后 20 日真实涨跌 %
  qqqPct: number | null; // 同期 QQQ 涨跌 %
  answer: Bucket;
}

const cache = new Map<string, SeriesPoint[]>();

async function loadPoints(symbol: string): Promise<SeriesPoint[] | null> {
  const hit = cache.get(symbol);
  if (hit) return hit;
  try {
    const r = await fetch(`/api/box?symbol=${encodeURIComponent(symbol)}`);
    if (!r.ok) return null;
    const j = await r.json();
    const pts: SeriesPoint[] = j.points ?? [];
    if (pts.length < SEG + FWD + 40) return null;
    cache.set(symbol, pts);
    return pts;
  } catch {
    return null;
  }
}

function Spark({ seg, fwd }: { seg: number[]; fwd: number[] | null }) {
  const all = fwd ? [...seg, ...fwd.slice(1)] : seg;
  const W = 320;
  const H = 120;
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.08 || 1;
  const x = (i: number) => (i / (all.length - 1)) * (W - 8) + 4;
  const y = (v: number) => H - 6 - ((v - (min - pad)) / (max - min + 2 * pad)) * (H - 12);
  const line = (arr: number[], off: number) =>
    arr.map((v, i) => `${x(i + off)},${y(v)}`).join(' ');
  const cutX = x(seg.length - 1);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
      <polyline points={line(seg, 0)} fill="none" stroke="#38bdf8" strokeWidth="2" />
      {fwd && (
        <>
          <line x1={cutX} y1={4} x2={cutX} y2={H - 4} stroke="#f59e0b" strokeWidth="1" strokeDasharray="3 3" />
          <polyline points={line(fwd, seg.length - 1)} fill="none" stroke="#f59e0b" strokeWidth="2" />
        </>
      )}
    </svg>
  );
}

export default function ReplayGame() {
  const { lang } = useLanguage();
  const [ep, setEp] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Bucket | null>(null);
  const [rounds, setRounds] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [err, setErr] = useState('');
  const scoreRef = useRef(0);
  const lastSymbolRef = useRef('');

  useEffect(() => {
    return () => {
      if (scoreRef.current > 0) recordPlay('replay', scoreRef.current);
    };
  }, []);

  const newEpisode = async () => {
    setLoading(true);
    setPicked(null);
    setErr('');
    const qqq = await loadPoints('QQQ');
    for (let attempt = 0; attempt < 6; attempt++) {
      const symbol = POOL[Math.floor(Math.random() * POOL.length)];
      if (symbol === lastSymbolRef.current && attempt < 5) continue;
      const pts = await loadPoints(symbol);
      if (!pts) continue;
      const idx = SEG - 1 + Math.floor(Math.random() * (pts.length - FWD - SEG + 1));
      const cut = idx; // 展示段最后一天的下标
      const base = pts[cut - SEG + 1].close;
      if (base <= 0) continue;
      const seg = pts.slice(cut - SEG + 1, cut + 1).map((p) => (p.close / base) * 100);
      const cutClose = pts[cut].close;
      const endClose = pts[cut + FWD].close;
      const pct = ((endClose - cutClose) / cutClose) * 100;
      const fwd = pts.slice(cut, cut + FWD + 1).map((p) => (p.close / base) * 100);
      let qqqPct: number | null = null;
      if (qqq) {
        const qi = qqq.findIndex((p) => p.date >= pts[cut].date);
        if (qi >= 0 && qi + FWD < qqq.length && qqq[qi].close > 0) {
          qqqPct = ((qqq[qi + FWD].close - qqq[qi].close) / qqq[qi].close) * 100;
        }
      }
      lastSymbolRef.current = symbol;
      setEp({
        symbol,
        seg,
        fwd,
        cutoffDate: pts[cut].date,
        endDate: pts[cut + FWD].date,
        pct,
        qqqPct,
        answer: bucketOf(pct),
      });
      setLoading(false);
      return;
    }
    setErr(zh2hant(lang, '行情没拉到，检查一下网络再点一次'));
    setLoading(false);
  };

  useEffect(() => {
    void newEpisode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options: { id: Bucket; zh: string; en: string }[] = [
    { id: 0, zh: '🚀 大涨（+8% 以上）', en: '🚀 Surged (+8% or more)' },
    { id: 1, zh: '📈 上涨（+2% ~ +8%）', en: '📈 Rose (+2% to +8%)' },
    { id: 2, zh: '➖ 横盘（−2% ~ +2%）', en: '➖ Flat (−2% to +2%)' },
    { id: 3, zh: '📉 下跌（−2% 以下）', en: '📉 Fell (below −2%)' },
  ];

  const pick = (b: Bucket) => {
    if (!ep || picked != null) return;
    setPicked(b);
    setRounds((r) => r + 1);
    if (b === ep.answer) {
      setCorrect((c) => c + 1);
      scoreRef.current += 10;
    }
  };

  const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
  const revealed = ep != null && picked != null;
  const wasRight = revealed && picked === ep.answer;

  const knowledge = (): string => {
    if (!ep || ep.qqqPct == null) return '';
    const diff = ep.pct - ep.qqqPct;
    if (Math.abs(diff) < 3)
      return zh2hant(lang, `同期大盘 QQQ ${fmtPct(ep.qqqPct)}——这段基本是大盘带着走，不是这只股自己的事。`);
    if (diff > 0)
      return zh2hant(lang, `同期大盘 QQQ 只有 ${fmtPct(ep.qqqPct)}——这段涨幅主要是这只股自己的行情。`);
    return zh2hant(lang, `同期大盘 QQQ 是 ${fmtPct(ep.qqqPct)}——大盘没怎么拖后腿，是这只股自己在跌。`);
  };

  return (
    <div className="w-full max-w-sm space-y-3">
      <p className="text-[11px] text-slate-400 leading-relaxed">
        {zh2hant(lang, '一段真实行情，名字和日期都藏起来了。看图猜：接下来 20 个交易日，它怎么走？猜完揭晓——真名、真日期、真涨幅。')}
      </p>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{zh2hant(lang, `已玩 ${rounds} 局 · 猜中 ${correct} 局`)}</span>
        <span>{zh2hant(lang, '每局答对 +10 分')}</span>
      </div>

      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
        {loading || !ep ? (
          <p className="text-center text-xs text-slate-400 py-10">{zh2hant(lang, '正在翻历史行情…🎞️')}</p>
        ) : (
          <>
            <Spark seg={ep.seg} fwd={revealed ? ep.fwd : null} />
            <p className="text-[10px] text-slate-500 mt-1 text-center">
              {revealed
                ? zh2hant(lang, `揭晓段：${ep.cutoffDate} → ${ep.endDate}`)
                : zh2hant(lang, '蓝线是过去 60 个交易日（起点归一到 100），猜右边还没画出来的 20 天')}
            </p>
          </>
        )}
      </div>

      {err && <p className="text-[11px] text-rose-300">{err}</p>}

      {ep && (
        <div className="grid grid-cols-2 gap-2">
          {options.map((o) => {
            const isAnswer = revealed && o.id === ep.answer;
            const isPicked = picked === o.id;
            return (
              <button
                key={o.id}
                onClick={() => pick(o.id)}
                disabled={picked != null}
                className={`py-2.5 rounded-xl border text-[12px] font-bold transition ${
                  isAnswer
                    ? 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200'
                    : isPicked
                      ? 'bg-rose-500/10 border-rose-500/50 text-rose-200'
                      : 'bg-slate-800/80 border-slate-700 text-slate-200'
                }`}
              >
                {zh2hant(lang, lang === 'en' ? o.en : o.zh)}
              </button>
            );
          })}
        </div>
      )}

      {revealed && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-1.5">
          <p className="text-sm font-bold text-slate-100">
            {wasRight ? zh2hant(lang, '🎉 猜中了！+10 分') : zh2hant(lang, '差一点——看揭晓')}
          </p>
          <p className="text-xs text-slate-300 leading-relaxed">
            {zh2hant(lang, `这是 ${ep.symbol}，${ep.cutoffDate} 之后 20 个交易日实际 ${fmtPct(ep.pct)}。`)}
          </p>
          {knowledge() && <p className="text-[11px] text-slate-400 leading-relaxed">📚 {knowledge()}</p>}
          <button
            onClick={() => void newEpisode()}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold mt-1"
          >
            {zh2hant(lang, '下一局')}
          </button>
        </div>
      )}
    </div>
  );
}
