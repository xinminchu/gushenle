import { useMemo } from 'react';
import { scoreAt } from '@/lib/rhythm';

/**
 * 近 N 天律动分迷你折线。
 * 用日线收盘价在客户端无未来函数回算（scoreAt），口径与服务端诊断一致。
 * 点数不足（<32）时不渲染，避免短区间下窗口被截断失真。
 */
export default function ScoreSparkline({
  closes,
  days = 10,
  width = 76,
  height = 26,
  hot = 80,
  cold = 20,
}: {
  closes: number[];
  days?: number;
  width?: number;
  height?: number;
  hot?: number;
  cold?: number;
}) {
  const pts = useMemo(() => {
    if (closes.length < 32) return [];
    const out: number[] = [];
    const start = Math.max(0, closes.length - days);
    for (let i = start; i < closes.length; i++) {
      const s = scoreAt(closes, i);
      if (s) out.push(s.score);
    }
    return out;
  }, [closes, days]);

  if (pts.length < 2) return null;

  const pad = 3;
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const xy = pts.map(
    (v, i) =>
      [
        pad + (i / (pts.length - 1)) * (width - pad * 2),
        height - pad - ((v - min) / span) * (height - pad * 2),
      ] as const,
  );
  const d = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const lastColor = last >= hot ? '#fbbf24' : last <= cold ? '#34d399' : '#94a3b8';
  const [lx, ly] = xy[xy.length - 1];

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke="#64748b" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.5" fill={lastColor} />
    </svg>
  );
}
