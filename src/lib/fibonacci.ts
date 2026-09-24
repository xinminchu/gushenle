/**
 * 黄金分割参考线：纯函数库，无外部依赖。
 *
 * 用法：findSwing(近N日K线) 找波段高低点 → fibLevels(波段, 组合) 算参考线价位。
 * 口径：参考线，不是算命——只标"大家都在看的位置"，不预测。
 */

export interface FibPoint {
  date: string;
  high: number;
  low: number;
  close: number;
}

export interface FibSwing {
  high: number;
  low: number;
  highDate: string;
  lowDate: string;
  /** true=先低后高（上涨波段），false=先高后低（下跌波段） */
  uptrend: boolean;
  lookback: number;
  range: number;
}

export type FibComboId = 'classic' | 'full' | 'minimal' | 'extension';

export interface FibCombo {
  id: FibComboId;
  name: string;
  ratios: number[];
  kind: 'retrace' | 'extension';
  desc: string;
}

/** 四套组合方案：回测调参后，最靠谱的一套会被标为推荐 */
export const FIB_COMBOS: Record<FibComboId, FibCombo> = {
  classic: {
    id: 'classic',
    name: '经典三线',
    ratios: [0.382, 0.5, 0.618],
    kind: 'retrace',
    desc: '回调 0.382/0.5/0.618：股民最常用的三个位置',
  },
  full: {
    id: 'full',
    name: '完整五线',
    ratios: [0.236, 0.382, 0.5, 0.618, 0.786],
    kind: 'retrace',
    desc: '回调全套：浅回调 0.236 到深回调 0.786',
  },
  minimal: {
    id: 'minimal',
    name: '极简两线',
    ratios: [0.382, 0.618],
    kind: 'retrace',
    desc: '只留最重要的两条：强弱分界看得最清',
  },
  extension: {
    id: 'extension',
    name: '扩展目标',
    ratios: [1.272, 1.618, 2.0, 2.618],
    kind: 'extension',
    desc: '突破后的上方目标 / 跌破后的下方目标',
  },
};

export const FIB_COMBO_IDS = Object.keys(FIB_COMBOS) as FibComboId[];

/** 波段窗口（交易日）：近2月 / 近3月 / 近半年 */
export const FIB_LOOKBACKS = [
  { days: 40, label: '近2月' },
  { days: 60, label: '近3月' },
  { days: 120, label: '近半年' },
] as const;

/**
 * 回测调参后的推荐组合（默认）。
 * 调参结论更新时改这里，UI 的"推荐"徽章和诊断联动自动跟随。
 */
export const RECOMMENDED_FIB_COMBO: FibComboId = 'classic';
export const RECOMMENDED_FIB_LOOKBACK = 60;

export type FibLevelKind = 'support' | 'resistance' | 'target-up' | 'target-down';

export interface FibLevel {
  ratio: number;
  price: number;
  kind: FibLevelKind;
}

/** 在最近 lookback 根K线里找波段最高/最低。点数不足 20 时返回 null。 */
export function findSwing(points: FibPoint[], lookback: number): FibSwing | null {
  const win = points.slice(-lookback).filter((p) => p.high > 0 && p.low > 0);
  if (win.length < 20) return null;
  let hi = win[0];
  let lo = win[0];
  for (const p of win) {
    if (p.high > hi.high) hi = p;
    if (p.low < lo.low) lo = p;
  }
  if (hi.high <= lo.low) return null;
  const uptrend = win.indexOf(lo) <= win.indexOf(hi);
  return {
    high: hi.high,
    low: lo.low,
    highDate: hi.date,
    lowDate: lo.date,
    uptrend,
    lookback,
    range: hi.high - lo.low,
  };
}

/** 按组合算参考线价位（保留 2 位小数） */
export function fibLevels(swing: FibSwing, comboId: FibComboId): FibLevel[] {
  const combo = FIB_COMBOS[comboId];
  const { high, low, range, uptrend } = swing;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return combo.ratios.map((r) => {
    let price: number;
    let kind: FibLevelKind;
    if (combo.kind === 'retrace') {
      if (uptrend) {
        price = high - range * r;
        kind = 'support';
      } else {
        price = low + range * r;
        kind = 'resistance';
      }
    } else {
      if (uptrend) {
        price = low + range * r;
        kind = 'target-up';
      } else {
        price = high - range * r;
        kind = 'target-down';
      }
    }
    return { ratio: r, price: r2(price), kind };
  });
}

/** 现价离哪条线最近（及偏离百分比，绝对值） */
export function nearestFibLevel(
  levels: FibLevel[],
  price: number
): { level: FibLevel; distPct: number } | null {
  if (!levels.length || !(price > 0)) return null;
  let best = levels[0];
  let bestDist = Math.abs((price - best.price) / best.price);
  for (const lv of levels.slice(1)) {
    const d = Math.abs((price - lv.price) / lv.price);
    if (d < bestDist) {
      bestDist = d;
      best = lv;
    }
  }
  return { level: best, distPct: Math.round(bestDist * 10000) / 100 };
}

const KIND_LABEL: Record<FibLevelKind, string> = {
  support: '支撑位',
  resistance: '压力位',
  'target-up': '上方目标位',
  'target-down': '下方目标位',
};

export function fibKindLabel(kind: FibLevelKind): string {
  return KIND_LABEL[kind];
}

/**
 * 诊断卡联动：现价贴近（≤1.5%）某条参考线时，给一句行为纠偏提示。
 * 口径：拦追高 / 拦割肉，不预测。
 */
export function fibAdviceHint(
  swing: FibSwing,
  comboId: FibComboId,
  price: number
): string | null {
  const near = nearestFibLevel(fibLevels(swing, comboId), price);
  if (!near || near.distPct > 1.5) return null;
  const { level } = near;
  const at = `${level.ratio}${fibKindLabel(level.kind)}（$${level.price}）`;
  switch (level.kind) {
    case 'support':
      return `📐 现价贴近${at}——跌到这儿容易稳住，别慌着割肉`;
    case 'resistance':
      return `📐 现价贴近${at}——反弹到这儿容易遇阻，别急着追`;
    case 'target-up':
      return `📐 现价接近${at}——涨到这儿别追高，让子弹歇会儿`;
    case 'target-down':
      return `📐 现价接近${at}——跌到这儿别急着抄底，等它站稳再说`;
  }
}
