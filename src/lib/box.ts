// src/lib/box.ts
// 箱体律动：把「律动」从一个看不见的分数，换成画在历史线上的箱子。
// 箱子 = 一段时间 + 一个价格带。系统按横盘段提议，用户可自定/采纳/微调（本机存储）。
// 所有统计只用这只股自己的历史、只报事实：箱内位置 / 触边史 / 出箱史。不下买卖结论。
// 口径：全部基于收盘价；箱的侦测只用该段自身数据，段后走势只用于事后统计。

export interface BoxDef {
  id: string;
  startDate: string; // 箱体形成段起始（交易日）
  endDate: string; // 箱体形成段结束（交易日）
  top: number;
  bottom: number;
  source: 'auto' | 'user';
  createdAt: number;
}

export interface SeriesPoint {
  date: string;
  close: number;
}

const MIN_BOX_DAYS = 15; // 形成段至少 15 个交易日
const MAX_RANGE_PCT = 0.2; // 段内（高-低）/均价 ≤ 20% 才算横盘
const TOUCH_BAND = 0.02; // 收盘进入边线 2% 内算「触边」
const TOUCH_GAP = 4; // 同一条边两次触边至少间隔 4 个交易日
const BREAK_PCT = 0.01; // 收盘越过边线 1% 算出箱

function segmentStats(closes: number[], i: number, j: number) {
  let hi = -Infinity;
  let lo = Infinity;
  let sum = 0;
  for (let k = i; k <= j; k++) {
    hi = Math.max(hi, closes[k]);
    lo = Math.min(lo, closes[k]);
    sum += closes[k];
  }
  const mean = sum / (j - i + 1);
  return { hi, lo, mean, rangePct: mean > 0 ? (hi - lo) / mean : Infinity };
}

function countTouches(closes: number[], i: number, j: number, edge: number, isTop: boolean): number {
  let count = 0;
  let lastTouch = -Infinity;
  for (let k = i; k <= j; k++) {
    const near = isTop ? closes[k] >= edge * (1 - TOUCH_BAND) : closes[k] <= edge * (1 + TOUCH_BAND);
    if (near && k - lastTouch >= TOUCH_GAP) {
      count += 1;
      lastTouch = k;
    }
  }
  return count;
}

/**
 * 侦测横盘箱：贪心扩张——从 i 起尽量延长段，段内振幅不超限、且顶/底各至少触边 2 次才成箱。
 * 成箱后从段尾之后继续找。返回按时间升序的全部箱子（调用方取最近几个）。
 */
export function detectBoxes(points: SeriesPoint[]): BoxDef[] {
  const closes = points.map((p) => p.close);
  const n = closes.length;
  const boxes: BoxDef[] = [];
  let i = 0;
  while (i + MIN_BOX_DAYS <= n) {
    let bestJ = -1;
    let bestStats: ReturnType<typeof segmentStats> | null = null;
    for (let j = i + MIN_BOX_DAYS - 1; j < n; j++) {
      const st = segmentStats(closes, i, j);
      if (st.rangePct > MAX_RANGE_PCT) break; // 再延只会更宽
      const topT = countTouches(closes, i, j, st.hi, true);
      const botT = countTouches(closes, i, j, st.lo, false);
      if (topT >= 2 && botT >= 2) {
        bestJ = j;
        bestStats = st;
      }
    }
    if (bestJ >= 0 && bestStats) {
      boxes.push({
        id: `auto-${points[i].date}-${points[bestJ].date}`,
        startDate: points[i].date,
        endDate: points[bestJ].date,
        top: Math.round(bestStats.hi * 100) / 100,
        bottom: Math.round(bestStats.lo * 100) / 100,
        source: 'auto',
        createdAt: 0,
      });
      i = bestJ + 1;
    } else {
      i += 1;
    }
  }
  return boxes;
}

/** 现价在箱内的位置 %（0=贴底边，100=贴顶边；可 <0 或 >100，表示已在箱外） */
export function boxPosition(box: BoxDef, price: number): number | null {
  if (box.top <= box.bottom) return null;
  return ((price - box.bottom) / (box.top - box.bottom)) * 100;
}

export type BoxState =
  | 'inside' // 箱内
  | 'nearTop' // 贴顶边（2% 内）
  | 'nearBottom' // 贴底边（2% 内）
  | 'above' // 已在箱上（越顶 1% 以上）
  | 'below'; // 已在箱下（越底 1% 以上）

export function boxState(box: BoxDef, price: number): BoxState {
  if (price > box.top * (1 + BREAK_PCT)) return 'above';
  if (price < box.bottom * (1 - BREAK_PCT)) return 'below';
  if (price >= box.top * (1 - TOUCH_BAND)) return 'nearTop';
  if (price <= box.bottom * (1 + TOUCH_BAND)) return 'nearBottom';
  return 'inside';
}

export interface TouchStat {
  count: number;
  medianFwd20: number | null; // 触边后 20 个交易日涨跌 % 中位数
  worstFwd20: number | null;
  bestFwd20: number | null;
}

export interface BoxTouchStats {
  top: TouchStat;
  bottom: TouchStat;
}

function fwdReturns(closes: number[], idx: number): number | null {
  const j = idx + 20;
  if (j >= closes.length || closes[idx] <= 0) return null;
  return ((closes[j] - closes[idx]) / closes[idx]) * 100;
}

