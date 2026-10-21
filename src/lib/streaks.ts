/* streak 小统计：纯事实型连续状态描述，全部由 /api/rhythm 的日线现场计算。
   规则（2026-10-19 Sam 拍板）：
   - 只描述事实（连涨/连跌/站上均线/放量/缩量），不解读、不预测；
   - N<2 时整行隐藏，不显示空话；
   - 无数据（点数不足/缺成交量）时对应项跳过，不造数。 */

import type { RhythmPoint } from './rhythm';

export type StreakKind = 'up' | 'down' | 'aboveMA' | 'belowMA' | 'volUp' | 'volDown';

export interface Streak {
  kind: StreakKind;
  days: number; // 连续交易日数，恒 >= 2
}

/** 连续收涨 / 收跌：从最后一根往前数同向天数 */
export function dirStreak(series: RhythmPoint[]): { dir: 1 | -1; days: number } | null {
  if (series.length < 3) return null;
  const n = series.length;
  const last = series[n - 1].close;
  const prev = series[n - 2].close;
  const dir = last > prev ? 1 : last < prev ? -1 : 0;
  if (dir === 0) return null;
  // days = 连续同向的日涨跌次数（从最后一根往前数，含最后一根）
  let days = 0;
  for (let i = n - 1; i >= 1; i--) {
    const d = series[i].close - series[i - 1].close;
    if ((dir === 1 && d > 0) || (dir === -1 && d < 0)) days++;
    else break;
  }
  return days >= 2 ? { dir: dir as 1 | -1, days } : null;
}

/** 连续站上 / 跌破 N 日均线（逐日用当日均线判定） */
export function maStreak(series: RhythmPoint[], period = 50): { above: boolean; days: number } | null {
  if (series.length < period + 2) return null;
  const maAt = (i: number) => {
    let s = 0;
    for (let k = i - period + 1; k <= i; k++) s += series[k].close;
    return s / period;
  };
  const n = series.length;
  const above = series[n - 1].close >= maAt(n - 1);
  let days = 0;
  for (let i = n - 1; i >= period - 1; i--) {
    if ((series[i].close >= maAt(i)) === above) days++;
    else break;
  }
  return days >= 2 ? { above, days } : null;
}

/** 连续放量 / 缩量：当日量 vs 前 20 日均量 */
export function volStreak(series: RhythmPoint[], window = 20): { expand: boolean; days: number } | null {
  const vs = series.map((p) => p.volume ?? 0);
  if (vs.some((v) => v <= 0)) {
    // 缺成交量的日子直接视为数据不足
    const usable = series.every((p) => (p.volume ?? 0) > 0);
    if (!usable) return null;
  }
  const n = series.length;
  if (n < window + 2) return null;
  const avgAt = (i: number) => {
    let s = 0;
    for (let k = i - window; k < i; k++) s += vs[k];
    return s / window;
  };
  const expand = vs[n - 1] > avgAt(n - 1);
  let days = 0;
  for (let i = n - 1; i >= window; i--) {
    if ((vs[i] > avgAt(i)) === expand) days++;
    else break;
  }
  return days >= 2 ? { expand, days } : null;
}

/** 一只标的的全部 streak（最多 3 条，按天数降序） */
export function symbolStreaks(series: RhythmPoint[]): Streak[] {
  const out: Streak[] = [];
  const d = dirStreak(series);
  if (d) out.push({ kind: d.dir === 1 ? 'up' : 'down', days: d.days });
  const m = maStreak(series, 50);
  if (m) out.push({ kind: m.above ? 'aboveMA' : 'belowMA', days: m.days });
  const v = volStreak(series);
  if (v) out.push({ kind: v.expand ? 'volUp' : 'volDown', days: v.days });
  return out.sort((a, b) => b.days - a.days).slice(0, 3);
}

/** 自选广度：连续收涨 >= 2 日的标的数（只计有数据的） */
export function breadthUpCount(dataMap: Record<string, { series: RhythmPoint[] }>): { up: number; total: number } {
  const syms = Object.keys(dataMap);
  let up = 0;
  for (const s of syms) {
    const d = dirStreak(dataMap[s].series);
    if (d && d.dir === 1) up++;
  }
  return { up, total: syms.length };
}
