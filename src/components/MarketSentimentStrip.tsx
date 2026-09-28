// 资讯页「市场情绪」小条：VIX 恐慌指数 + CNN 贪婪指数（/api/macro sentiment）
// 两个都取不到时静默隐藏。文案只做行为提醒，不下买卖结论。
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface Sentiment {
  vix?: number | null;
  vixDateCN?: string | null;
  vixDateEn?: string | null;
  fearGreed?: number | null;
  fearGreedRating?: string | null;
  fearGreedDateCN?: string | null;
  fearGreedDateEn?: string | null;
}

const RATING_LABEL: Record<string, [string, string]> = {
  extreme_fear: ['极度恐慌', 'Extreme fear'],
  fear: ['恐慌', 'Fear'],
  neutral: ['中性', 'Neutral'],
  greed: ['贪婪', 'Greed'],
  extreme_greed: ['极度贪婪', 'Extreme greed'],
};

function ratingLabel(rating: string | null | undefined, en: boolean): string {
  const hit = rating && RATING_LABEL[rating];
  if (hit) return en ? hit[1] : hit[0];
  return en ? '—' : '—';
}

/** 贪婪指数主文案：行为纠偏口吻 */
function noteForRating(rating: string | null | undefined, en: boolean): string {
  switch (rating) {
    case 'extreme_fear':
      return en
        ? "Everyone's scared — selling now is how you sell the bottom. Careful"
        : '大家都在怕——这时候割肉最容易割在地板上，慎';
    case 'fear':
      return en
        ? "The market's nervous — no rush to move, just watch"
        : '市场有点慌，别急着动，先看看';
    case 'greed':
      return en
        ? 'People are getting excited — be extra careful chasing'
        : '大家有点上头，追高要更慎';
    case 'extreme_greed':
      return en
        ? 'Extreme greed everywhere — the higher it goes, the tighter you hold your hands'
        : '全场都在贪，越涨越要管住手';
    default:
      return en
        ? 'Sentiment is neutral — just follow the rhythm'
        : '情绪不冷不热，跟着律动走就行';
  }
}

function vixLabel(v: number, en: boolean): string {
  if (v >= 30) return en ? 'Panic' : '恐慌';
  if (v >= 20) return en ? 'Warming' : '升温';
  return en ? 'Calm' : '平稳';
}

/** VIX 值得说一句时才追加 */
function vixNote(v: number, en: boolean): string {
  if (v >= 30)
    return en
      ? `VIX ${v.toFixed(1)} — high volatility, breathe before you act`
      : `VIX ${v.toFixed(1)} 波动很大，操作前先深呼吸`;
  if (v >= 20)
    return en
      ? `VIX ${v.toFixed(1)} — volatility warming up, no chasing or panic selling`
      : `VIX ${v.toFixed(1)} 波动升温，别追涨杀跌`;
  return '';
}

export default function MarketSentimentStrip() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [s, setS] = useState<Sentiment | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/macro')
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.sentiment) setS(j.sentiment);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!s || (s.vix == null && s.fearGreed == null)) return null;

  const note = noteForRating(s.fearGreedRating, en);
  const extra = s.vix != null ? vixNote(s.vix, en) : '';
  const asof = en
    ? (s.fearGreedDateEn ?? s.vixDateEn)
    : (s.fearGreedDateCN ?? s.vixDateCN);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[11px] text-slate-500 shrink-0">{en ? '😰 Market mood' : '😰 市场情绪'}</span>
        {s.vix != null && (
          <span className="text-xs text-slate-300">
            VIX <span className="font-bold text-slate-100">{s.vix.toFixed(1)}</span>
            <span className="text-slate-500"> · {vixLabel(s.vix, en)}</span>
          </span>
        )}
        {s.fearGreed != null && (
          <span className="text-xs text-slate-300">
            {en ? 'Fear & Greed' : '贪婪指数'}{' '}
            <span className="font-bold text-slate-100">{Math.round(s.fearGreed)}</span>
            <span className="text-slate-500"> · {ratingLabel(s.fearGreedRating, en)}</span>
          </span>
        )}
        {asof && (
          <span className="text-[10px] text-slate-600 ml-auto shrink-0">
            {en ? `as of ${asof}` : `截至${asof}`}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
        {note}
        {extra ? (en ? `; ${extra}` : `；${extra}`) : ''}
      </p>
    </div>
  );
}
