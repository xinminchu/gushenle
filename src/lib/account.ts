import { markUserDataDirty } from './userSync';
// 交易账户：券商 + 账户总资金（投入金额），持久化在 localStorage。
// 仓位占比 = 持仓市值 / 账户总资金；现金 = 总资金 − 持仓总市值。
// 单账户先行；以后要多账户，把 AccountInfo 改成数组即可，key 换版本。

export interface AccountInfo {
  /** 券商，如 Charles Schwab */
  brokerage: string;
  /** 账户总资金（投入金额），美元 */
  capital: number;
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
    const o = p as { brokerage?: unknown; capital?: unknown; updatedAt?: unknown };
    const capital = Number(o.capital);
    if (typeof o.brokerage !== 'string' || !Number.isFinite(capital) || capital <= 0) return null;
    const updatedAt =
      typeof o.updatedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.updatedAt)
        ? o.updatedAt
        : new Date().toISOString().slice(0, 10);
    return { brokerage: o.brokerage.trim(), capital, updatedAt };
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

/** 今天 YYYY-MM-DD（本地） */
export function todayStr(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
