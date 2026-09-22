/**
 * 谷峰律动 (Rhythm) v2
 *
 * 设计原则：
 * ① 主判断锚定：诊断结论永远基于近 3 个月（66 个交易日），不随展示区间变化，
 *    保证用户看到的判断建议是一致的；
 * ② 展示区间（1天…2年…全部）只控制走势图与分位位置条，是"多空对照"，不下结论；
 * ③ 分数 = 位置分×0.5 + 趋势分×0.3 + 速度分×0.2，谷峰用 5%/95% 分位数，抗离群点；
 * ④ 权重与阈值集中在本文件顶部，可根据"判断复盘"的准确率随时调整。
 */

export interface RhythmPoint {
  /** YYYY-MM-DD */
  date: string;
  close: number;
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
  { id: '1D', label: '1天', points: 1, minPoints: 1 },
  { id: '2D', label: '2天', points: 2, minPoints: 2 },
  { id: '3D', label: '3天', points: 3, minPoints: 3 },
  { id: '4D', label: '4天', points: 4, minPoints: 4 },
  { id: '1W', label: '1周', points: 5, minPoints: 5 },
  { id: '2W', label: '2周', points: 10, minPoints: 10 },
  { id: '3W', label: '3周', points: 15, minPoints: 15 },
  { id: '1M', label: '1月', points: 22, minPoints: 22 },
  { id: '2M', label: '2月', points: 44, minPoints: 44 },
  { id: '3M', label: '3月', points: 66, minPoints: 66 },
  { id: '1Y', label: '1年', points: 252, minPoints: 200 },
  { id: '2Y', label: '2年', points: 504, minPoints: 400 },
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

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const r1 = (v: number) => Math.round(v * 10) / 10;

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

export interface Judgment {
  score: number;
  status: string;
  advice: string;
  pos: number;
  trend: number;
  vel: number;
  /** 是否触发沉思乐（真正的冲高过热才触发） */
  overheated: boolean;
  anchorRange: string;
  note?: string;
}

export function judgeFromScore(
  score: number,
  trend: number,
): { status: string; advice: string; overheated: boolean } {
  if (score >= 80) {
    if (trend >= 55)
      return {
        status: '高位强势',
        advice: '上升趋势健康，持有即可；不追高加仓。',
        overheated: false,
      };
    return {
      status: '冲高过热',
      advice: '乖离过大，警惕追高冲动；可考虑分批止盈。',
      overheated: true,
    };
  }
  if (score >= 60)
    return { status: '主升加速', advice: '动能强劲，按既定节奏持有。', overheated: false };
  if (score >= 40)
    return { status: '蓄势震荡', advice: '多空均衡，区间内按节奏操作。', overheated: false };
  if (score >= 20)
    return { status: '谷底抬头', advice: '跌势趋缓，可回顾买入逻辑。', overheated: false };
  if (trend <= 45)
    return { status: '低位弱势', advice: '下降趋势中，不急于抄底。', overheated: false };
  return { status: '超卖触底', advice: '情绪偏冷，可分批关注。', overheated: false };
}

/** 基于全量日线做主判断（锚定近 3 月） */
export function buildJudgment(closes: number[]): Judgment {
  const s = closes.length > 0 ? scoreAt(closes, closes.length - 1) : null;
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
      note: '数据不足',
    };
  }
  const { status, advice, overheated } = judgeFromScore(s.score, s.trend);
  return { ...s, status, advice, overheated, anchorRange: ANCHOR_RANGE_ID };
}

export interface RhythmResponse {
  symbol: string;
  range: string;
  price: number;
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
  source: 'nasdaq' | 'yahoo' | 'simulated';
  updatedAt: string;
}

/** 综合分数 -> 分数条渐变色 */
export function scoreGradient(score: number): string {
  if (score >= 80) return 'from-amber-400 to-red-500';
  if (score >= 60) return 'from-emerald-400 to-teal-500';
  if (score >= 40) return 'from-sky-400 to-blue-500';
  if (score >= 20) return 'from-slate-400 to-slate-500';
  return 'from-indigo-400 to-purple-500';
}
