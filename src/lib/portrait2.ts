// src/lib/portrait2.ts
// 画像提炼层（v2）：在操作记录之上做 FIFO 配对与归因，把流水账提炼成事实。
// 全部本地计算，只陈述事实：盈亏归因 / 耐心指纹 / 仓位手感 / 追涨杀跌痕迹 / 指纹六维。
// 口径纪律：样本不足的量返回 null（养成中），不硬凑；不贴人格标签、不给建议。

import type { OperationRecord } from './operations';

export interface ReviewExt {
  r5: number | null;
  r20: number | null;
  b3?: number | null; // 操作日前 3 个交易日涨跌幅（%）
}

export interface ClosedPair {
  symbol: string;
  buyDate: string;
  sellDate: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  pnl: number; // 已实现盈亏（美元）
  pnlPct: number; // 相对买入成本的收益率（%）
  holdDays: number; // 日历天
}

interface Lot {
  date: string;
  price: number;
  qty: number;
}

const dayMs = 86400000;
function daysBetween(a: string, b: string): number {
  const ta = Date.parse(`${a}T12:00:00`);
  const tb = Date.parse(`${b}T12:00:00`);
  if (!isFinite(ta) || !isFinite(tb)) return 0;
  return Math.max(0, Math.round((tb - ta) / dayMs));
}

/** FIFO 配对：按日期升序回放，卖出消耗最早的买入批次。配不上的卖出（记录前持仓）跳过。 */
export function pairTrades(ops: OperationRecord[]): ClosedPair[] {
  const sorted = [...ops].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt,
  );
  const lots = new Map<string, Lot[]>();
  const pairs: ClosedPair[] = [];
  for (const op of sorted) {
    if (!(op.price > 0)) continue;
    const qty = op.qty && op.qty > 0 ? op.qty : 1;
    if (op.action === 'buy') {
      const q = lots.get(op.symbol) ?? [];
      q.push({ date: op.date, price: op.price, qty });
      lots.set(op.symbol, q);
      continue;
    }
    // sell
    const q = lots.get(op.symbol) ?? [];
    let remaining = qty;
    while (remaining > 0 && q.length > 0) {
      const lot = q[0];
      const take = Math.min(lot.qty, remaining);
      pairs.push({
        symbol: op.symbol,
        buyDate: lot.date,
        sellDate: op.date,
        qty: take,
        buyPrice: lot.price,
        sellPrice: op.price,
        pnl: (op.price - lot.price) * take,
        pnlPct: lot.price > 0 ? ((op.price - lot.price) / lot.price) * 100 : 0,
        holdDays: daysBetween(lot.date, op.date),
      });
      lot.qty -= take;
      remaining -= take;
      if (lot.qty <= 0) q.shift();
    }
    lots.set(op.symbol, q);
  }
  return pairs;
}

export interface SymbolPnl {
  symbol: string;
  pnl: number;
  pairs: number;
  wins: number;
}

export interface PatienceBucket {
  id: 'fast' | 'mid' | 'slow';
  count: number;
  winRate: number | null;
  avgPnlPct: number | null;
}

export interface ChaseStat {
  total: number; // 有 b3 数据的笔数
  hit: number; // 追涨（买入前 3 日涨 ≥5%）/ 杀跌（卖出前 3 日跌 ≥5%）笔数
  share: number | null; // hit / total，样本 <3 为 null
  avgFwd: number | null; // 这类操作之后 20 日（不足用 5 日）平均涨跌 %
}

export interface Portrait2 {
  pairs: ClosedPair[];
  totalRealized: number;
  winRate: number | null; // 已平仓胜率，样本 <3 为 null
  bySymbol: SymbolPnl[]; // 按 pnl 降序
  patience: PatienceBucket[];
  medianHoldDays: number | null;
  bigTrade: { count: number; winRate: number | null } | null; // ≥2 倍中位单笔的重仓单
  smallTrade: { count: number; winRate: number | null } | null;
  concentration: number | null; // 成交额前 3 只占比 0..1
  chase: ChaseStat;
  panic: ChaseStat;
}

const MIN_N = 3;

function bucketOf(holdDays: number): PatienceBucket['id'] {
  if (holdDays < 7) return 'fast';
  if (holdDays <= 30) return 'mid';
  return 'slow';
}

function chaseStat(
  ops: OperationRecord[],
  reviews: Record<string, ReviewExt>,
  action: 'buy' | 'sell',
): ChaseStat {
  let total = 0;
  let hit = 0;
  const fwds: number[] = [];
  for (const op of ops) {
    if (op.action !== action) continue;
    const rv = reviews[op.id];
    if (!rv || rv.b3 == null) continue;
    total += 1;
    const isHit = action === 'buy' ? rv.b3 >= 5 : rv.b3 <= -5;
    if (isHit) {
      hit += 1;
      const f = rv.r20 ?? rv.r5;
      if (f != null) fwds.push(f);
    }
  }
  return {
    total,
    hit,
    share: total >= MIN_N ? hit / total : null,
    avgFwd: fwds.length > 0 ? fwds.reduce((a, b) => a + b, 0) / fwds.length : null,
  };
}

