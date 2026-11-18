// src/components/games/StreamerCheckGame.tsx
// 主播验真：把主播观点页里记过的旧观点翻出来，用 20 个交易日后的真实涨跌验。
// 玩家先猜结果，再揭晓——顺带看清这位主播当时为什么这么说（理由/保留条件原文）。
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { zh2hant } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';
import { recordPlay } from '@/lib/gameStats';
import {
  STREAMER_VIEW_HISTORY,
  STANCE_ZH,
  type StreamerView,
} from '@/lib/streamerViews';

interface Candidate {
  date: string;
  symbol: string;
  label: string;
  view: StreamerView;
}

function buildCandidates(): Candidate[] {
  const cutoff = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);
  const out: Candidate[] = [];
  for (const batch of STREAMER_VIEW_HISTORY) {
    if (batch.date > cutoff) continue; // 至少 21 天前的观点，20 日结果才出得来
    for (const g of batch.groups) {
      for (const v of g.views) {
        if (v.kind !== 'view') continue;
        if (v.stance === 'neutral') continue;
        if (!v.headline) continue;
        out.push({ date: batch.date, symbol: g.symbol, label: g.label, view: v });
      }
    }
  }
  return out;
}

type Bucket = 0 | 1 | 2 | 3; // 0 大涨 ≥+5 / 1 小涨 0~+5 / 2 小跌 -5~0 / 3 大跌 ≤-5
function bucketOf(pct: number): Bucket {
  if (pct >= 5) return 0;
  if (pct > 0) return 1;
  if (pct > -5) return 2;
  return 3;
}

interface Episode extends Candidate {
  r20: number;
  answer: Bucket;
}

export default function StreamerCheckGame() {
  const { lang } = useLanguage();
  const candidatesRef = useRef<Candidate[] | null>(null);
  const usedRef = useRef<Set<string>>(new Set());
  const [ep, setEp] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Bucket | null>(null);
  const [rounds, setRounds] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [err, setErr] = useState('');
  const scoreRef = useRef(0);

  useEffect(() => {
    return () => {
      if (scoreRef.current > 0) recordPlay('streamcheck', scoreRef.current);
    };
  }, []);

  const next = async () => {
    setLoading(true);
    setPicked(null);
    setErr('');
    if (!candidatesRef.current) candidatesRef.current = buildCandidates();
    const pool = candidatesRef.current.filter((c) => !usedRef.current.has(c.view.id));
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    for (const cand of shuffled.slice(0, 8)) {
      try {
        const r = await fetch(
          `/api/forward-return?symbol=${encodeURIComponent(cand.symbol)}&date=${cand.date}`,
        );
        if (!r.ok) continue;
        const j = await r.json();
        if (j.r20 == null) continue;
        usedRef.current.add(cand.view.id);
        setEp({ ...cand, r20: j.r20, answer: bucketOf(j.r20) });
        setLoading(false);
        return;
      } catch {
        continue;
      }
    }
    setErr(zh2hant(lang, '能验的旧观点暂时翻不出来，检查一下网络再试'));
    setLoading(false);
  };

  useEffect(() => {
    void next();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const options: { id: Bucket; zh: string }[] = [
    { id: 0, zh: '🚀 大涨（+5% 以上）' },
    { id: 1, zh: '📈 小涨（0 ~ +5%）' },
    { id: 2, zh: '📉 小跌（−5% ~ 0）' },
    { id: 3, zh: '💥 大跌（−5% 以下）' },
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

  const revealed = ep != null && picked != null;
  const fmtPct = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;

  const verdict = (): string => {
    if (!ep) return '';
    const s = ep.view.stance;
    if (Math.abs(ep.r20) < 1) return zh2hant(lang, '结果基本走平——这一局谁都没说准，也没说错。');
    if (s === 'bullish')
      return ep.r20 > 0
        ? zh2hant(lang, '方向说对了：看好，之后真涨了。')
        : zh2hant(lang, '方向说反了：看好，之后却跌了。');
    // bearish / cautious
    return ep.r20 < 0
      ? zh2hant(lang, '方向说对了：偏空/谨慎，之后真跌了。')
      : zh2hant(lang, '方向说反了：偏空/谨慎，之后却涨了。');
  };

  return (
    <div className="w-full max-w-sm space-y-3">
      <p className="text-[11px] text-slate-400 leading-relaxed">
        {zh2hant(lang, '主播观点页里记过的旧话，拿 20 个交易日后的真实走势来验。你先猜结果，再看他当时为什么这么说。')}
      </p>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>{zh2hant(lang, `已验 ${rounds} 条 · 猜中 ${correct} 条`)}</span>
        <span>{zh2hant(lang, '每条答对 +10 分')}</span>
      </div>

      {loading || !ep ? (
        <p className="text-center text-xs text-slate-400 py-10">{zh2hant(lang, '正在翻旧观点…🔍')}</p>
      ) : (
        <>
          <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-slate-100">{ep.symbol}</span>
              <span className="text-[11px] text-slate-400">{ep.label}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-600/30">
                {zh2hant(lang, STANCE_ZH[ep.view.stance])} · {ep.view.horizon === 'short' ? zh2hant(lang, '短期') : zh2hant(lang, '长期')}
              </span>
            </div>
            <p className="text-[13px] text-slate-200 leading-relaxed">「{zh2hant(lang, ep.view.headline)}」</p>
            <p className="text-[11px] text-slate-500">
              {ep.view.blogger} · {ep.date}
            </p>
            <p className="text-xs font-bold text-slate-300 pt-1">
              {zh2hant(lang, '20 个交易日后，这只股实际怎么走的？')}
            </p>
          </div>

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
                  {zh2hant(lang, o.zh)}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 space-y-1.5">
              <p className="text-sm font-bold text-slate-100">
                {picked === ep.answer ? zh2hant(lang, '🎉 猜中了！+10 分') : zh2hant(lang, '揭晓——')}
                {' '}
                <span className="tabular-nums">{fmtPct(ep.r20)}</span>
              </p>
              <p className="text-xs text-slate-300">{verdict()}</p>
              {ep.view.reason && (
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {zh2hant(lang, '他当时为什么这么说：')}{zh2hant(lang, ep.view.reason)}
                </p>
              )}
              {ep.view.caveat && (
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {zh2hant(lang, '他给自己留的余地：')}{zh2hant(lang, ep.view.caveat)}
                </p>
              )}
              <button
                onClick={() => void next()}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold mt-1"
              >
                {zh2hant(lang, '再验一条')}
              </button>
            </div>
          )}
        </>
      )}
      {err && <p className="text-[11px] text-rose-300">{err}</p>}
    </div>
  );
}
