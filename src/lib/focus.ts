// src/lib/focus.ts
// 本周关注：持仓页第二区。最多 6 只，每周一自动清空（新的一周重新选）。
// 预算一周问一次，默认用用户画像里的单笔买入中位数反填。

export interface FocusItem {
  symbol: string;
  addedAt: number;
}

export interface FocusState {
  week: string; // 本周一的日期 YYYY-MM-DD
  items: FocusItem[];
  budget: number | null; // 本周预算（用户确认的数字）
}

export const FOCUS_MAX = 6;
const KEY = 'gushenle_weekly_focus_v1';

/** 本周一（本地时区），格式 YYYY-MM-DD */
export function weekStartStr(d = new Date()): string {
  const t = new Date(d);
  const day = (t.getDay() + 6) % 7; // 周一=0
  t.setDate(t.getDate() - day);
  const m = String(t.getMonth() + 1).padStart(2, '0');
  const dd = String(t.getDate()).padStart(2, '0');
  return `${t.getFullYear()}-${m}-${dd}`;
}

const fresh = (week: string): FocusState => ({ week, items: [], budget: null });

export function loadFocus(): FocusState {
  const week = weekStartStr();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh(week);
    const s = JSON.parse(raw) as FocusState;
    if (s.week !== week || !Array.isArray(s.items)) return fresh(week); // 跨周自动清空
    return { week, items: s.items.slice(0, FOCUS_MAX), budget: typeof s.budget === 'number' ? s.budget : null };
  } catch {
    return fresh(week);
  }
}

export function saveFocus(s: FocusState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

/** 集中度建议：一句话人话，不讲大道理 */
export function concentrationAdvice(budget: number | null): string | null {
  if (budget == null || !(budget > 0)) return null;
  if (budget < 5000) return '预算不大，1-2 只就够了，摊太散每只涨 10% 也没感觉';
  if (budget < 20000) return '这个预算 2-3 只比较舒服，别超过 4 只';
  return '预算充足也别贪多，3-4 只，6 只封顶';
}
