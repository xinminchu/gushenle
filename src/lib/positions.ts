// 持仓记录：用户手动录入（代码 / 股数 / 成本价），持久化在 localStorage。
// 行情（现价 / 涨跌）走全 app 共享的 market 缓存，与今日页同源。

export interface Position {
  symbol: string;
  shares: number;
  avgCost: number;
}

const STORAGE_KEY = 'gushenle:positions:v1';

export function loadPositions(): Position[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Array<{ symbol?: unknown; shares?: unknown; avgCost?: unknown }>)
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
