/**
 * 谷峰律动 (Rhythm) v3
 *
 * 设计原则：
 * ① 主判断锚定：诊断结论永远基于近 3 个月（66 个交易日），不随展示区间变化，
 *    保证用户看到的判断建议是一致的；
 * ② 展示区间（1周…2年…全部）只控制走势图与分位位置条，是"多空对照"，不下结论；
 * ③ 分数 = 位置分×0.5 + 趋势分×0.3 + 速度分×0.2，谷峰用 5%/95% 分位数，抗离群点；
 * ④ 阈值按波动率自适应：高波股用 85/15、稳健股用 80/20，档位由 trailing 66 天
 *    波动率决定（慢变量，不跳变）；权重与阈值集中在本文件顶部，可随时调整。
 * ⑤ 涨太猛了（触发沉思乐）= 分数 ≥过热阈值 且 速度分 ≥90（短期抛物线），
 *    不看趋势分——趋势分与综合分高度相关，"高分+弱趋势"现实中几乎到不了。
 */

export interface RhythmPoint {
  /** YYYY-MM-DD */
  date: string;
  close: number;
  /** 日内开/高/低（K线用；老数据或兜底数据可能缺失，此时按 close 处理） */
  open?: number;
  high?: number;
  low?: number;
  /** 日成交量（股；筹码分布用；缺失时该日不参与筹码估算） */
  volume?: number;
}

/** 展示区间定义 */
export interface RangeDef {
  id: string;
  label: string;
  /** 该区间需要的交易日点数 */
  points: number;
  /** 显示该选项所需的最少点数（上市不足的不显示） */
  minPoints: number;
}

export const RANGE_DEFS: RangeDef[] = [
  { id: '1W', label: '1周', points: 5, minPoints: 5 },
  { id: '3W', label: '3周', points: 15, minPoints: 15 },
  { id: '1M', label: '1月', points: 22, minPoints: 22 },
  { id: '3M', label: '3月', points: 66, minPoints: 66 },
  { id: '1Y', label: '1年', points: 252, minPoints: 200 },
  { id: 'ALL', label: '全部', points: 99999, minPoints: 1 },
];

export const RANGE_MAP: Record<string, RangeDef> = Object.fromEntries(
  RANGE_DEFS.map((d) => [d.id, d]),
);

/** 主判断锚定区间：诊断结论永远基于它 */
export const ANCHOR_RANGE_ID = '3M';
export const ANCHOR_POINTS = 66;

/* ---------- 可调参数：根据复盘准确率调整 ---------- */
const PCTL_LOW = 5; // 分位谷：5% 分位数（抗离群点）
const PCTL_HIGH = 95; // 分位峰：95% 分位数
const W_POS = 0.5; // 位置分权重
const W_TREND = 0.3; // 趋势分权重
const W_VEL = 0.2; // 速度分权重
const MA_LEN = 20; // 趋势均线长度
const MIN_HISTORY = 22; // 做判断所需的最少交易日

/* ---------- 波动率自适应阈值（v3）：分档依据来自 2026-09-22 实测 ----------
 * 近 66 个交易日的日收益率样本标准差 σ（Nasdaq 日线）：
 *   AAPL 1.95% / NVDA 2.50% / MSFT 2.67% —— 过去一年从未超过 3%
 *   COIN 4.93% / MSTR 5.89%              —— 过去一年始终超过 3%
 *   TSLA 3.48%                           —— 37% 天数超过 3%，边界，会偶发切换
 * 3% 线恰好把"超卖失灵、信号泛滥"的高波股与稳健股分开：
 *   高波股一年超卖信号 118~165 次、命中率≈抛硬币（49~53%）；
 *   稳健股一年超卖信号 33~83 次、命中率 62~79%。
 * 档位由"当时"的 trailing 66 天波动率决定，是慢变量，保证每天的结论稳定、不跳变。
 */
const VOL_WINDOW = 66; // 波动率统计窗口（交易日）
const VOL_HIGH_CUTOFF = 0.03; // 日σ > 3% 判为高波档
const HOT_STABLE = 80; // 稳健档：过热阈值
const COLD_STABLE = 20; // 稳健档：超卖阈值
const HOT_HIGHVOL = 85; // 高波档：过热阈值（收紧，减少泛滥信号）
const COLD_HIGHVOL = 15; // 高波档：超卖阈值（收紧）
const VEL_PARABOLIC = 90; // 抛物线触发线：速度分 ≥90（近 5 日涨幅 ≥5%）视为短期失速，
  // 分数同时 ≥过热阈值即判"涨太猛了"并触发沉思乐（方向a：不看趋势分，
  // 因趋势分与综合分高度相关，"高分+弱趋势"在现实中几乎到不了）

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;
const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** 分位数（线性插值），输入需升序排列 */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const rank = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (rank - lo);
}

