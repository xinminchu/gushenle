// src/lib/rebuild.ts
// 全量重放对账：操作记录（流水）是真相，持仓与已实现盈亏按流水从旧到新重放重建。
// 用途：补录导入历史交易后，流水变全了，但持仓/已实现还是旧的部分同步结果——
// 重放一遍，两本账重新对齐。重放前先把当前持仓+账户快照存一份，可一键恢复。

import { loadOperations, saveOperation, type OpAction } from './operations';
import {
  loadPositions,
  savePositions,
  applyOperationToPositions,
  markSynced,
  type Position,
} from './positions';
import { loadAccount, saveAccount, clearAccount, type AccountInfo } from './account';

const BACKUP_KEY = 'gushenle:backup:before-rebuild';
const SYNC_LOG_KEY = 'gushenle_sync_log_v1';

export interface RebuildResult {
  /** 成功重放进持仓的笔数 */
  applied: number;
  /** 没有股数、无法重放的笔数（只记了流水的老记录） */
  skippedNoQty: number;
  /** 重放失败的记录（多半是卖出超出当时持仓——流水本身顺序/覆盖仍有缺口） */
  failed: Array<{ opId: string; msg: string }>;
}

interface RebuildBackup {
  positions: Position[];
  account: AccountInfo | null;
  at: number;
}

/** 有没有一份可恢复的重放前备份 */
export function hasRebuildBackup(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(BACKUP_KEY) != null;
  } catch {
    return false;
  }
}

/**
 * 全量重放：备份现状 -> 清空持仓与已实现盈亏 -> 操作记录按日期从旧到新逐条同步进持仓。
 * 同步日志一并清空后按重放结果重记（重放成功的都算已同步）。
 */
export function rebuildPositionsFromOperations(): RebuildResult {
  // 1) 快照当前持仓 + 账户（只留最近一份，覆盖旧快照）
  const backup: RebuildBackup = {
    positions: loadPositions(),
    account: loadAccount(),
    at: Date.now(),
  };
  try {
    window.localStorage.setItem(BACKUP_KEY, JSON.stringify(backup));
  } catch {
    // 存不下也继续重放，恢复按钮自然不会出现
  }

  // 2) 清空持仓；账户的已实现盈亏归零（本金/券商保留）；同步日志清空
  savePositions([]);
  const account = loadAccount();
  if (account) {
    saveAccount({ ...account, realized: 0, realizedBySymbol: {} });
  }
  try {
    window.localStorage.removeItem(SYNC_LOG_KEY);
  } catch {
    // ignore
  }

  // 3) 全部操作记录按操作日升序、同日按记录时间升序，逐条重放。
  // 卖出失败（多半是这条记录的日期比对应买入早了几天——截图识别/按结算日记的旧账常见）
  // 先挂起，主轮跑完再回头补：只要这只股票的买入总量够，补轮里就能对上。
  // 一整轮补录毫无进展才算真失败（流水本身缺买入）。
  const ops = [...loadOperations()].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt,
  );
  let applied = 0;
  let skippedNoQty = 0;
  const tryApply = (op: (typeof ops)[number]): string | null => {
    const r = applyOperationToPositions({
      symbol: op.symbol,
      action: op.action,
      price: op.price,
      qty: op.qty as number,
      date: op.date,
    });
    if (r.ok) {
      markSynced(op.id);
      applied++;
      return null;
    }
    return r.msg;
  };
  let pending: Array<{ op: (typeof ops)[number]; msg: string }> = [];
  for (const op of ops) {
    const qty = op.qty;
    if (!qty || !(qty > 0)) {
      skippedNoQty++;
      continue;
    }
    const err = tryApply(op);
    if (err) pending.push({ op, msg: err });
  }
  while (pending.length > 0) {
    const before = applied;
    const next: Array<{ op: (typeof ops)[number]; msg: string }> = [];
    for (const item of pending) {
      const err = tryApply(item.op);
      if (err) next.push({ op: item.op, msg: err });
    }
    pending = next;
    if (applied === before) break; // 一整轮没补上一笔：剩下的流水真有缺口
  }
  return {
    applied,
    skippedNoQty,
    failed: pending.map((p) => ({ opId: p.op.id, msg: p.msg })),
  };
}

