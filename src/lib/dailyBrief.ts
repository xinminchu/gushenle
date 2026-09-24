import { STATUS_LABELS, type StatusKey } from './rhythm';
import type { CalEvent } from './financeCalendar';

export interface BriefStock {
  symbol: string;
  name: string;
  /** 最近一个交易日涨跌幅（%，由最近两根日线算出） */
  changePct: number | null;
  /** 最近交易日（M/D） */
  barDate: string;
  score: number;
  statusKey: StatusKey | '';
}

export interface SignalChange {
  symbol: string;
  name: string;
  from: string;
  to: string;
  toKey: StatusKey | '';
}

export type BriefPhase = 'pre' | 'post';

export interface BriefTime {
  phase: BriefPhase;
  tradingDay: boolean;
  /** 美东今天 YYYY-MM-DD */
  dateStr: string;
  /** 美东今天 M/D */
  md: string;
}

/** 美东现在处在什么时段：16:00 前看盘前瞻，之后看盘后总结 */
export function etBriefTime(now = new Date()): BriefTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const dateStr = `${get('year')}-${get('month')}-${get('day')}`;
  const mins = Number(get('hour')) * 60 + Number(get('minute'));
  const wd = get('weekday');
  const tradingDay = wd !== 'Sun' && wd !== 'Sat';
  return {
    phase: mins < 16 * 60 ? 'pre' : 'post',
    tradingDay,
    dateStr,
    md: `${Number(get('month'))}/${Number(get('day'))}`,
  };
}

export interface PreBrief {
  eventsToday: CalEvent[];
  ups: BriefStock[];
  downs: BriefStock[];
  line: string;
}

export interface PostBrief {
  ups: BriefStock[];
  downs: BriefStock[];
  changes: SignalChange[];
  line: string;
}

const byChange = (a: BriefStock, b: BriefStock) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity);

export function buildPreBrief(stocks: BriefStock[], eventsToday: CalEvent[]): PreBrief {
  const sorted = [...stocks].sort(byChange);
  const ups = sorted.filter((s) => (s.changePct ?? 0) > 0).slice(0, 2);
  const downs = sorted.filter((s) => (s.changePct ?? 0) < 0).slice(-1);
  let line: string;
  if (eventsToday.length > 0) {
    const titles = eventsToday
      .map((e) => `${e.title}${e.note ? `（${e.note}）` : ''}${e.symbol ? ` · ${e.symbol}` : ''}`)
      .slice(0, 3)
      .join('；');
    line = `今天 ${eventsToday.length} 件事：${titles}${eventsToday.length > 3 ? '…' : ''}，小心波动`;
  } else {
    line = '今日无重磅日程，安心看盘';
  }
  return { eventsToday, ups, downs, line };
}

export function buildPostBrief(stocks: BriefStock[], changes: SignalChange[]): PostBrief {
  const sorted = [...stocks].sort(byChange);
  const ups = sorted.filter((s) => (s.changePct ?? 0) > 0).slice(0, 3);
  const downs = sorted.filter((s) => (s.changePct ?? 0) < 0).slice(-3);
  let line = '今日信号平稳，按计划来';
  const hot = changes.filter((c) => c.toKey === 'overheated');
  const cold = changes.filter((c) => c.toKey === 'oversoldBottom');
  const weak = changes.filter((c) => c.toKey === 'weakLow');
  if (hot.length > 0) {
    line = `${hot.map((c) => c.symbol).join('、')}刚变成"涨太猛了"，别追`;
  } else if (cold.length > 0) {
    line = `${cold.map((c) => c.symbol).join('、')}刚"跌过头了"，别割在地板上`;
  } else if (weak.length > 0) {
    line = `${weak.map((c) => c.symbol).join('、')}还在往下跌，不接飞刀`;
  }
  return { ups, downs, changes, line };
}

export const zhStatus = (k: StatusKey | ''): string => (k ? STATUS_LABELS[k] : '—');