export interface DayScore {
  /** 位置分：现价在近 66 日分位区间中的位置 */
  pos: number;
  /** 趋势分：相对 20 日均线的偏离 + 均线斜率 */
  trend: number;
  /** 速度分：近 5 日涨跌速率 */
  vel: number;
  /** 综合分 0-100 */
  score: number;
}

/**
 * 计算某一天收盘时的三因子与综合分。
 * 只使用 closes[0..endIdx] 的数据（无未来函数），可直接用于历史复盘。
 * 数据不足（<22 天）时返回 null。
 */
export function scoreAt(closes: number[], endIdx: number): DayScore | null {
  const n = endIdx + 1;
  if (n < MIN_HISTORY || endIdx >= closes.length) return null;
  const last = closes[endIdx];

  // 位置分：近 66 日（不足则取全部）的 5%/95% 分位
  const winLen = Math.min(ANCHOR_POINTS, n);
  const window = closes.slice(n - winLen, n);
  const sorted = [...window].sort((a, b) => a - b);
  const p5 = percentile(sorted, PCTL_LOW);
  const p95 = percentile(sorted, PCTL_HIGH);
  const pos = p95 > p5 ? clamp(((last - p5) / (p95 - p5)) * 100, 0, 100) : 50;

  // 趋势分：相对 MA20 的偏离 + MA20 的斜率
  const maLen = Math.min(MA_LEN, n);
  const recent = closes.slice(n - maLen, n);
  const ma = recent.reduce((a, b) => a + b, 0) / recent.length;
  const prevEnd = Math.max(maLen, n - 10);
  const prev = closes.slice(prevEnd - maLen, prevEnd);
  const maPrev = prev.reduce((a, b) => a + b, 0) / prev.length;
  const dev = ma > 0 ? ((last - ma) / ma) * 100 : 0;
  const slope = maPrev > 0 ? ((ma - maPrev) / maPrev) * 100 : 0;
  const trend = clamp(50 + dev * 6 + slope * 10, 0, 100);

  // 速度分：近 5 日涨跌速率
  const refIdx = Math.max(0, endIdx - 5);
  const ref = closes[refIdx];
  const roc5 = ref > 0 ? ((last - ref) / ref) * 100 : 0;
  const vel = clamp(50 + roc5 * 8, 0, 100);

  const score = Math.round(W_POS * pos + W_TREND * trend + W_VEL * vel);
  return { pos: r1(pos), trend: r1(trend), vel: r1(vel), score };
}

/** 波动率档位 */
export type VolTier = 'high' | 'stable';

/** 自适应阈值：过热/超卖的触发线随该股波动率档位变化 */
export interface RhythmThresholds {
  /** 过热阈值：分数 ≥ hot 记过热类信号 */
  hot: number;
  /** 超卖阈值：分数 ≤ cold 记超卖类信号 */
  cold: number;
  tier: VolTier;
  /** 展示用：'高波模式' / '稳健模式' */
  tierLabel: string;
  /** 当时 trailing 波动率（日σ，小数，如 0.0487） */
  vol: number;
}

/**
 * trailing 波动率：近 VOL_WINDOW 个交易日的日收益率样本标准差。
 * 只使用 closes[0..endIdx] 的数据（无未来函数），可直接用于历史复盘。
 */
export function volatilityAt(closes: number[], endIdx: number): number {
  const end = Math.min(endIdx, closes.length - 1);
  const start = Math.max(1, end - VOL_WINDOW + 1);
  if (start > end) return 0;
  const rets: number[] = [];
  for (let i = start; i <= end; i++) {
    const prev = closes[i - 1];
    if (prev > 0) rets.push(closes[i] / prev - 1);
  }
  if (rets.length < 2) return 0;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance);
}

/** 按波动率定阈值档位（慢变量：trailing 66 天窗口保证档位不频繁跳变） */
export function thresholdsFor(vol: number): RhythmThresholds {
  if (vol > VOL_HIGH_CUTOFF) {
    return {
      hot: HOT_HIGHVOL,
      cold: COLD_HIGHVOL,
      tier: 'high',
      tierLabel: '高波模式',
      vol: r4(vol),
    };
  }
  return {
    hot: HOT_STABLE,
    cold: COLD_STABLE,
    tier: 'stable',
    tierLabel: '稳健模式',
    vol: r4(vol),
  };
}

/** 诊断状态 key：逻辑判断只认 key，中文展示走 STATUS_LABELS（说人话，大白话） */
export type StatusKey =
  | 'overheated' // 涨太猛了
  | 'hotStrong' // 高位稳着涨
  | 'risingAccel' // 涨势加速
  | 'sideways' // 横盘波动
  | 'bottomUp' // 跌不动了
  | 'weakLow' // 还在往下跌
  | 'oversoldBottom'; // 跌过头了

/** 有明确交易信号的四种状态（复盘计入；中间三种不记信号） */
export type SignalStatusKey = 'overheated' | 'hotStrong' | 'weakLow' | 'oversoldBottom';

