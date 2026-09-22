// 持仓记录：用户手动录入（代码 / 股数 / 成本价 / 建仓日期），持久化在 localStorage。
// 行情（现价 / 涨跌）走全 app 共享的 market 缓存，与今日页同源。
// 操作记忆（买入/卖出）可同步到这里：买入加权平均成本，卖出扣减股数。

export interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
  /** 首次建仓日期 YYYY-MM-DD（老数据可能没有） */
  since?: string;
}

const STORAGE_KEY = 'gushenle:positions:v1';

export function loadPositions(): Position[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (
      parsed as Array<{ symbol?: unknown; shares?: unknown; avgCost?: unknown; since?: unknown }>
    )
      .filter(
        (p) =>
          p &&
          typeof p.symbol === 'string' &&
          Number.isFinite(Number(p.shares)) &&
          Number(p.shares) > 0 &&
          Number.isFinite(Number(p.avgCost)) &&
          Number(p.avgCost) >= 0,
      )
      .map((p) => ({
        symbol: String(p.symbol).trim().toUpperCase(),
        shares: Number(p.shares),
        avgCost: Number(p.avgCost),
        since:
          typeof p.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.since) ? p.since : undefined,
      }));
  } catch {
    return [];
  }
}

export function savePositions(positions: Position[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // ignore
  }
}

/** 持有天数（自然日）；没有建仓日期返回 null */
export function holdingDays(since: string | undefined, today = new Date()): number | null {
  if (!since) return null;
  const d = new Date(since + 'T12:00:00');
  if (isNaN(d.getTime())) return null;
  const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
  return diff >= 0 ? diff : 0;
}

/* ---------------- 板块 ---------------- */

const SECTOR_MAP: Record<string, string> = {
  AAPL: '科技',
  MSFT: '科技',
  NVDA: '科技',
  GOOGL: '科技',
  META: '科技',
  AMZN: '科技消费',
  AMD: '科技',
  NFLX: '科技消费',
  TSLA: '汽车科技',
  COIN: '加密概念',
  MSTR: '加密概念',
  // 用户自选扩充时可继续加
};

export function sectorOf(symbol: string): string {
  return SECTOR_MAP[symbol.toUpperCase()] ?? '未分类';
}

/* ---------------- 操作记忆 -> 持仓同步 ---------------- */

export interface SyncInput {
  symbol: string;
  action: 'buy' | 'sell';
  price: number;
  qty: number;
  date: string; // 操作日 YYYY-MM-DD
}

/**
 * 把一条操作记录同步进持仓。
 * 买入：加权平均成本；卖出：扣减股数，清零则移除。
 * 返回 { ok, msg }，msg 为大白话结果。
 */
export function applyOperationToPositions(input: SyncInput): { ok: boolean; msg: string } {
  const positions = loadPositions();
  const sym = input.symbol.toUpperCase();
  const idx = positions.findIndex((p) => p.symbol === sym);

  if (input.action === 'buy') {
    if (idx >= 0) {
      const p = positions[idx];
      const newShares = p.shares + input.qty;
      const newCost = (p.shares * p.avgCost + input.qty * input.price) / newShares;
      positions[idx] = { ...p, shares: newShares, avgCost: Math.round(newCost * 100) / 100 };
      savePositions(positions);
      return { ok: true, msg: `${sym} 加仓 ${input.qty} 股，现 ${newShares} 股，成本 $${positions[idx].avgCost.toFixed(2)}` };
    }
    positions.push({ symbol: sym, shares: input.qty, avgCost: input.price, since: input.date });
    savePositions(positions);
    return { ok: true, msg: `${sym} 新建仓 ${input.qty} 股 @ $${input.price.toFixed(2)}` };
  }

  // sell
  if (idx < 0) return { ok: false, msg: `${sym} 不在持仓里，没法减` };
  const p = positions[idx];
  if (input.qty > p.shares) {
    return { ok: false, msg: `卖出 ${input.qty} 股超出持仓（仅 ${p.shares} 股）` };
  }
  const left = p.shares - input.qty;
  if (left <= 0) {
    positions.splice(idx, 1);
    savePositions(positions);
    return { ok: true, msg: `${sym} 已清仓，从持仓移除` };
  }
  positions[idx] = { ...p, shares: left };
  savePositions(positions);
  return { ok: true, msg: `${sym} 减仓 ${input.qty} 股，还剩 ${left} 股` };
}
