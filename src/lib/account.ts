import { markUserDataDirty } from './userSync';
// 交易账户：券商 + 投入本金 + 累计已实现盈亏，持久化在 localStorage。
// 现金 = 投入本金 − 持仓总成本 + 累计已实现盈亏（只随买卖变，不随涨跌变）；
// 总资产 = 现金 + 持仓总市值（浮动，股票涨了可以超过投入本金）；
// 总盈亏 = 总资产 − 投入本金。
// 单账户先行；以后要多账户，把 AccountInfo 改成数组即可，key 换版本。

export interface AccountInfo {
  /** 券商，如 Charles Schwab */
  brokerage: string;
  /** 投入本金（初始投入金额），美元；追加资金就改大这个数 */
  capital: number;
  /** 累计已实现盈亏（美元）：卖出经操作同步时自动累加，撤销时扣回 */
  realized?: number;
  /** 最后更新 YYYY-MM-DD */
  updatedAt: string;
}

const STORAGE_KEY = 'gushenle:account:v1';

export function loadAccount(): AccountInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as unknown;
    if (!p || typeof p !== 'object') return null;
    const o = p as { brokerage?: unknown; capital?: unknown; realized?: unknown; updatedAt?: unknown };
    const capital = Number(o.capital);
    if (typeof o.brokerage !== 'string' || !Number.isFinite(capital) || capital <= 0) return null;
    const realized = Number(o.realized);
    const updatedAt =
      typeof o.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.updatedAt)
        ? o.updatedAt
        : new Date().toISOString().slice(0, 10);
    return {
      brokerage: o.brokerage.trim(),
      capital,
      ...(Number.isFinite(realized) ? { realized: Math.round(realized * 100) / 100 } : {}),
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

/** 累加已实现盈亏（卖出时调用，delta 可正可负；没设账户时静默跳过） */
export function addRealized(delta: number): void {
  if (!Number.isFinite(delta) || delta === 0) return;
  const a = loadAccount();
  if (!a) return;
  const next = Math.round(((a.realized ?? 0) + delta) * 100) / 100;
  saveAccount({ ...a, realized: next, updatedAt: todayStr() });
}

/** 今天 YYYY-MM-DD（本地） */
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