/** 状态 key -> 中文展示（全站唯一映射，改词只改这里） */
export const STATUS_LABELS: Record<StatusKey, string> = {
  overheated: '涨太猛了',
  hotStrong: '高位稳着涨',
  risingAccel: '涨势加速',
  sideways: '横盘波动',
  bottomUp: '跌不动了',
  weakLow: '还在往下跌',
  oversoldBottom: '跌过头了',
};

export interface Judgment {
  score: number;
  /** 状态 key（逻辑用；数据不足时为空） */
  statusKey?: StatusKey;
  /** 中文展示 = STATUS_LABELS[statusKey]（数据不足时为'数据不足'） */
  status: string;
  advice: string;
  pos: number;
  trend: number;
  vel: number;
  /** 是否触发沉思乐（涨太猛了才触发） */
  overheated: boolean;
  anchorRange: string;
  /** 当时波动率档位下的自适应阈值（诊断/沉思乐/UI 走同一套） */
  thresholds: RhythmThresholds;
  note?: string;
}

export function judgeFromScore(
  score: number,
  trend: number,
  vel: number,
  th: RhythmThresholds,
): { statusKey: StatusKey; advice: string; overheated: boolean } {
  if (score >= th.hot) {
    if (vel >= VEL_PARABOLIC)
      return {
        statusKey: 'overheated',
        advice: '短期涨太快了，先冷静一下？可以考虑分批止盈。',
        overheated: true,
      };
    return {
      statusKey: 'hotStrong',
      advice: '趋势挺健康的，拿着就好；先别急着加仓。',
      overheated: false,
    };
  }
  if (score >= 60)
    return {
      statusKey: 'risingAccel',
      advice: '涨得有劲，按你的节奏拿着就行。',
      overheated: false,
    };
  if (score >= 40)
    return {
      statusKey: 'sideways',
      advice: '涨跌两难，区间里按节奏来就好。',
      overheated: false,
    };
  if (score >= th.cold)
    return {
      statusKey: 'bottomUp',
      advice: '跌势缓下来了，可以回顾下当初买入的理由。',
      overheated: false,
    };
  if (trend <= 45)
    return {
      statusKey: 'weakLow',
      advice: '还在下跌趋势里，先别急着抄底。',
      overheated: false,
    };
  return {
    statusKey: 'oversoldBottom',
    advice: '市场情绪有点冷过头了，可以分批留意。',
    overheated: false,
  };
}

/** 基于全量日线做主判断（锚定近 3 月；阈值按最新 trailing 波动率自适应） */
export function buildJudgment(closes: number[]): Judgment {
  const s = closes.length > 0 ? scoreAt(closes, closes.length - 1) : null;
  const vol = closes.length > 0 ? volatilityAt(closes, closes.length - 1) : 0;
  const thresholds = thresholdsFor(vol);
  if (!s) {
    return {
      score: 50,
      status: '数据不足',
      advice: '上市时间较短，暂无足够数据做出判断。',
      pos: 50,
      trend: 50,
      vel: 50,
      overheated: false,
      anchorRange: ANCHOR_RANGE_ID,
      thresholds,
      note: '数据不足',
    };
  }
  const { statusKey, advice, overheated } = judgeFromScore(s.score, s.trend, s.vel, thresholds);
  return {
    ...s,
    statusKey,
    status: STATUS_LABELS[statusKey],
    advice,
    overheated,
    anchorRange: ANCHOR_RANGE_ID,
    thresholds,
  };
}

export interface RhythmResponse {
  symbol: string;
  range: string;
  price: number;
  /** true=盘中实时价，false=日线收盘价 */
  priceLive: boolean;
  /** 实时价的时间戳（美东），收盘价时为 null */
  priceTime: string | null;
  /** 当日涨跌幅（%，相对昨收）；仅实时价时有值 */
  dayChangePct: number | null;
  /** 日线最后一根收盘价；盘中时=昨收（图上红线就是它），收盘后=现价 */
  prevClose: number | null;
  /** 所选区间涨跌幅（%） */
  changePct: number;
  /** 所选区间分位低点 / 高点（5% / 95% 分位数） */
  low: number;
  high: number;
  /** 现价在所选区间分位中的位置 0-100；点数不足为 null */
  slicePos: number | null;
  series: RhythmPoint[];
  /** 全量数据点数（用于判断各区间是否可显示） */
  fullPoints: number;
  availableRanges: string[];
  /** 主判断：永远锚定近 3 月 */
  judgment: Judgment;
  source: 'nasdaq' | 'yahoo' | 'naver' | 'simulated';
  updatedAt: string;
}

/** 综合分数 -> 分数条渐变色（色带边界跟随自适应阈值） */
export function scoreGradient(score: number, hot = 80, cold = 20): string {
  if (score >= hot) return 'from-amber-400 to-red-500';
  if (score >= 60) return 'from-emerald-400 to-teal-500';
  if (score >= 40) return 'from-sky-400 to-blue-500';
  if (score >= cold) return 'from-slate-400 to-slate-500';
  return 'from-indigo-400 to-purple-500';
}