export function computePortrait2(
  ops: OperationRecord[],
  reviews: Record<string, ReviewExt>,
): Portrait2 {
  const pairs = pairTrades(ops);
  const totalRealized = pairs.reduce((a, p) => a + p.pnl, 0);
  const wins = pairs.filter((p) => p.pnl > 0).length;
  const winRate = pairs.length >= MIN_N ? wins / pairs.length : null;

  const symMap = new Map<string, SymbolPnl>();
  for (const p of pairs) {
    const s = symMap.get(p.symbol) ?? { symbol: p.symbol, pnl: 0, pairs: 0, wins: 0 };
    s.pnl += p.pnl;
    s.pairs += 1;
    if (p.pnl > 0) s.wins += 1;
    symMap.set(p.symbol, s);
  }
  const bySymbol = [...symMap.values()].sort((a, b) => b.pnl - a.pnl);

  const buckets: Record<PatienceBucket['id'], ClosedPair[]> = { fast: [], mid: [], slow: [] };
  for (const p of pairs) buckets[bucketOf(p.holdDays)].push(p);
  const patience = (['fast', 'mid', 'slow'] as const).map((id) => {
    const arr = buckets[id];
    return {
      id,
      count: arr.length,
      winRate: arr.length >= MIN_N ? arr.filter((p) => p.pnl > 0).length / arr.length : null,
      avgPnlPct:
        arr.length > 0 ? arr.reduce((a, p) => a + p.pnlPct, 0) / arr.length : null,
    };
  });

  const holds = pairs.map((p) => p.holdDays).sort((a, b) => a - b);
  const medianHoldDays =
    holds.length === 0
      ? null
      : holds.length % 2 === 1
        ? holds[Math.floor(holds.length / 2)]
        : Math.round((holds[holds.length / 2 - 1] + holds[holds.length / 2]) / 2);

  // 仓位手感：单笔买入金额 vs 全部买入中位数
  const buyAmounts = ops
    .filter((o) => o.action === 'buy' && o.price > 0)
    .map((o) => o.price * (o.qty && o.qty > 0 ? o.qty : 1))
    .sort((a, b) => a - b);
  let bigTrade: Portrait2['bigTrade'] = null;
  let smallTrade: Portrait2['smallTrade'] = null;
  if (buyAmounts.length > 0 && pairs.length > 0) {
    const mid = Math.floor(buyAmounts.length / 2);
    const median =
      buyAmounts.length % 2 === 1
        ? buyAmounts[mid]
        : (buyAmounts[mid - 1] + buyAmounts[mid]) / 2;
    if (median > 0) {
      const big = pairs.filter((p) => p.buyPrice * p.qty >= 2 * median);
      const small = pairs.filter((p) => p.buyPrice * p.qty < 2 * median);
      bigTrade = {
        count: big.length,
        winRate: big.length >= MIN_N ? big.filter((p) => p.pnl > 0).length / big.length : null,
      };
      smallTrade = {
        count: small.length,
        winRate:
          small.length >= MIN_N ? small.filter((p) => p.pnl > 0).length / small.length : null,
      };
    }
  }

  // 集中度：全部操作成交额（买入+卖出）前 3 只占比
  const principal = new Map<string, number>();
  let totalPrincipal = 0;
  for (const o of ops) {
    if (!(o.price > 0)) continue;
    const amt = o.price * (o.qty && o.qty > 0 ? o.qty : 1);
    principal.set(o.symbol, (principal.get(o.symbol) ?? 0) + amt);
    totalPrincipal += amt;
  }
  const top3 = [...principal.values()].sort((a, b) => b - a).slice(0, 3);
  const concentration =
    totalPrincipal > 0 && principal.size >= 3
      ? top3.reduce((a, b) => a + b, 0) / totalPrincipal
      : null;

  return {
    pairs,
    totalRealized,
    winRate,
    bySymbol,
    patience,
    medianHoldDays,
    bigTrade,
    smallTrade,
    concentration,
    chase: chaseStat(ops, reviews, 'buy'),
    panic: chaseStat(ops, reviews, 'sell'),
  };
}

/** 指纹六维（0–100 的展示值；null = 样本不足养成中）。顺序固定，雷达图按此序绘制。 */
export interface FingerprintAxis {
  id: 'sellFly' | 'buyHigh' | 'patience' | 'winRate' | 'concentration' | 'chase';
  value: number | null;
  detail: string; // 人话明细（如「中位持有 12 天」），由展示层按语言生成时可用原始量另行组织
}

export function fingerprintAxes(p: Portrait2, sellRate: number | null, buyRate: number | null): FingerprintAxis[] {
  return [
    { id: 'sellFly', value: sellRate == null ? null : Math.round(sellRate * 100), detail: '' },
    { id: 'buyHigh', value: buyRate == null ? null : Math.round(buyRate * 100), detail: '' },
    {
      id: 'patience',
      value: p.medianHoldDays == null ? null : Math.min(100, Math.round((p.medianHoldDays / 60) * 100)),
      detail: '',
    },
    { id: 'winRate', value: p.winRate == null ? null : Math.round(p.winRate * 100), detail: '' },
    {
      id: 'concentration',
      value: p.concentration == null ? null : Math.round(p.concentration * 100),
      detail: '',
    },
    { id: 'chase', value: p.chase.share == null ? null : Math.round(p.chase.share * 100), detail: '' },
  ];
}
