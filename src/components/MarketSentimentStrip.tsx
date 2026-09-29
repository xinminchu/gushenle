// 资讯页「市场情绪」小条：VIX 恐慌指数 + CNN 贪婪指数（/api/macro sentiment）
// 两个都取不到时静默隐藏。文案只做行为提醒，不下买卖结论。
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import type { Lang } from '@/lib/i18n';

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

function ratingLabel(rating: string | null | undefined, lang: Lang): string {
  const hit = rating && RATING_LABEL[rating];
  if (hit) return tx(lang, hit[1], hit[0]);
  return tx(lang, '—', '—');
}

/** 贪婪指数主文案：行为纠偏口吻 */
function noteForRating(rating: string | null | undefined, lang: Lang): string {
  switch (rating) {
    case 'extreme_fear':
      return tx(lang, "Everyone's scared — selling now is how you sell the bottom. Careful", '大家都在怕——这时候割肉最容易割在地板上，慎');
    case 'fear':
      return tx(lang, "The market's nervous — no rush to move, just watch", '市场有点慌，别急着动，先看看');
    case 'greed':
      return tx(lang, 'People are getting excited — be extra careful chasing', '大家有点上头，追高要更慎');
    case 'extreme_greed':
      return tx(lang, 'Extreme greed everywhere — the higher it goes, the tighter you hold your hands', '全场都在贪，越涨越要管住手');
    default:
      return tx(lang, 'Sentiment is neutral — just follow the rhythm', '情绪不冷不热，跟着律动走就行');
  }
}

function vixLabel(v: number, lang: Lang): string {
  if (v >= 30) return tx(lang, 'Panic', '恐慌');
  if (v >= 20) return tx(lang, 'Warming', '升温');
  return tx(lang, 'Calm', '平稳');
}

/** VIX 值得说一句时才追加 */
function vixNote(v: number, lang: Lang): string {
  if (v >= 30)
    return tx(lang, `VIX ${v.toFixed(1)} — high volatility, breathe before you act`, `VIX ${v.toFixed(1)} 波动很大，操作前先深呼吸`);
  if (v >= 20)
    return tx(lang, `VIX ${v.toFixed(1)} — volatility warming up, no chasing or panic selling`, `VIX ${v.toFixed(1)} 波动升温，别追涨杀跌`);
  return '';
}

export default function MarketSentimentStrip() {
  const { lang } = useLanguage();
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

  const note = noteForRating(s.fearGreedRating, lang);
  const extra = s.vix != null ? vixNote(s.vix, lang) : '';
  // newsfun-2：VIX（FRED 数据，日期可能更早）单独标自己的真实日期，不许蹭贪婪指数的"截至"
  const vixDate = tx(lang, (s.vixDateEn ?? ''), (s.vixDateCN ?? ''));
  const fgDate = tx(lang, (s.fearGreedDateEn ?? ''), (s.fearGreedDateCN ?? ''));

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[11px] text-slate-500 shrink-0">{tx(lang, '😰 Market mood', '😰 市场情绪')}</span>
        {s.vix != null && (
          <span className="text-xs text-slate-300">
            VIX <span className="font-bold text-slate-100">{s.vix.toFixed(1)}</span>
            <span className="text-slate-500"> · {vixLabel(s.vix, lang)}</span>
            {vixDate && (
              <span className="text-[10px] text-slate-600"> · {tx(lang, `as of ${vixDate}`, `截至${vixDate}`)}</span>
            )}
          </span>
        )}
        {s.fearGreed != null && (
          <span className="text-xs text-slate-300">
            {tx(lang, 'Fear & Greed', '贪婪指数')}{' '}
            <span className="font-bold text-slate-100">{Math.round(s.fearGreed)}</span>
            <span className="text-slate-500"> · {ratingLabel(s.fearGreedRating, lang)}</span>
          </span>
        )}
        {fgDate && (
          <span className="text-[10px] text-slate-600 ml-auto shrink-0">
            {tx(lang, `F&G as of ${fgDate}`, `贪婪指数截至${fgDate}`)}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
        {note}
        {extra ? (tx(lang, `; ${extra}`, `；${extra}`)) : ''}
      </p>
    </div>
  );
}
