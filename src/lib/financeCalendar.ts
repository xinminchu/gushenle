// 财经日历：固定日程（FOMC/CPI/休市/巴菲特/Jackson Hole）+ 规则生成（非农）
// FOMC 日期来自美联储官方日程，CPI 来自 BLS 发布日程；每年初更新一次即可。

export type CalKind =
  | 'fomc'
  | 'cpi'
  | 'nonfarm'
  | 'holiday'
  | 'buffett'
  | 'jacksonhole'
  | 'earnings';

export interface CalEvent {
  date: string; // YYYY-MM-DD
  title: string;
  kind: CalKind;
  symbol?: string;
  note?: string;
}

interface FixedEvent {
  date: string;
  title: string;
  kind: CalKind;
  note?: string;
}

// 美联储议息：决议公布日（会议第二天，美东 14:00）
const FOMC: FixedEvent[] = [
  { date: '2026-10-28', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布' },
  { date: '2026-12-09', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布·含点阵图' },
  { date: '2027-01-27', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布' },
  { date: '2027-03-17', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布·含点阵图' },
  { date: '2027-04-28', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布' },
  { date: '2027-06-09', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布·含点阵图' },
  { date: '2027-07-28', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布' },
  { date: '2027-09-15', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布·含点阵图' },
  { date: '2027-10-27', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布' },
  { date: '2027-12-08', title: '美联储议息决议', kind: 'fomc', note: '美东14:00公布·含点阵图' },
];

// CPI：BLS 发布日程（美东 8:30）
const CPI: FixedEvent[] = [
  { date: '2026-10-14', title: '美国 CPI 公布（9月）', kind: 'cpi', note: '美东8:30' },
  { date: '2026-11-10', title: '美国 CPI 公布（10月）', kind: 'cpi', note: '美东8:30' },
  { date: '2026-12-10', title: '美国 CPI 公布（11月）', kind: 'cpi', note: '美东8:30' },
  { date: '2027-01-14', title: '美国 CPI 公布（12月）', kind: 'cpi', note: '美东8:30' },
];

// 美股休市
const HOLIDAYS: FixedEvent[] = [
  { date: '2026-11-26', title: '美股休市：感恩节', kind: 'holiday' },
  { date: '2026-12-25', title: '美股休市：圣诞节', kind: 'holiday' },
  { date: '2027-01-01', title: '美股休市：元旦', kind: 'holiday' },
  { date: '2027-01-18', title: '美股休市：马丁·路德·金日', kind: 'holiday' },
  { date: '2027-02-15', title: '美股休市：总统日', kind: 'holiday' },
  { date: '2027-03-26', title: '美股休市：耶稣受难日', kind: 'holiday' },
  { date: '2027-05-31', title: '美股休市：阵亡将士纪念日', kind: 'holiday' },
  { date: '2027-06-18', title: '美股休市：六月节（调休）', kind: 'holiday' },
  { date: '2027-07-05', title: '美股休市：独立日（调休）', kind: 'holiday' },
  { date: '2027-09-06', title: '美股休市：劳工节', kind: 'holiday' },
  { date: '2027-11-25', title: '美股休市：感恩节', kind: 'holiday' },
  { date: '2027-12-24', title: '美股休市：圣诞节（调休）', kind: 'holiday' },
];

const MISC: FixedEvent[] = [
  { date: '2027-05-01', title: '巴菲特股东大会', kind: 'buffett', note: '奥马哈' },
  { date: '2027-08-27', title: 'Jackson Hole 全球央行年会', kind: 'jacksonhole', note: '约8月下旬' },
];

/** 每月第一个周五 = 非农就业报告（美东 8:30） */
function firstFriday(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  const offset = (5 - d.getUTCDay() + 7) % 7; // 5 = Friday
  d.setUTCDate(1 + offset);
  return d.toISOString().slice(0, 10);
}

function nonfarmEvents(): CalEvent[] {
  const out: CalEvent[] = [];
  for (const year of [2026, 2027]) {
    for (let m = 1; m <= 12; m++) {
      out.push({
        date: firstFriday(year, m),
        title: '非农就业报告',
        kind: 'nonfarm',
        note: '美东8:30',
      });
    }
  }
  return out;
}

let staticCache: CalEvent[] | null = null;

export function getStaticEvents(): CalEvent[] {
  if (!staticCache) {
    staticCache = [
      ...FOMC,
      ...CPI,
      ...HOLIDAYS,
      ...MISC,
      ...nonfarmEvents(),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }
  return staticCache;
}

/** 未来 N 天（含今天）的事件 */
export function getUpcomingEvents(fromDate: string, days: number): CalEvent[] {
  const end = new Date(fromDate + 'T12:00:00');
  end.setDate(end.getDate() + days);
  const endStr = end.toISOString().slice(0, 10);
  return getStaticEvents().filter((e) => e.date >= fromDate && e.date < endStr);
}

/** 某年的全部事件（全年大事记用） */
export function getYearEvents(year: number): CalEvent[] {
  const prefix = String(year);
  return getStaticEvents().filter((e) => e.date.startsWith(prefix));
}

const KIND_META: Record<CalKind, { label: string; icon: string; chip: string }> = {
  fomc: { label: '议息', icon: '🏦', chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  cpi: { label: 'CPI', icon: '📊', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  nonfarm: { label: '非农', icon: '💼', chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  holiday: { label: '休市', icon: '🏖️', chip: 'bg-slate-500/15 text-slate-400 border-slate-600/50' },
  buffett: { label: '大会', icon: '🎤', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  jacksonhole: { label: '年会', icon: '🏔️', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  earnings: { label: '财报', icon: '📢', chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
};

export function kindMeta(kind: CalKind) {
  return KIND_META[kind];
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** YYYY-MM-DD → "9月24日 周四" */
export function formatDateCN(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return `${m}月${d}日 周${WEEKDAYS[dt.getDay()]}`;
}

/** 今天（用户时区）的 YYYY-MM-DD */
export function todayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
