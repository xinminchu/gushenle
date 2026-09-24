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

export type FibComboId = 'smart' | 'classic' | 'full' | 'extension';

export interface FibCombo {
  id: FibComboId;
  name: string;
  ratios: number[];
  kind: 'retrace' | 'extension' | 'mixed';
  desc: string;
}

/** 四套组合。回测结论（2026-09-24，AAPL/NVDA/MSFT/TSLA/COIN/MSTR 近3年，
 * 无未来函数，5日验证）：
 * - 窗口：40天 > 60天 > 120天，单调——波段越新鲜越靠谱
 * - 回调线：0.786(67.7%) > 0.618(59.2%) > 0.5(51.8%) > 0.382(49.9%) > 0.236(41.7%)，
 *   线越深触及后越容易守住；浅线（0.236/0.382）基本是噪音
 * - 扩展目标：1.272 触及后5天内不再大涨的概率 77.6%（286次触及），拦追高最有效
 * - 收敛（2026-09-24）：诊断卡联动用"推荐视图"（smart）——上方 1.272/1.618 拦追高，
 *   下方 0.618/0.786 拦割肉，窗口 40 天；面板默认给"完整五线"（别处常见），四套组合按钮直接展示
 */
export const FIB_COMBOS: Record<FibComboId, FibCombo> = {
  smart: {
    id: 'smart',
    name: '推荐视图',
    ratios: [1.272, 1.618, 0.618, 0.786],
    kind: 'mixed',
    desc: '调参收敛：上方 1.272/1.618 拦追高，下方 0.618/0.786 拦割肉，近3月窗口',
  },
  classic: {
    id: 'classic',
    name: '经典三线',
    ratios: [0.382, 0.5, 0.618],
    kind: 'retrace',
    desc: '回调 0.382/0.5/0.618：股民最常用的三个位置（回测触及后守住约50%/52%/59%）',
  },
  full: {
    id: 'full',
    name: '完整五线',
    ratios: [0.236, 0.382, 0.5, 0.618, 0.786],
    kind: 'retrace',
    desc: '回调全套：浅回调 0.236 到深回调 0.786（浅线多为噪音，深线更靠谱）',
  },
  extension: {
    id: 'extension',
    name: '扩展目标',
    ratios: [1.272, 1.618, 2.0, 2.618],
    kind: 'extension',
    desc: '突破后的上方目标 / 跌破后的下方目标（回测：到1.272后约78%在5天内不再大涨）',
  },
};

export const FIB_COMBO_IDS = Object.keys(FIB_COMBOS) as FibComboId[];

/**
 * 回测调参后的推荐组合：诊断卡联动用"推荐视图"（smart）——上方 1.272/1.618 拦追高，
 * 下方 0.618/0.786 拦割肉。面板默认给"完整五线"（别处常见），四套组合按钮直接展示。
 * 2026-09-24 精简：去掉"极简两线"（经典三线的纯子集）、"深回调"（推荐视图与完整五线的纯子集），
 * 被删的两个组合没有一条独立线条。
 * 调参结论更新时改这里，UI 的"推荐"徽章和诊断联动自动跟随。
 */
export const RECOMMENDED_FIB_COMBO: FibComboId = 'smart';
/**
 * 波段窗口（交易日）：固定近3月（60 个交易日），与律动诊断锚定一致。
 * 2026-09-24 用户拍板：面板不再给窗口切换。回测曾显示 40 天略优（40>60>120），
 * 供日后调参参考；回测接口 /api/fib-accuracy 仍保留三档做离线对比。
 */
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
  // 推荐视图是混搭：扩展只取最靠谱的 1.272/1.618（拦追高），
  // 回调只取最靠谱的深线 0.618/0.786（拦割肉），按价格从上到下排。
  if (comboId === 'smart') {
    const ext = fibLevels(swing, 'extension').filter(
      (l) => l.ratio === 1.272 || l.ratio === 1.618
    );
    const deep = fibLevelsForRatios(swing, [0.618, 0.786], 'retrace');
    return [...ext, ...deep].sort((a, b) => b.price - a.price);
  }
  const combo = FIB_COMBOS[comboId];
  return fibLevelsForRatios(swing, combo.ratios, combo.kind);
}

