import { markUserDataDirty } from './userSync';
import { saveOperation, deleteOperation, type OperationRecord } from './operations';
import { addRealized } from './account';
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
    markUserDataDirty();
  } catch {
    // ignore
  }
}

/* ---------------- 持有天数 ---------------- */

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

/* ---------------- 同步去重：同一条操作记录短时间内重复"同步到持仓"要拦一下 ---------------- */

const SYNC_LOG_KEY = 'gushenle_sync_log_v1';
export const SYNC_DUP_WINDOW_MS = 15 * 60 * 1000;

function loadSyncLog(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(SYNC_LOG_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

/** 这条操作记录上次同步到持仓的时间戳，没有返回 null */
export function lastSyncAt(opId: string): number | null {
  const t = loadSyncLog()[opId];
  return typeof t === 'number' && t > 0 ? t : null;
}

/** 记一笔"同步到持仓"的时间（只保留最近 200 条，防 localStorage 膨胀） */
export function markSynced(opId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const log = loadSyncLog();
    log[opId] = Date.now();
    const keys = Object.keys(log).sort((a, b) => log[b] - log[a]).slice(0, 200);
    const trimmed: Record<string, number> = {};
    keys.forEach((k) => {
      trimmed[k] = log[k];
    });
    localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
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
  // 已实现盈亏落袋：(卖出价 − 成本) × 股数，按股票记入账户；否则卖出后这部分钱会从账上"消失"
  addRealized(sym, (input.price - p.avgCost) * input.qty);
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

/* ---------------- 记一笔 -> 自动同步持仓 ---------------- */

export interface SaveAndSyncResult {
  rec: OperationRecord;
  /** null = 没填股数，没做自动同步（界面保留手动"同步到持仓"按钮） */
  syncMsg: string | null;
  syncOk: boolean;
  /**
   * 同步前该标的的持仓快照（撤销用）：
   * - undefined = 没做同步（没填股数），撤销时不用动持仓
   * - null = 同步前无持仓，撤销时删掉同步建出来的那条
   * - Position = 恢复这份快照（加权成本精确还原）
   */
  prevPosition?: Position | null;
}

/**
 * 存一条操作记录，并尝试自动同步到持仓（省掉手动点"同步到持仓"）。
 * - 没填股数：只存记录，不自动同步（syncMsg=null），手动按钮仍在
 * - 同步失败（如卖出超出持仓）：记录已存，返回错误信息，手动按钮可补救
 * - 同步成功：记 markSynced，界面显示"✓ 已同步"，防重复
 */
export function saveOperationAndSync(
  input: Omit<OperationRecord, 'id' | 'createdAt'>,
): SaveAndSyncResult {
  const rec = saveOperation(input);
  const qty = rec.qty && rec.qty > 0 ? rec.qty : undefined;
  if (!qty) return { rec, syncMsg: null, syncOk: false, prevPosition: undefined };
  // 同步前先给这只的持仓拍快照：撤销时精确恢复（加权成本不会算乱）
  const sym = rec.symbol.toUpperCase();
  const prev = loadPositions().find((p) => p.symbol.toUpperCase() === sym);
  const prevPosition: Position | null = prev ? { ...prev } : null;
  const r = applyOperationToPositions({
    symbol: rec.symbol,
    action: rec.action,
    price: rec.price,
    qty,
    date: rec.date,
  });
  if (r.ok) markSynced(rec.id);
  return { rec, syncMsg: r.msg, syncOk: r.ok, prevPosition };
}

/**
 * 撤销一次 saveOperationAndSync：删掉那条操作记录，持仓按快照精确恢复。
 * 给"语音免确认自动记入"的 8 秒撤销用。
 */
export function undoSaveAndSync(res: SaveAndSyncResult): void {
  deleteOperation(res.rec.id);
  if (res.prevPosition === undefined || !res.syncOk) return; // 没同步或同步失败，不动持仓和账户
  // 撤销的是卖出：把当时记入的已实现盈亏扣回去（按卖出时的成本快照精确反算）
  if (res.rec.action === 'sell' && res.prevPosition) {
    const qty = res.rec.qty && res.rec.qty > 0 ? res.rec.qty : 0;
    if (qty > 0) addRealized(res.rec.symbol, -(res.rec.price - res.prevPosition.avgCost) * qty);
  }
  const sym = res.rec.symbol.toUpperCase();
  const positions = loadPositions();
  const idx = positions.findIndex((p) => p.symbol.toUpperCase() === sym);
  if (res.prevPosition === null) {
    // 同步前无持仓：删掉同步建出来的那条
    if (idx >= 0) positions.splice(idx, 1);
  } else if (idx >= 0) {
    positions[idx] = res.prevPosition;
  } else {
    positions.push(res.prevPosition);
  }
  savePositions(positions);
}

