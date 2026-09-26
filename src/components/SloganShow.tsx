'use client';

import { useEffect, useState } from 'react';

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

/** 页头 slogan 区：金黄五角星在上方左右游动 + 红绿折线背景 + 四句标语 */
export default function SloganShow() {
  return (
    <div className="relative overflow-hidden">
      <SloganBackdrop />
      <div className="relative px-4">
        <div className="relative h-[18px]">
          <span
            aria-hidden="true"
            className="slogan-star absolute top-0 whitespace-nowrap text-[14px] leading-none text-amber-300"
          >
            ★★★★★
          </span>
        </div>
        <p className="whitespace-nowrap overflow-hidden text-center text-[12px] tracking-wide text-slate-100 pb-2">
          快乐炒股 <span className="text-slate-500 mx-0.5">·</span> 轻松投资{' '}
          <span className="text-slate-500 mx-0.5">·</span> 不赌不堵{' '}
          <span className="text-slate-500 mx-0.5">·</span> 不气不弃
        </p>
      </div>
    </div>
  );
}
