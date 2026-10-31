import type { RhythmPoint } from './rhythm';

/**
 * 摆动点转折状态（fractal 口径，中性描述，不含买卖建议）。
 *
 * 某日最高价是左右各 N 日内最高 → 阶段高点；
 * 某日最低价是左右各 N 日内最低 → 阶段低点。
 * 只返回最近一个"已确认"的转折：确认发生在转折 rightBars 个交易日之后，
 * 这是数学决定的滞后，不是参数问题，UI 必须把滞后天数写出来。
 */

export interface SwingState {
  /** 'high' = 阶段高点确认；'low' = 阶段低点确认；null = 所选区间内无确认转折 */
  kind: 'high' | 'low' | null;
  /** 转折当天 YYYY-MM-DD */
  date: string | null;
  /** 转折当天的价格（高点取最高价，低点取最低价） */
  price: number | null;
  /** 确认滞后了几个交易日（= rightBars） */
  lagBars: number;
}

/** 默认摆动强度：左右各 5 个交易日 */
export const SWING_LEFT = 5;
export const SWING_RIGHT = 5;

export function latestSwing(
  series: RhythmPoint[],
  leftBars: number = SWING_LEFT,
  rightBars: number = SWING_RIGHT,
): SwingState {
  const lagBars = rightBars;
  const empty: SwingState = { kind: null, date: null, price: null, lagBars };
  const n = series.length;
  if (n < leftBars + rightBars + 1) return empty;

  const hiOf = (p: RhythmPoint) => p.high ?? p.close;
  const loOf = (p: RhythmPoint) => p.low ?? p.close;

  // 从右往左找最近一个已确认的摆动点（确认位置 i 必须 <= n-1-rightBars）
  for (let i = n - 1 - rightBars; i >= leftBars; i--) {
    const c = series[i];
    const hi = hiOf(c);
    const lo = loOf(c);
    let isHigh = true;
    let isLow = true;
    for (let k = 1; k <= leftBars; k++) {
      if (hiOf(series[i - k]) >= hi) isHigh = false;
      if (loOf(series[i - k]) <= lo) isLow = false;
      if (!isHigh && !isLow) break;
    }
    if (isHigh || isLow) {
      for (let k = 1; k <= rightBars; k++) {
        if (hiOf(series[i + k]) >= hi) isHigh = false;
        if (loOf(series[i + k]) <= lo) isLow = false;
        if (!isHigh && !isLow) break;
      }
    }
    if (isHigh) return { kind: 'high', date: c.date, price: hi, lagBars };
    if (isLow) return { kind: 'low', date: c.date, price: lo, lagBars };
  }
  return empty;
}
