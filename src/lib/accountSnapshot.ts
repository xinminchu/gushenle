// src/lib/accountSnapshot.ts
// 账户真相：券商余额快照（Account Summary / Balances 截图导入）。
// 背景：2026-11-19 晚 Sam 的 Schwab 保证金账户（尾号 7455）触发维持保证金 call，
// 券商真相是现金 $0.00、借款 −$2,191.64、净值 $2,603.06、维持要求 $2,605.77，
// 而股神乐账面现金还记着 +$374.22——账实脱节，股神乐没能提前提醒。
// 快照只陈述券商数字，不给任何买卖建议（宪章红线）。
// 存储：localStorage，与持仓/账户同一套本机优先口径；纯函数可单测。

export interface AccountSnapshot {
  id: string;
  /** 快照日 YYYY-MM-DD（截图上注明的 as-of 日期；没有则导入当天） */
  date: string;
  broker: string;
  /** 保证金余额：负数 = 向券商借款（2026-11-19：−2,191.64） */
  marginBalance: number | null;
  /** Cash & Sweep Vehicle */
  cashSweep: number | null;
  /** Cash Balance */
  cashBalance: number | null;
  /** Long Stock Value 持仓市值 */
  longStockValue: number | null;
  /** Margin Equity 净值 */
  marginEquity: number | null;
  /** Maintenance Requirement 维持要求 */
  maintenanceRequirement: number | null;
  /** Available Funds For Trading */
  availableFunds: number | null;
  source: 'screenshot';
  createdAt: number;
}

/** 缓冲薄的阈值（2026-11-20 定，写死在代码里）：剩余 < $200，或 < 净值 10% */
export const THIN_BUFFER_USD = 200;
export const THIN_BUFFER_PCT = 0.1;

const STORAGE_KEY = 'gushenle:account-snapshots:v1';
const MAX_KEEP = 50;

export const SNAPSHOT_CHANGED_EVENT = 'gushenle:snapshot-changed';

/** $1,234.56 / -$2,191.64 */
export function fmtUsd(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * 金额解析：接受数字或字符串。
 * "$2,191.64"、"-$2,191.64"、"($2,191.64)"（会计负数括号）都算数；
 * "--"、"N/A"、空串算缺失（null），不算 0——0 和"没看到"是两回事。
 */
export function parseMoney(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? round2(v) : null;
  if (typeof v !== 'string') return null;
  let s = v.trim();
  if (!s || s === '--' || s === '—' || s.toLowerCase() === 'n/a') return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) {
    neg = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,\s]/g, '');
  if (s.startsWith('-')) {
    neg = true;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return round2(neg ? -n : n);
}

function validDate(d: unknown): string | null {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return Number.isNaN(Date.parse(d)) ? null : d;
}

/**
 * 清洗 Gemini 返回的快照 JSON。字段缺失留 null，不猜数。
 * 至少要有 2 个金额字段，否则算"没认出余额页"，返回 null。
 */
export function sanitizeSnapshot(raw: unknown): Omit<
  AccountSnapshot,
  'id' | 'createdAt' | 'source'
> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const date = validDate(o.date);
  const snap = {
    date: date ?? '',
    broker: typeof o.broker === 'string' && o.broker.trim() ? o.broker.trim().slice(0, 40) : 'Schwab',
    marginBalance: parseMoney(o.marginBalance),
    cashSweep: parseMoney(o.cashSweep),
    cashBalance: parseMoney(o.cashBalance),
    longStockValue: parseMoney(o.longStockValue),
    marginEquity: parseMoney(o.marginEquity),
    maintenanceRequirement: parseMoney(o.maintenanceRequirement),
    availableFunds: parseMoney(o.availableFunds),
  };
  const filled = [
    snap.marginBalance,
    snap.cashSweep,
    snap.cashBalance,
    snap.longStockValue,
    snap.marginEquity,
    snap.maintenanceRequirement,
    snap.availableFunds,
  ].filter((v) => v != null).length;
  if (filled < 2) return null;
  return snap;
}

/** 净值 − 维持要求：正数是剩余缓冲，负数是已低于维持要求（call 的金额） */
export function marginBuffer(s: Pick<AccountSnapshot, 'marginEquity' | 'maintenanceRequirement'>): number | null {
  if (s.marginEquity == null || s.maintenanceRequirement == null) return null;
  return round2(s.marginEquity - s.maintenanceRequirement);
}

/** 向券商借了多少钱（marginBalance 为负时取绝对值，否则 0） */
export function borrowedAmount(s: Pick<AccountSnapshot, 'marginBalance'>): number {
  return s.marginBalance != null && s.marginBalance < 0 ? round2(-s.marginBalance) : 0;
}

/**
 * 缓冲是否薄：剩余 < $200，或 < 净值 10%。
 * 负缓冲（已低于维持要求）自然算薄。
 */
