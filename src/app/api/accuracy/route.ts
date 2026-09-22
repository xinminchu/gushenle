// src/app/api/accuracy/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  scoreAt,
  judgeFromScore,
  volatilityAt,
  thresholdsFor,
  STATUS_LABELS,
  type RhythmThresholds,
  type VolTier,
  type SignalStatusKey,
} from '@/lib/rhythm';
import { getFullSeries } from '@/lib/marketData';

/**
 * 判断复盘 v2：无未来函数回测 + 口径修正。
 *
 * 对过去每一天 T：只用 T 及之前的数据算综合分、trailing 波动率与"当时"的阈值档位
 * （与线上主判断同一算法，严禁未来函数）；四种明确状态各记一次"信号"，
 * 用 T+1 日的真实涨跌验证命中。
 *
 * 四状态与命中规则（与建议语义匹配）：
 * - 涨太猛了（建议"先冷静一下"，别追语义）：次日涨幅 < +0.5% 算命中
 * - 高位稳着涨（建议"先别急着加仓"，同属别追语义）：次日涨幅 < +0.5% 算命中
 * - 还在往下跌（建议"先别急着抄底"=别接飞刀）：次日涨幅 < +0.5% 算命中
 *   （反向规则：继续跌反而证明"别抄底"说中了）
 * - 跌过头了（建议"可以分批留意"，赌反弹）：次日涨幅 > -0.5% 算命中
 * 中间分数（涨势加速 / 横盘波动 / 跌不动了）不记信号。
 *
 * 基线：全部样本日中次日涨幅 < +0.5% 的占比（别追类基线）与 > -0.5% 的占比
 * （反弹类基线），用来衡量信号相对"无脑判断"的真实 edge。
 */

/** 有明确信号的四种状态 key（与 lib/rhythm 的 SignalStatusKey 同源） */
const SIGNAL_KEYS: readonly SignalStatusKey[] = [
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

export interface Signal {
  date: string;
  score: number;
  status: string;
  statusKey: SignalStatusKey;
  tier: VolTier;
  nextReturn: number;
  hit: boolean;
}

export interface StatusStat {
  label: string;
  total: number;
  accuracy: number | null;
  /** 对照基线：别追类用 chase，反弹类用 bounce */
  baseline: number | null;
  /** 超出基线的百分点（accuracy - baseline），为 null 时无意义 */
  edge: number | null;
}

const accCache = new Map<string, { data: unknown; expires: number }>();

const pct1 = (v: number) => Math.round(v * 1000) / 10;

export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get('symbol') || 'AAPL').toUpperCase();

  const hit = accCache.get(symbol);
  if (hit && hit.expires > Date.now()) return NextResponse.json(hit.data);

  const { series, source } = await getFullSeries(symbol);
  if (source === 'simulated') {
    return NextResponse.json({
      symbol,
      available: false,
      reason: '当前为演示数据，不参与复盘。',
    });
  }

  const closes = series.map((p) => p.close);
  const dates = series.map((p) => p.date);
  const signals: Signal[] = [];

  // 复盘最近约 1 年的信号（每天需 ≥67 天历史：66 天锚定 + 波动率窗口）
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
    // judgeFromScore 直接返回 statusKey，不再按中文字符串匹配
    const key: SignalStatusKey | null = (SIGNAL_KEYS as readonly string[]).includes(
      j.statusKey,
    )
      ? (j.statusKey as SignalStatusKey)
      : null;
    const nextReturn = ((closes[t + 1] - closes[t]) / closes[t]) * 100;

    sampleDays++;
    if (nextReturn < 0.5) chaseDays++;
    if (nextReturn > -0.5) bounceDays++;
    if (!key) continue; // 中间分数不记信号

    const ok =
      STATUS_META[key].baseline === 'chase' ? nextReturn < 0.5 : nextReturn > -0.5;
    signals.push({
      date: dates[t],
      score: s.score,
      status: STATUS_LABELS[key],
      statusKey: key,
      tier: th.tier,
      nextReturn: Math.round(nextReturn * 100) / 100,
      hit: ok,
    });
  }

  const rate = (total: number, hits: number): number | null =>
    total ? pct1(hits / total) : null;

  const baseline = {
    chase: sampleDays ? pct1(chaseDays / sampleDays) : null,
    bounce: sampleDays ? pct1(bounceDays / sampleDays) : null,
  };

  const statuses = {} as Record<SignalStatusKey, StatusStat>;
  (Object.keys(STATUS_META) as SignalStatusKey[]).forEach((key) => {
    const list = signals.filter((s) => s.statusKey === key);
    const accuracy = rate(list.length, list.filter((s) => s.hit).length);
    const bl = baseline[STATUS_META[key].baseline];
    statuses[key] = {
      label: STATUS_LABELS[key],
      total: list.length,
      accuracy,
      baseline: bl,
      edge: accuracy != null && bl != null ? Math.round((accuracy - bl) * 10) / 10 : null,
    };
  });

  const data = {
    symbol,
    available: true,
    stats: {
      total: signals.length,
      accuracy: rate(signals.length, signals.filter((s) => s.hit).length),
      sampleDays,
      baseline,
      statuses,
    },
    recent: [...signals].slice(-8).reverse(),
    rule: '四状态分别验证：涨太猛了/高位稳着涨/还在往下跌（别追、别抄底语义）次日涨幅<+0.5%算命中；跌过头了（赌反弹语义）次日涨幅>-0.5%算命中；中间分数不记信号。基线为同期全部交易日的天然命中率。',
    computedAt: new Date().toISOString(),
  };
  accCache.set(symbol, { data, expires: Date.now() + 3_600_000 });
  return NextResponse.json(data);
}
