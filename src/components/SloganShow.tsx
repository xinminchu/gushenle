'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { tx, zh2hant } from '@/lib/hant';

/**
 * slogan 背景：时刻变换的红绿折线。
 * 纯本地随机游走（涨绿跌红，跟站内配色一致），每 0.9 秒推进一格，零网络请求。
 */
const N = 36;
const W = 400;
const H = 46;

function nextWalk(prev: number): number {
  const v = prev + (Math.random() - 0.5) * 0.18;
  return Math.min(0.94, Math.max(0.06, v));
}

function SloganBackdrop() {
  const [pts, setPts] = useState<number[]>(() => {
    let v = 0.5;
    const arr = [v];
    for (let i = 1; i < N; i++) {
      v = nextWalk(v);
      arr.push(v);
    }
    return arr;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setPts((prev) => [...prev.slice(1), nextWalk(prev[prev.length - 1])]);
    }, 900);
    return () => clearInterval(id);
  }, []);

  const coords = pts.map((p, i) => [(i / (N - 1)) * W, H - p * H] as const);

  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full opacity-[0.35]"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {coords.slice(0, -1).map((c, i) => {
        const n = coords[i + 1];
        const up = n[1] <= c[1];
        return (
          <line
            key={i}
            x1={c[0]}
            y1={c[1]}
            x2={n[0]}
            y2={n[1]}
            stroke={up ? '#22c55e' : '#ef4444'}
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
    </svg>
  );
}

/** 页头 slogan 区：免责声明跑马灯 + 红绿折线背景 + 四句标语 */
export default function SloganShow() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const disclaimer = tx(lang, 'This site provides free information only — it is not a trading platform. Nothing on this site is investment advice; all content is for reference only.', '本站仅提供免费资讯，非交易平台；本站所有信息皆非投资建议性质，仅供参考。');
  return (
    <div className="relative overflow-hidden">
      <SloganBackdrop />
      <div className="relative px-4">
        <div className="relative h-[18px] overflow-hidden" aria-label={disclaimer}>
          <div className="gsl-marquee text-[12px] leading-[18px] text-amber-200/90">
            <span>{disclaimer}　　　　</span>
            <span aria-hidden="true">{disclaimer}　　　　</span>
          </div>
        </div>
        <p className="whitespace-nowrap overflow-hidden text-center text-[12px] tracking-wide text-slate-100 pb-2">
          {lang === 'en' ? (
            <>
              Happy trading <span className="text-slate-500 mx-0.5">·</span> Relaxed investing{' '}
              <span className="text-slate-500 mx-0.5">·</span> No gambling{' '}
              <span className="text-slate-500 mx-0.5">·</span> No quitting
            </>
          ) : (
            <>
              {zh2hant(lang, '快乐炒股')} <span className="text-slate-500 mx-0.5">·</span> {zh2hant(lang, '轻松投资')}{' '}
              <span className="text-slate-500 mx-0.5">·</span> {zh2hant(lang, '不赌不堵')}{' '}
              <span className="text-slate-500 mx-0.5">·</span> {zh2hant(lang, '不气不弃')}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