function summarize(vals: number[]): { median: number | null; worst: number | null; best: number | null } {
  if (vals.length === 0) return { median: null, worst: null, best: null };
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return {
    median: s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2,
    worst: s[0],
    best: s[s.length - 1],
  };
}

/** 触边史：箱形成段开始至今，每条边被触碰的次数 + 触碰后 20 日实际涨跌分布。 */
export function touchStats(points: SeriesPoint[], box: BoxDef): BoxTouchStats {
  const closes = points.map((p) => p.close);
  const startIdx = points.findIndex((p) => p.date >= box.startDate);
  const mk = (isTop: boolean): TouchStat => {
    const edge = isTop ? box.top : box.bottom;
    let count = 0;
    let lastTouch = -Infinity;
    const fwds: number[] = [];
    if (startIdx < 0) return { count: 0, medianFwd20: null, worstFwd20: null, bestFwd20: null };
    for (let k = startIdx; k < closes.length; k++) {
      const near = isTop ? closes[k] >= edge * (1 - TOUCH_BAND) : closes[k] <= edge * (1 + TOUCH_BAND);
      if (near && k - lastTouch >= TOUCH_GAP) {
        count += 1;
        lastTouch = k;
        const f = fwdReturns(closes, k);
        if (f != null) fwds.push(f);
      }
    }
    const s = summarize(fwds);
    return { count, medianFwd20: s.median, worstFwd20: s.worst, bestFwd20: s.best };
  };
  return { top: mk(true), bottom: mk(false) };
}

export interface BreakoutHistory {
  boxesFound: number;
  breaks: number; // 出箱次数（上下合计）
  followThrough: number; // 出箱后 20 日内继续同向走 ≥ 半个箱高
  falseBreak: number; // 出箱后 5 日内收盘缩回箱内
  neither: number;
}

/** 出箱史：对全历史侦测出的每个箱，看它后来怎么出箱、出箱后是真是假。 */
export function breakoutHistory(points: SeriesPoint[]): BreakoutHistory {
  const closes = points.map((p) => p.close);
  const boxes = detectBoxes(points);
  const out: BreakoutHistory = { boxesFound: boxes.length, breaks: 0, followThrough: 0, falseBreak: 0, neither: 0 };
  const idxOf = new Map(points.map((p, i) => [p.date, i]));
  for (const box of boxes) {
    const endIdx = idxOf.get(box.endDate);
    if (endIdx == null) continue;
    const height = box.top - box.bottom;
    if (height <= 0) continue;
    // 从形成段结束之后找第一次出箱（最多看 60 个交易日）
    let breakIdx = -1;
    let dir = 0;
    for (let k = endIdx + 1; k < Math.min(closes.length, endIdx + 61); k++) {
      if (closes[k] > box.top * (1 + BREAK_PCT)) { breakIdx = k; dir = 1; break; }
      if (closes[k] < box.bottom * (1 - BREAK_PCT)) { breakIdx = k; dir = -1; break; }
    }
    if (breakIdx < 0) continue; // 还没出箱（或数据不够）
    out.breaks += 1;
    // 假突破：5 日内收盘回到箱内
    let backIn = false;
    for (let k = breakIdx + 1; k <= Math.min(closes.length - 1, breakIdx + 5); k++) {
      if (closes[k] <= box.top && closes[k] >= box.bottom) { backIn = true; break; }
    }
    if (backIn) { out.falseBreak += 1; continue; }
    // 延续：20 日内同向极值达到半个箱高
    let followed = false;
    for (let k = breakIdx + 1; k <= Math.min(closes.length - 1, breakIdx + 20); k++) {
      const moved = dir === 1 ? closes[k] - box.top : box.bottom - closes[k];
      if (moved >= height / 2) { followed = true; break; }
    }
    if (followed) out.followThrough += 1;
    else out.neither += 1;
  }
  return out;
}

// ---------- 本机存储（每只股一组箱子） ----------

const KEY = 'gushenle_boxes_v1';

function loadAll(): Record<string, BoxDef[]> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

export function loadBoxes(symbol: string): BoxDef[] {
  return loadAll()[symbol.toUpperCase()] ?? [];
}

export function saveBox(symbol: string, box: BoxDef): BoxDef[] {
  const all = loadAll();
  const key = symbol.toUpperCase();
  const list = [...(all[key] ?? []), box];
  all[key] = list;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
  return list;
}

export function replaceBox(symbol: string, box: BoxDef): BoxDef[] {
  const all = loadAll();
  const key = symbol.toUpperCase();
  const list = (all[key] ?? []).map((b) => (b.id === box.id ? box : b));
  all[key] = list;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
  return list;
}

export function deleteBox(symbol: string, id: string): BoxDef[] {
  const all = loadAll();
  const key = symbol.toUpperCase();
  const list = (all[key] ?? []).filter((b) => b.id !== id);
  all[key] = list;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
  return list;
}

/** 箱龄：形成段结束到最新交易日之间的交易日数 */
export function boxAgeDays(points: SeriesPoint[], box: BoxDef): number | null {
  const idx = points.findIndex((p) => p.date >= box.endDate);
  if (idx < 0) return null;
  return points.length - 1 - idx;
}
