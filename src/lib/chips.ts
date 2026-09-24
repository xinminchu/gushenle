import type { RhythmPoint } from './rhythm';
import { fmtMoney } from './currency';

export interface ChipBin {
  /**  bin 中心价 */
  price: number;
  /** 占总筹码比例 0-1 */
  pct: number;
}

export interface ChipResult {
  bins: ChipBin[];
  /** 获利盘比例：现价以下的筹码占比 0-1 */
  profitRatio: number;
  /** 平均持仓成本（成交量加权） */
  avgCost: number;
  /** 70% 筹码最集中的价格区间 [low, high] */
  conc70: [number, number];
  /** 现价上方最大的套牢峰 [价格, 占比]，没有则为 null */
  trapPeak: [number, number] | null;
  /** 参与估算的交易日数 */
  days: number;
  /** 大白话一句话 */
  verdict: string;
}

const BINS = 120;
/** 最多用最近多少个交易日估算（约1年，避免三年前的老筹码主导结论） */
const MAX_DAYS = 250;

/**
 * 筹码分布估算（确定性本地算法，非交易所数据）：
 * 每天把成交量按三角分布摊到 [low, high] 之间、峰值在收盘价，
 * 累加得到各价位的持仓成本分布。缺 volume 的日子跳过。
 */
export function estimateChips(series: RhythmPoint[], price: number, symbol: string): ChipResult | null {
  const bars = series
    .filter((p) => p.volume != null && p.volume > 0 && p.high != null && p.low != null && p.high >= p.low && p.low > 0)
    .slice(-MAX_DAYS);
  if (bars.length < 20 || !(price > 0)) return null;

  let minP = Infinity;
  let maxP = -Infinity;
  for (const b of bars) {
    if (b.low! < minP) minP = b.low!;
    if (b.high! > maxP) maxP = b.high!;
  }
  if (!Number.isFinite(minP) || maxP <= minP) return null;

  const width = (maxP - minP) / BINS;
  const vols = new Array<number>(BINS).fill(0);

  for (const b of bars) {
    const lo = b.low!;
    const hi = b.high!;
    const cl = Math.min(Math.max(b.close, lo), hi);
    const v = b.volume!;
    // 该日覆盖的 bin 范围
    const i0 = Math.max(0, Math.floor((lo - minP) / width));
    const i1 = Math.min(BINS - 1, Math.floor((hi - minP) / width));
    if (i1 <= i0) {
      vols[i0] += v;
      continue;
    }
    // 三角分布：峰值在收盘价处
    const peak = (cl - minP) / width;
    let wSum = 0;
    const ws: number[] = [];
    for (let i = i0; i <= i1; i++) {
      const c = i + 0.5;
      const w = Math.max(0, 1 - Math.abs(c - peak) / (i1 - i0 + 1));
      ws.push(w);
      wSum += w;
    }
    if (wSum <= 0) {
      vols[i0] += v;
      continue;
    }
    for (let k = 0; k < ws.length; k++) vols[i0 + k] += (v * ws[k]) / wSum;
  }

  const total = vols.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;

  const bins: ChipBin[] = vols.map((v, i) => ({
    price: minP + (i + 0.5) * width,
    pct: v / total,
  }));

  let profit = 0;
  let costSum = 0;
  for (const b of bins) {
    if (b.price < price) profit += b.pct;
    costSum += b.price * b.pct;
  }
  const avgCost = costSum;

  // 70% 筹码最集中的连续区间（滑窗）
  let best: [number, number] = [bins[0].price, bins[bins.length - 1].price];
  let bestW = Infinity;
  let acc = 0;
  let j = 0;
  for (let i = 0; i < bins.length; i++) {
    if (j < i) {
      j = i;
      acc = 0;
    }
    while (j < bins.length && acc < 0.7) {
      acc += bins[j].pct;
      j++;
    }
    if (acc >= 0.7) {
      const w = bins[j - 1].price - bins[i].price;
      if (w < bestW) {
        bestW = w;
        best = [bins[i].price, bins[j - 1].price];
      }
    }
    acc -= bins[i].pct;
  }

  // 现价上方最大的套牢峰（局部极大值）
  let trapPeak: [number, number] | null = null;
  for (let i = 1; i < bins.length - 1; i++) {
    const b = bins[i];
    if (b.price <= price) continue;
    if (b.pct >= bins[i - 1].pct && b.pct >= bins[i + 1].pct) {
      if (!trapPeak || b.pct > trapPeak[1]) trapPeak = [b.price, b.pct];
    }
  }

  const pr = Math.round(profit * 100);
  let verdict: string;
  if (profit >= 0.9) {
    verdict = `几乎人人赚钱（获利盘${pr}%），越往上越要防获利回吐`;
  } else if (profit <= 0.15) {
    verdict = trapPeak
      ? `大片筹码套在上面，涨到 ${fmtMoney(symbol, trapPeak[0])} 附近可能遇到抛压`
      : `获利盘只有${pr}%，上面全是套牢盘，别急着追`;
  } else if (avgCost > price) {
    verdict = `平均成本在现价之上，大部分人还亏着，先别急`;
  } else {
    verdict = `筹码比较分散（获利盘${pr}%），没有明显的多空决战区`;
  }

  return { bins, profitRatio: profit, avgCost, conc70: best, trapPeak, days: bars.length, verdict };
}
