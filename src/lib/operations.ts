// src/lib/operations.ts
// 用户股票操作记录：语音/一键记录 -> localStorage -> 自动复盘（卖飞/买高）

export type OpAction = 'buy' | 'sell';
export type OpSource = 'voice' | 'one-tap' | 'manual';

export interface OperationRecord {
  id: string;
  symbol: string; // AAPL
  name?: string; // 苹果
  action: OpAction; // buy=买入 sell=卖出
  price: number; // 执行价格
  qty?: number; // 数量（可选）
  date: string; // YYYY-MM-DD（操作日）
  createdAt: number; // 记录时间戳
  source: OpSource;
  thesis?: string; // 操作逻辑/理由
  emotion?: string; // 当时情绪
  adviceSnapshot?: string; // 当时 App 的建议（如"涨太猛了，先冷静一下"）
  adviceScore?: number; // 当时的综合分
}

const KEY = 'gushenle_operations_v1';

function safeParse(raw: string | null): OperationRecord[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function loadOperations(): OperationRecord[] {
  if (typeof window === 'undefined') return [];
  const list = safeParse(window.localStorage.getItem(KEY));
  // 按操作日倒序
  return list.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt);
}

export function saveOperation(op: Omit<OperationRecord, 'id' | 'createdAt'>): OperationRecord {
  const rec: OperationRecord = {
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const list = safeParse(typeof window !== 'undefined' ? window.localStorage.getItem(KEY) : null);
  list.push(rec);
  window.localStorage.setItem(KEY, JSON.stringify(list));
  return rec;
}

export function deleteOperation(id: string): void {
  if (typeof window === 'undefined') return;
  const list = safeParse(window.localStorage.getItem(KEY)).filter((r) => r.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

/** 按 id 更新一条操作记录（说错了更正单价/数量/日期/方向用） */
export function updateOperation(
  id: string,
  patch: Partial<
    Pick<OperationRecord, 'symbol' | 'action' | 'price' | 'qty' | 'date' | 'thesis' | 'emotion'>
  >,
): OperationRecord | null {
  if (typeof window === 'undefined') return null;
  const list = safeParse(window.localStorage.getItem(KEY));
  const rec = list.find((r) => r.id === id);
  if (!rec) return null;
  Object.assign(rec, patch);
  window.localStorage.setItem(KEY, JSON.stringify(list));
  return rec;
}

/** 把 AI 解析的动作字符串归一化为 buy/sell */
export function normalizeAction(a: string | undefined): OpAction | null {
  if (!a) return null;
  const s = a.toUpperCase();
  if (s.includes('BUY') || s.includes('买') || s.includes('加仓')) return 'buy';
  if (s.includes('SELL') || s.includes('REDUCE') || s.includes('卖') || s.includes('减')) return 'sell';
  return null;
}

export const ACTION_LABEL: Record<OpAction, string> = { buy: '买入', sell: '卖出' };

/** 前向涨跌 -> 复盘结论（大白话，不批评） */
export function verdictFor(
  action: OpAction,
  fwdPct: number | null,
): { label: string; good: boolean } | null {
  if (fwdPct == null || !isFinite(fwdPct)) return null;
  const p = Math.abs(fwdPct) < 0.05 ? 0 : fwdPct; // 0.05% 以内算持平
  if (action === 'sell') {
    if (p > 0) return { label: `卖飞了 +${p.toFixed(1)}%`, good: false };
    if (p < 0) return { label: `卖对了，躲开 ${p.toFixed(1)}%`, good: true };
    return { label: '卖出后基本持平', good: true };
  }
  // buy
  if (p > 0) return { label: `买对了 +${p.toFixed(1)}%`, good: true };
  if (p < 0) return { label: `买高了 ${p.toFixed(1)}%`, good: false };
  return { label: '买入后基本持平', good: true };
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

