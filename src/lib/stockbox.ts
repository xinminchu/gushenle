/**
 * 🎁 股票盲盒次数规则（EaaS v0 联动）
 * - 每日免费 10 次（按手机本地日期，存在本机）
 * - 许愿池每认同一条留言 +5 次（每条留言终身只加一次，防刷）
 */
export const MAX_DAILY_FREE = 10;
export const BONUS_PER_ENDORSE = 5;

const DAILY_KEY = 'gushenle_stockbox_daily_v1';
const BONUS_KEY = 'gushenle_stockbox_bonus_v1';

export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};

export function loadDaily(): { date: string; count: number } {
  try {
    const j = JSON.parse(localStorage.getItem(DAILY_KEY) || '{}');
    if (j.date === todayStr() && typeof j.count === 'number') return j;
  } catch {
    /* 忽略 */
  }
  return { date: todayStr(), count: 0 };
}

export function saveDaily(d: { date: string; count: number }) {
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(d));
  } catch {
    /* 忽略 */
  }
}

/** 已发放过加成的留言 id（终身制：一人一条留言只加一次） */
export function loadBonusWishIds(): string[] {
  try {
    const j = JSON.parse(localStorage.getItem(BONUS_KEY) || '[]');
    return Array.isArray(j) ? j.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * 认同成功后调用：该留言首次加成返回 true（+5 次到账），
 * 之前加过则返回 false（不重复发）。
 */
export function grantEndorseBonus(wishId: string): boolean {
  const ids = loadBonusWishIds();
  if (ids.includes(wishId)) return false;
  try {
    localStorage.setItem(BONUS_KEY, JSON.stringify([...ids, wishId]));
  } catch {
    /* 忽略 */
  }
  return true;
}

/** 认同加成总次数 */
export function bonusPlays(): number {
  return loadBonusWishIds().length * BONUS_PER_ENDORSE;
}

/** 今日总可用次数 = 免费 10 + 认同加成 */
export function totalPlaysToday(): number {
  return MAX_DAILY_FREE + bonusPlays();
}

/** 今日剩余次数（usedToday 为今日已用） */
export function playsLeft(usedToday: number): number {
  return Math.max(0, totalPlaysToday() - usedToday);
}