/** 把最近一份重放前快照写回（持仓 + 账户）。没有快照返回 false。 */
export function restoreRebuildBackup(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(BACKUP_KEY);
    if (!raw) return false;
    const b = JSON.parse(raw) as RebuildBackup;
    if (!b || !Array.isArray(b.positions)) return false;
    savePositions(b.positions);
    if (b.account) saveAccount(b.account);
    else clearAccount();
    return true;
  } catch {
    return false;
  }
}

// —— 以清单为准重建：整表替换流水 ——
// 与上面的持仓快照（BACKUP_KEY）是两回事：这里备份的是「流水整表」。
// 流水里若混有重复/缺失记录，怎么重放都对不平；以券商全量清单为准整表替换，
// 才能得到确定性的结果。替换前整表备份并回读校验笔数，备份不成立绝不清表。
const OPS_KEY = 'gushenle_operations_v1'; // 与 operations.ts 的 KEY 同值
const OPS_BACKUP_KEY = 'gushenle:backup:ops-before-replace';

export interface BackfillRow {
  date: string;
  symbol: string;
  action: OpAction;
  qty: number;
  price: number;
}

export interface OpsBackupInfo {
  savedAt: number;
  count: number;
}

export function getOperationsBackupInfo(): OpsBackupInfo | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OPS_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt?: number; ops?: unknown };
    if (!Array.isArray(parsed?.ops)) return null;
    return { savedAt: parsed.savedAt ?? 0, count: parsed.ops.length };
  } catch {
    return null;
  }
}

/**
 * 以清单为准替换流水：现有流水整表备份（回读校验笔数一致才继续）→ 清空 →
 * 逐行写入清单 → createdAt 按「操作日 + 清单顺序」改写，保证重放顺序与清单完全一致。
 * 备份不成立时返回 null 且不动流水。持仓重建由调用方随后跑 rebuildPositionsFromOperations()。
 */
export function replaceOperationsWithRows(
  rows: BackfillRow[],
): { backedUp: number; written: number } | null {
  if (typeof window === 'undefined') return null;
  const current = loadOperations();
  try {
    window.localStorage.setItem(
      OPS_BACKUP_KEY,
      JSON.stringify({ savedAt: Date.now(), ops: current }),
    );
  } catch {
    return null;
  }
  const info = getOperationsBackupInfo();
  if (!info || info.count !== current.length) return null; // 备份没存稳，绝不清表

  try {
    window.localStorage.setItem(OPS_KEY, '[]');
  } catch {
    return null;
  }
  const ids: string[] = [];
  for (const r of rows) {
    const rec = saveOperation({
      date: r.date,
      symbol: r.symbol,
      action: r.action,
      price: r.price,
      qty: r.qty,
      source: 'import',
      thesis: '清单重建',
    });
    ids.push(rec.id);
  }
  // createdAt 改写：与补录导入同一手法，单独一遍完成（失败则同日顺序退化为写入时刻）
  try {
    const raw = window.localStorage.getItem(OPS_KEY);
    const list = raw ? (JSON.parse(raw) as Array<{ id: string; date: string; createdAt: number }>) : [];
    const byId = new Map(list.map((o) => [o.id, o]));
    ids.forEach((id, i) => {
      const o = byId.get(id);
      if (o) o.createdAt = Date.parse(o.date) + i;
    });
    window.localStorage.setItem(OPS_KEY, JSON.stringify(list));
  } catch {
    /* 改写失败不影响重建本身 */
  }
  return { backedUp: current.length, written: ids.length };
}

/** 把替换前的流水整表写回。返回恢复笔数；没有备份返回 0。持仓由调用方随后重放。 */
export function restoreOperationsBackup(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(OPS_BACKUP_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { ops?: unknown };
    if (!Array.isArray(parsed?.ops)) return 0;
    window.localStorage.setItem(OPS_KEY, JSON.stringify(parsed.ops));
    return parsed.ops.length;
  } catch {
    return 0;
  }
}
