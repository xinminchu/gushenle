import { markUserDataDirty } from './userSync';
// 交易账户：券商 + 投入本金 + 累计已实现盈亏，持久化在 localStorage。
// 现金 = 投入本金 − 持仓总成本 + 累计已实现盈亏 + 非交易现金项合计（只随买卖与现金项变，不随涨跌变）；
// 总资产 = 现金 + 持仓总市值（浮动，股票涨了可以超过投入本金）；
// 总盈亏 = 总资产 − 投入本金。
// 单账户先行；以后要多账户，把 AccountInfo 改成数组即可，key 换版本。

/** 非交易现金项类别：保证金利息 / 分红 / 规费 / 其他 */
export type CashAdjustmentKind = 'interest' | 'dividend' | 'fee' | 'other';

/**
 * 非交易现金项：不来自买卖、但真实进出账户现金的钱（保证金利息、分红、卖出规费等）。
 * amount 带符号：支出为负（如利息 -10.12），收入为正（如分红 +0.50）。
 * 已实现盈亏只记交易，这类钱单独记账，现金才能与券商对到分，又不污染交易盈亏。
 */
export interface CashAdjustment {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  kind: CashAdjustmentKind;
  amount: number;
  note?: string;
}

export interface AccountInfo {
  /** 券商，如 Charles Schwab */
  brokerage: string;
  /** 投入本金（初始投入金额），美元；追加资金就改大这个数 */
  capital: number;
  /** 累计已实现盈亏总额（美元）：卖出经操作同步时自动累加，撤销时扣回 */
  realized?: number;
  /** 每只股票累计已实现盈亏（大写 symbol → 美元），与 realized 同步更新，供明细展开用 */
  realizedBySymbol?: Record<string, number>;
  /** 非交易现金项（利息/分红/规费等），合计计入现金 */
  adjustments?: CashAdjustment[];
  /** 最后更新 YYYY-MM-DD */
  updatedAt: string;
}

const ADJUSTMENT_KINDS: CashAdjustmentKind[] = ['interest', 'dividend', 'fee', 'other'];

function parseAdjustments(raw: unknown): CashAdjustment[] {
  if (!Array.isArray(raw)) return [];
  const out: CashAdjustment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as { id?: unknown; date?: unknown; kind?: unknown; amount?: unknown; note?: unknown };
    const amount = Number(o.amount);
    if (typeof o.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.date)) continue;
    if (!ADJUSTMENT_KINDS.includes(o.kind as CashAdjustmentKind)) continue;
    if (!Number.isFinite(amount) || amount === 0) continue;
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id : `${o.date}-${out.length}`,
      date: o.date,
      kind: o.kind as CashAdjustmentKind,
      amount: Math.round(amount * 100) / 100,
      ...(typeof o.note === 'string' && o.note.trim() ? { note: o.note.trim().slice(0, 80) } : {}),
    });
  }
  return out;
}

/** 非交易现金项合计（美元，到分）；没账户或没现金项为 0 */
export function adjustmentsTotal(a: AccountInfo | null): number {
  if (!a?.adjustments?.length) return 0;
  return Math.round(a.adjustments.reduce((s, x) => s + x.amount, 0) * 100) / 100;
}

const STORAGE_KEY = 'gushenle:account:v1';

export function loadAccount(): AccountInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    const o = p as { brokerage?: unknown; capital?: unknown; realized?: unknown; realizedBySymbol?: unknown; adjustments?: unknown; updatedAt?: unknown };
    const capital = Number(o.capital);
    if (typeof o.brokerage !== 'string' || !Number.isFinite(capital) || capital <= 0) return null;
    const realized = Number(o.realized);
    const bySymbol: Record<string, number> = {};
    if (o.realizedBySymbol && typeof o.realizedBySymbol === 'object') {
      for (const [k, v] of Object.entries(o.realizedBySymbol as Record<string, unknown>)) {
        const n = Number(v);
        if (k && Number.isFinite(n)) bySymbol[k.toUpperCase()] = Math.round(n * 100) / 100;
      }
    }
    const adjustments = parseAdjustments(o.adjustments);
    const updatedAt =
      typeof o.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.updatedAt)
        ? o.updatedAt
        : new Date().toISOString().slice(0, 10);
    return {
      brokerage: o.brokerage.trim(),
      capital,
      ...(Number.isFinite(realized) ? { realized: Math.round(realized * 100) / 100 } : {}),
      ...(Object.keys(bySymbol).length ? { realizedBySymbol: bySymbol } : {}),
      ...(adjustments.length ? { adjustments } : {}),
      updatedAt,
    };
  } catch {
    return null;
  }
}

export function saveAccount(info: AccountInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    markUserDataDirty();
  } catch {
    // ignore
  }
}

export function clearAccount(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 累加某只股票的已实现盈亏（卖出时调用，delta 可正可负；没设账户时静默跳过） */
export function addRealized(symbol: string, delta: number): void {
  if (!Number.isFinite(delta) || delta === 0) return;
  const a = loadAccount();
  if (!a) return;
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const sym = symbol.toUpperCase();
  const bySymbol = { ...(a.realizedBySymbol ?? {}) };
  bySymbol[sym] = r2((bySymbol[sym] ?? 0) + delta);
  const total = r2((a.realized ?? 0) + delta);
  saveAccount({ ...a, realized: total, realizedBySymbol: bySymbol, updatedAt: todayStr() });
}

/** 新增一条非交易现金项；返回更新后的账户（没设账户返回 null） */
export function addCashAdjustment(adj: Omit<CashAdjustment, 'id'>): AccountInfo | null {
  const a = loadAccount();
  if (!a) return null;
  const rec: CashAdjustment = {
    ...adj,
    amount: Math.round(adj.amount * 100) / 100,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const next: AccountInfo = {
    ...a,
    adjustments: [...(a.adjustments ?? []), rec],
    updatedAt: todayStr(),
  };
  saveAccount(next);
  return next;
}

/** 删除一条非交易现金项；返回更新后的账户（没设账户返回 null） */
export function removeCashAdjustment(id: string): AccountInfo | null {
  const a = loadAccount();
  if (!a) return null;
  const next: AccountInfo = {
    ...a,
    adjustments: (a.adjustments ?? []).filter((x) => x.id !== id),
    updatedAt: todayStr(),
  };
  saveAccount(next);
  return next;
}

/** 今天 YYYY-MM-DD（本地） */
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