/** 按给定比率与类型算参考线价位（保留 2 位小数） */
function fibLevelsForRatios(
  swing: FibSwing,
  ratios: number[],
  kind: 'retrace' | 'extension' | 'mixed'
): FibLevel[] {
  const { high, low, range, uptrend } = swing;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return ratios.map((r) => {
    let price: number;
    let levelKind: FibLevelKind;
    if (kind === 'retrace') {
      if (uptrend) {
        price = high - range * r;
        levelKind = 'support';
      } else {
        price = low + range * r;
        levelKind = 'resistance';
      }
    } else {
      if (uptrend) {
        price = low + range * r;
        levelKind = 'target-up';
      } else {
        price = high - range * r;
        levelKind = 'target-down';
      }
    }
    return { ratio: r, price: r2(price), kind: levelKind };
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

export interface FibPlainAdviceInput {
  price: number;
  levels: FibLevel[];
  swing: FibSwing;
  /** 持仓盈亏百分比（%），null = 没查到持仓 */
  pnlPct: number | null;
  fmt: (n: number) => string;
}

/**
 * 黄金分割"说人话"：现价在哪（已有多少、离上下线多远）+ 按持仓给行动句。
 * 口径：每句都带数字或动作，不说空话；拦追高 / 拦割肉，不预测。
 */
export function fibPlainAdvice(input: FibPlainAdviceInput): string[] | null {
  const { price, levels, swing, pnlPct, fmt } = input;
  if (!(price > 0) || levels.length === 0) return null;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const above = levels
    .filter((l) => l.price > price)
    .sort((a, b) => a.price - b.price);
  const below = levels
    .filter((l) => l.price < price)
    .sort((a, b) => b.price - a.price);
  const up = above[0] ?? null;
  const dn = below[0] ?? null;
  const distUp = up ? ((up.price - price) / price) * 100 : null;
  const distDn = dn ? ((price - dn.price) / price) * 100 : null;
  const name = (lv: FibLevel) => `${lv.ratio}${fibKindLabel(lv.kind)}`;
  const has = pnlPct != null;
  const pnl = pnlPct ?? 0;
  const pnlTxt =
    pnl > 0.05 ? `赚 ${r1(pnl)}%` : pnl < -0.05 ? `亏 ${r1(Math.abs(pnl))}%` : '没赚没亏';

  const lines: string[] = [];

  // 第一句：在哪（已有多少、离上下多远）
  if (!up && !dn) {
    lines.push(`现价 ${fmt(price)}，上下都没有参考线了。`);
  } else if (!up) {
    lines.push(`现价 ${fmt(price)} 已经站在所有参考线之上——上面没有线，是最容易追高的位置。`);
  } else if (!dn) {
    lines.push(`现价 ${fmt(price)} 已经跌破所有参考线——下面没有支撑可看，别伸手接。`);
  } else {
    const swingGain =
      swing.uptrend && swing.low > 0 ? ((price - swing.low) / swing.low) * 100 : null;
    const gainTxt =
      swingGain != null && swingGain > 0.05 ? `这一波从 ${fmt(swing.low)} 已涨 ${r1(swingGain)}%，` : '';
    lines.push(
      `现价 ${fmt(price)}，${gainTxt}离上方${name(up)} ${fmt(up.price)}还有 ${r1(distUp!)}%，` +
        `离下方${name(dn)} ${fmt(dn.price)}有 ${r1(distDn!)}% 空间。`
    );
  }

  // 第二句：怎么办（按持仓）
  const NEAR = 2; // 贴近阈值 %
  if (has) {
    if (!up) {
      lines.push(
        pnl >= 0
          ? `你${pnlTxt}，上面没线了，别再加仓——分批走一点，落袋为安。`
          : `你还${pnlTxt}，趁高把仓位降一降，别等回落。`
      );
    } else if (distUp! <= NEAR) {
      lines.push(
        pnl >= 0
          ? `摸到${name(up)}了，别再追了——你${pnlTxt}，分批走一点。`
          : `反弹到${name(up)}，你还${pnlTxt}——这是减亏窗口，分批走，别等跌回去。`
      );
    } else if (dn && distDn! <= NEAR) {
      lines.push(
        pnl >= 0
          ? `跌到${name(dn)}附近了，拿住别慌，等它站稳再说。`
          : `跌到${name(dn)}附近，你${pnlTxt}——割在地板上最亏，拿住等企稳。`
      );
    } else if (pnl >= 15) {
      lines.push(`离${name(up)}还有 ${r1(distUp!)}%，${pnlTxt}垫着，拿得住；到 ${fmt(up.price)} 一带再分批。`);
    } else if (pnl >= 0) {
      lines.push(`${pnlTxt}，离${name(up)}还有 ${r1(distUp!)}%，继续拿，但别加仓。`);
    } else {
      lines.push(`还${pnlTxt}，离${name(up)}还有 ${r1(distUp!)}%，拿着等反弹，到 ${fmt(up.price)} 一带是减亏机会。`);
    }
  } else {
    if (!up) {
      lines.push(`已经涨过所有参考线了，现在追=接飞刀，按兵不动。`);
    } else if (distUp! <= NEAR) {
      lines.push(
        dn
          ? `已经涨到${name(up)}了，现在追=接飞刀；按兵不动，等回调到${name(dn)} ${fmt(dn.price)} 一带再看。`
          : `已经涨到${name(up)}了，现在追=接飞刀，按兵不动。`
      );
    } else if (dn && distDn! <= NEAR) {
      lines.push(`跌到${name(dn)}附近，别急着抄底，等它站稳 2-3 天再动手。`);
    } else if (dn) {
      lines.push(
        `不上不下，按兵不动；真要动手，等回调到${name(dn)} ${fmt(dn.price)}附近，或者放量站上${name(up)} ${fmt(up.price)} 再说。`
      );
    } else {
      lines.push(`按兵不动；真要动手，等放量站上${name(up)} ${fmt(up.price)} 再说。`);
    }
  }
  return lines;
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
