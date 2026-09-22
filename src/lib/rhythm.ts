/**
 * 谷峰律动 (Rhythm) 共享类型与工具函数
 * 前后端共用：/api/rhythm 返回的数据结构，以及动能分数 -> 状态文案的映射。
 */

export interface RhythmPoint {
  /** YYYY-MM-DD，兼容 lightweight-charts 的 time 格式 */
  date: string;
  close: number;
}

export interface RhythmRange {
  price: number;
  date: string;
}

export interface RhythmResponse {
  symbol: string;
  range: string;
  price: number;
  /** 区间涨跌幅（%） */
  changePct: number;
  peak: RhythmRange;
  valley: RhythmRange;
  /** 0-100：当前价在波谷-波峰区间中的位置，即"动能分数" */
  rhythmPos: number;
  series: RhythmPoint[];
  source: 'nasdaq' | 'yahoo' | 'simulated';
  updatedAt: string;
}

/** 动能分数 -> 中文状态文案 */
export function statusForScore(score: number): string {
  if (score >= 80) return '冲高过热';
  if (score >= 60) return '主升加速';
  if (score >= 40) return '蓄势震荡';
  if (score >= 20) return '谷底抬头';
  return '超卖触底';
}

/** 动能分数 -> 分数条渐变色 */
export function scoreGradient(score: number): string {
  if (score >= 80) return 'from-amber-400 to-red-500';
  if (score >= 60) return 'from-emerald-400 to-teal-500';
  if (score >= 40) return 'from-sky-400 to-blue-500';
  if (score >= 20) return 'from-slate-400 to-slate-500';
  return 'from-indigo-400 to-purple-500';
}
