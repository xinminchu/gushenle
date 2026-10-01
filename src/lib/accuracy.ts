// src/lib/accuracy.ts
// 判断复盘的无未来函数回测计算（/api/accuracy 与 /api/cron/accuracy-ledger 共用）。
//
// 对过去每一天 T：只用 T 及之前的数据算综合分、trailing 波动率与"当时"的阈值档位
// （与线上主判断同一算法，严禁未来函数）；四种明确状态各记一次"信号"，
// 用 T+1 日的真实涨跌验证命中。
//
// 四状态与命中规则（与建议语义匹配）：
// - 涨太猛了 / 高位稳着涨 / 还在往下跌（别追、别抄底语义）：次日涨幅 < +0.5% 算命中
// - 跌过头了（赌反弹语义）：次日涨幅 > -0.5% 算命中
// 中间分数（涨势加速 / 横盘波动 / 跌不动了）不记信号。
// 基线：全部样本日中次日涨幅 < +0.5% 的占比（别追类基线）与 > -0.5% 的占比
// （反弹类基线），用来衡量信号相对"无脑判断"的真实 edge。

import {
  scoreAt,
  judgeFromScore,
  volatilityAt,
  thresholdsFor,
  type RhythmThresholds,
  type VolTier,
  type SignalStatusKey,
} from '@/lib/rhythm';
import { getFullSeries } from '@/lib/marketData';

/** 有明确信号的四种状态 key（与 lib/rhythm 的 SignalStatusKey 同源） */
export const SIGNAL_KEYS: readonly SignalStatusKey[] = [
  'overheated',
  'hotStrong',
  'weakLow',
  'oversoldBottom',
];

const STATUS_META: Record<SignalStatusKey, { baseline: 'chase' | 'bounce' }> = {
  hotStrong: { baseline: 'chase' },
  overheated: { baseline: 'chase' },
  weakLow: { baseline: 'chase' },
  oversoldBottom: { baseline: 'bounce' },
};

export interface AccuracySignal {
  date: string;
  score: number;
  statusKey: SignalStatusKey;
  tier: VolTier;
  nextReturn: number;
  hit: boolean;
}

export interface StatusStat {
  total: number;
  hits: number;
  accuracy: number | null;
  /** 对照基线：别追类用 chase，反弹类用 bounce */
  baseline: number | null;
  /** 超出基线的百分点（accuracy - baseline），为 null 时无意义 */
  edge: number | null;
}

export interface AccuracyStats {
  total: number;
  hits: number;
  accuracy: number | null;
  sampleDays: number;
  baseline: { chase: number | null; bounce: number | null };
  statuses: Record<SignalStatusKey, StatusStat>;
}

export type AccuracyResult =
  | { available: false; reason: string }
  | { available: true; stats: AccuracyStats; signals: AccuracySignal[] };

const pct1 = (v: number) => Math.round(v * 1000) / 10;

/** 回测最近约 1 年的信号（每天需 ≥67 天历史：66 天锚定 + 波动率窗口） */
export async function computeAccuracy(symbol: string): Promise<AccuracyResult> {
  const sym = symbol.toUpperCase();
  const { series, source } = await getFullSeries(sym);
  if (source === 'simulated') {
    return { available: false, reason: 'simulated' };
  }

  const closes = series.map((p) => p.close);
  const dates = series.map((p) => p.date);
  const signals: AccuracySignal[] = [];

  const from = Math.max(66, closes.length - 2 - 365);
  let sampleDays = 0;
  let chaseDays = 0;
  let bounceDays = 0;
  for (let t = from; t <= closes.length - 2; t++) {
    const s = scoreAt(closes, t);
    if (!s) continue;
    // 当时的 trailing 波动率 -> 当时的阈值档位（慢变量，无未来函数）
    const th: RhythmThresholds = thresholdsFor(volatilityAt(closes, t));
    const j = judgeFromScore(s.score, s.trend, s.vel, th);
    const key: SignalStatusKey | null = (SIGNAL_KEYS as readonly string[]).includes(j.statusKey)
      ? (j.statusKey as SignalStatusKey)
      : null;
    const nextReturn = ((closes[t + 1] - closes[t]) / closes[t]) * 100;

    sampleDays++;
    if (nextReturn < 0.5) chaseDays++;
    if (nextReturn > -0.5) bounceDays++;
    if (!key) continue; // 中间分数不记信号

    const ok = STATUS_META[key].baseline === 'chase' ? nextReturn < 0.5 : nextReturn > -0.5;
    signals.push({
      date: dates[t],
      score: s.score,
      statusKey: key,
      tier: th.tier,
      nextReturn: Math.round(nextReturn * 100) / 100,
      hit: ok,
    });
  }

  const rate = (total: number, hits: number): number | null => (total ? pct1(hits / total) : null);

  const baseline = {
    chase: sampleDays ? pct1(chaseDays / sampleDays) : null,
    bounce: sampleDays ? pct1(bounceDays / sampleDays) : null,
  };

  const statuses = {} as Record<SignalStatusKey, StatusStat>;
  (Object.keys(STATUS_META) as SignalStatusKey[]).forEach((key) => {
    const list = signals.filter((s) => s.statusKey === key);
    const hits = list.filter((s) => s.hit).length;
    const accuracy = rate(list.length, hits);
    const bl = baseline[STATUS_META[key].baseline];
    statuses[key] = {
      total: list.length,
      hits,
      accuracy,
      baseline: bl,
      edge: accuracy != null && bl != null ? Math.round((accuracy - bl) * 10) / 10 : null,
    };
  });

  const totalHits = signals.filter((s) => s.hit).length;
  return {
    available: true,
    signals,
    stats: {
      total: signals.length,
      hits: totalHits,
      accuracy: rate(signals.length, totalHits),
      sampleDays,
      baseline,
      statuses,
    },
  };
}
