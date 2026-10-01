// src/lib/focusHistory.ts
// 关注历史：用户「＋关注」过的股票，按 周+代码 去重持久保存。
// 持仓页「历史关注」区按周分组展示（本周在最上，点进去看走势）。

import { weekStartStr } from './focus';

export interface FocusHistoryItem {
  symbol: string;
  addedAt: number;
  /** 添加时带回的显示名（自选里的走 nameOf） */
  name?: string;
}

const KEY = 'gushenle_focus_history_v1';
const MAX = 300;

export function loadFocusHistory(): FocusHistoryItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.symbol === 'string')
      .slice(0, MAX);
  } catch {
    return [];
  }
}

function save(list: FocusHistoryItem[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {}
}

/** 记一笔：同一周同一只只留一条（更新时间） */
export function logFocusWatch(symbol: string, name?: string): void {
  const s = symbol.trim().toUpperCase();
  if (!s) return;
  const week = weekStartStr();
  const list = loadFocusHistory();
  const idx = list.findIndex((x) => x.symbol === s && weekStartStr(new Date(x.addedAt)) === week);
  const entry: FocusHistoryItem = { symbol: s, addedAt: Date.now(), name };
  if (idx >= 0) {
    list[idx] = { ...entry, name: entry.name ?? list[idx].name };
  } else {
    list.unshift(entry);
  }
  save(list);
}

/** 按周分组：[{ week: 'YYYY-MM-DD'（周一）, items }]，新的周在前 */
export function groupFocusHistory(): { week: string; items: FocusHistoryItem[] }[] {
  const map = new Map<string, FocusHistoryItem[]>();
  for (const x of loadFocusHistory()) {
    const w = weekStartStr(new Date(x.addedAt));
    const arr = map.get(w) ?? [];
    if (!arr.some((y) => y.symbol === x.symbol)) arr.push(x);
    map.set(w, arr);
  }
  return [...map.entries()]
    .map(([week, items]) => ({ week, items }))
    .sort((a, b) => (a.week < b.week ? 1 : -1));
}

/** 周标签：本周 / 9月28日那周（英文：This week / Week of Sep 28） */
export function weekLabel(week: string, lang: 'zh' | 'hant' | 'en' = 'zh'): string {
  if (week === weekStartStr()) return lang === 'en' ? 'This week' : '本周';
  const [, m, d] = week.split('-').map(Number);
  if (lang === 'en') {
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `Week of ${MONTHS[m - 1]} ${d}`;
  }
  return `${m}月${d}日那周`;
}

export function clearFocusHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