export function isThinBuffer(s: AccountSnapshot): boolean {
  const b = marginBuffer(s);
  if (b == null) return false;
  if (b < THIN_BUFFER_USD) return true;
  if (s.marginEquity != null && s.marginEquity > 0 && b < s.marginEquity * THIN_BUFFER_PCT) return true;
  return false;
}

/* ---------------- 存储（localStorage，本机优先） ---------------- */

export function loadSnapshots(): AccountSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as AccountSnapshot[])
      .filter((s) => s && typeof s.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

export function latestSnapshot(): AccountSnapshot | null {
  const list = loadSnapshots();
  return list.length > 0 ? list[0] : null;
}

export function saveSnapshot(
  input: Omit<AccountSnapshot, 'id' | 'createdAt' | 'source'>,
): AccountSnapshot {
  const rec: AccountSnapshot = {
    ...input,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'screenshot',
    createdAt: Date.now(),
  };
  if (typeof window !== 'undefined') {
    try {
      const list = loadSnapshots();
      list.unshift(rec);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_KEEP)));
      window.dispatchEvent(new Event(SNAPSHOT_CHANGED_EVENT));
    } catch {
      // ignore
    }
  }
  return rec;
}

export function deleteSnapshot(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const list = loadSnapshots().filter((s) => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(SNAPSHOT_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

/* ---------------- 账实核对：股神乐账面 vs 券商快照 ---------------- */

export interface ReconLine {
  kind: 'cash' | 'margin' | 'holdings' | 'ok';
  zh: string;
  en: string;
  /** true = 差额已标出，需要人看一眼；false = 只是陈述事实 */
  flagged: boolean;
}

export interface ReconResult {
  lines: ReconLine[];
  hasDiff: boolean;
  noSnapshot: boolean;
}

/**
 * 导入交易后调用：把最新快照与账面现金、持仓市值比对，不一致就标出差额，绝不静默通过。
 * - 现金：账面现金 − 快照现金，差 ≥ $0.01 即标出。
 * - 借款：快照显示借款、而账面现金还是正数（11-19 的原案：账面 +374.22，券商 −2,191.64），标出。
 * - 持仓市值：需传现价算出的账面市值（持仓页有行情；截图导入时没有，传 null 即跳过），
 *   市值随行情变，差 > $1 才标出。
 */
export function reconcileBookVsSnapshot(input: {
  bookCash: number | null;
  /** 账面持仓市值（现价 × 股数）；没有行情时传 null 跳过 */
  bookLongValue: number | null;
  snapshot: AccountSnapshot | null;
}): ReconResult {
  const { bookCash, bookLongValue, snapshot } = input;
  if (!snapshot) return { lines: [], hasDiff: false, noSnapshot: true };
  const lines: ReconLine[] = [];

  if (bookCash != null && snapshot.cashBalance != null) {
    const diff = round2(bookCash - snapshot.cashBalance);
    if (Math.abs(diff) >= 0.01) {
      lines.push({
        kind: 'cash',
        zh: `账面现金 ${fmtUsd(bookCash)} vs 快照现金 ${fmtUsd(snapshot.cashBalance)}，差 ${fmtUsd(diff)}`,
        en: `Book cash ${fmtUsd(bookCash)} vs snapshot cash ${fmtUsd(snapshot.cashBalance)}, diff ${fmtUsd(diff)}`,
        flagged: true,
      });
    }
  }

  const borrowed = borrowedAmount(snapshot);
  if (borrowed > 0) {
    const bookUnaware = bookCash != null && bookCash >= 0;
    lines.push({
      kind: 'margin',
      zh: `券商快照显示借款 ${fmtUsd(borrowed)}${bookUnaware ? '，账面现金为正，未体现这笔借款' : ''}`,
      en: `Broker snapshot shows borrowing ${fmtUsd(borrowed)}${bookUnaware ? ', book cash is positive and does not reflect this loan' : ''}`,
      flagged: bookUnaware,
    });
  }

  if (bookLongValue != null && snapshot.longStockValue != null) {
    const diff = round2(bookLongValue - snapshot.longStockValue);
    if (Math.abs(diff) > 1) {
      lines.push({
        kind: 'holdings',
        zh: `持仓市值（现价）${fmtUsd(bookLongValue)} vs 快照持仓 ${fmtUsd(snapshot.longStockValue)}，差 ${fmtUsd(diff)}`,
        en: `Holdings value (live) ${fmtUsd(bookLongValue)} vs snapshot holdings ${fmtUsd(snapshot.longStockValue)}, diff ${fmtUsd(diff)}`,
        flagged: true,
      });
    }
  }

  const hasDiff = lines.some((l) => l.flagged);
  if (!hasDiff) {
    lines.push({
      kind: 'ok',
      zh: '账面与最新快照一致',
      en: 'Books match the latest snapshot',
      flagged: false,
    });
  }
  return { lines, hasDiff, noSnapshot: false };
}
