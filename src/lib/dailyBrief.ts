import { statusLabel, type StatusKey } from './rhythm';
import { calEventTitle, calEventNote, sessionLabel, type CalEvent } from './financeCalendar';
import type { Lang } from '@/lib/i18n';
import { tx } from './hant';

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
  market?: MarketScanSummary | null;
}

export interface PostBrief {
  ups: BriefStock[];
  downs: BriefStock[];
  changes: SignalChange[];
  line: string;
  market?: MarketScanSummary | null;
}

/** 全市场扫描摘要（/api/market-scan 返回，供两报的大盘/全市场行用） */
export interface ScanMini {
  symbol: string;
  name: string;
  score: number;
  statusKey: StatusKey | '';
  changePct: number | null;
  inflowEst: number | null;
}

export interface MarketScanSummary {
  scanDate: string;
  total: number;
  hotCount: number;
  coldCount: number;
  qqq: ScanMini | null;
  spy: ScanMini | null;
  inflowTop: ScanMini[];
  outflowTop: ScanMini[];
}

const byChange = (a: BriefStock, b: BriefStock) => (b.changePct ?? -Infinity) - (a.changePct ?? -Infinity);

export function buildPreBrief(
  stocks: BriefStock[],
  eventsToday: CalEvent[],
  market?: MarketScanSummary | null,
  lang: Lang = 'zh',
): PreBrief {
  const sorted = [...stocks].sort(byChange);
  const ups = sorted.filter((s) => (s.changePct ?? 0) > 0).slice(0, 2);
  const downs = sorted.filter((s) => (s.changePct ?? 0) < 0).slice(-1);
  let line: string;
  if (eventsToday.length > 0) {
    const titles = eventsToday
      .map((e) => {
        // 财报事件的 note 是时段规范 key（pre/after/during/tbd），渲染时才按语言映射
        const noteText = e.note ? (e.kind === 'earnings' ? sessionLabel(e.note, lang) : calEventNote(e, lang)) : '';
        const notePart = noteText ? (lang === 'en' ? ` (${noteText})` : `（${noteText}）`) : '';
        return `${calEventTitle(e, lang)}${notePart}${e.symbol ? ` · ${e.symbol}` : ''}`;
      })
      .slice(0, 3)
      .join(lang === 'en' ? '; ' : '；');
    line = tx(
      lang,
      `Today's ${eventsToday.length} events: ${titles}${eventsToday.length > 3 ? '…' : ''} — watch for volatility`,
      `今天 ${eventsToday.length} 件事：${titles}${eventsToday.length > 3 ? '…' : ''}，小心波动`,
    );
  } else {
    line = tx(lang, 'No big events today — watch the market calmly', '今日无重磅日程，安心看盘');
  }
  return { eventsToday, ups, downs, line, market: market ?? null };
}

export function buildPostBrief(
  stocks: BriefStock[],
  changes: SignalChange[],
  market?: MarketScanSummary | null,
  lang: Lang = 'zh',
): PostBrief {
  const sorted = [...stocks].sort(byChange);
  const ups = sorted.filter((s) => (s.changePct ?? 0) > 0).slice(0, 3);
  const downs = sorted.filter((s) => (s.changePct ?? 0) < 0).slice(-3);
  let line = tx(lang, 'Signals steady today — stick to the plan', '今日信号平稳，按计划来');
  const hot = changes.filter((c) => c.toKey === 'overheated');
  const cold = changes.filter((c) => c.toKey === 'oversoldBottom');
  const weak = changes.filter((c) => c.toKey === 'weakLow');
  if (hot.length > 0) {
    const names = hot.map((c) => c.symbol).join('、');
    line = tx(lang, `${names} just turned "Running too hot" — don't chase`, `${names}刚变成"涨太猛了"，别追`);
  } else if (cold.length > 0) {
    const names = cold.map((c) => c.symbol).join('、');
    line = tx(lang, `${names} just hit "Oversold" — don't sell at the bottom`, `${names}刚"跌过头了"，别割在地板上`);
  } else if (weak.length > 0) {
    const names = weak.map((c) => c.symbol).join('、');
    line = tx(lang, `${names} is still sliding — don't catch the falling knife`, `${names}还在往下跌，不接飞刀`);
  }
  return { ups, downs, changes, line, market: market ?? null };
}

export const zhStatus = (k: StatusKey | '', lang: Lang = 'zh'): string =>
  k ? statusLabel(k, lang) : '—';
