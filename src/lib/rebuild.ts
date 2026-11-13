// src/lib/rebuild.ts
// 全量重放对账：操作记录（流水）是真相，持仓与已实现盈亏按流水从旧到新重放重建。
// 用途：补录导入历史交易后，流水变全了，但持仓/已实现还是旧的部分同步结果——
// 重放一遍，两本账重新对齐。重放前先把当前持仓+账户快照存一份，可一键恢复。

import { loadOperations } from './operations';
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

  // 3) 全部操作记录按操作日升序、同日按记录时间升序，逐条重放
  const ops = [...loadOperations()].sort(
    (a, b) => (a.date || '').localeCompare(b.date || '') || a.createdAt - b.createdAt,
  );
  let applied = 0;
  let skippedNoQty = 0;
  const failed: RebuildResult['failed'] = [];
  for (const op of ops) {
    const qty = op.qty;
    if (!qty || !(qty > 0)) {
      skippedNoQty++;
      continue;
    }
    const r = applyOperationToPositions({
      symbol: op.symbol,
      action: op.action,
      price: op.price,
      qty,
      date: op.date,
    });
    if (r.ok) {
      markSynced(op.id);
      applied++;
    } else {
      failed.push({ opId: op.id, msg: r.msg });
    }
  }
  return { applied, skippedNoQty, failed };
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
