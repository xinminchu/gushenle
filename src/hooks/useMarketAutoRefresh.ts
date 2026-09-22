import { useCallback, useEffect, useRef, useState } from 'react';

/** 美东收盘后自动刷新的时刻：16:35 ET，给数据源留出更新收盘价的时间 */
const REFRESH_ET_MINUTES = 16 * 60 + 35;

/** 取当前美东时间的 wall clock（getHours/getDay 等方法直接反映美东时间） */
function etNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

function isoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * 美股收盘后自动刷新信号。日线数据一天只变一次，页面开着不用管，
 * 放一晚上第二天早上自动就是最新收盘价。
 *
 * @param lastDataDate 当前数据的最后日期（YYYY-MM-DD），无数据时不触发
 * @returns tick：每次需要刷新时 +1，调用方放进拉数据的 useEffect 依赖即可
 *
 * 规则：每 5 分钟检查一次；仅在美东工作日 16:35 之后、且数据最后日期早于
 * 当天（美东）时触发；每天最多触发一次。
 */
export function useMarketAutoRefresh(lastDataDate: string | undefined): number {
  const [tick, setTick] = useState(0);
  const dateRef = useRef(lastDataDate);
  dateRef.current = lastDataDate;
  const doneFor = useRef<string | null>(null);

  const check = useCallback(() => {
    const now = etNow();
    const weekday = now.getDay();
    if (weekday < 1 || weekday > 5) return; // 仅工作日
    if (now.getHours() * 60 + now.getMinutes() < REFRESH_ET_MINUTES) return;
    const today = isoDate(now);
    const last = dateRef.current;
    if (last && last < today && doneFor.current !== today) {
      doneFor.current = today;
      setTick((t) => t + 1);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [check]);

  // 数据到达后立即检查一次（比如收盘后才打开页面，首屏可能是缓存的旧数据）
  useEffect(() => {
    if (lastDataDate) check();
  }, [lastDataDate, check]);

  return tick;
}
