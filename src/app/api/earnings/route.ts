// GET /api/earnings?start=YYYY-MM-DD&days=7&symbols=AAPL,MSFT
// 未来 N 天内自选股的财报日（Nasdaq 官方日历），按天缓存 6 小时
//
// GET /api/earnings?mode=reactions&symbols=AAPL,MSFT
// GoMoon 式"事件后反应实测"的日线版：对每只股票，先往前扫出下一次财报日，
// 再按约 91 天 cadence 反查过去 4 次财报日，用已有日线算"财报后次日涨跌"。
// 全部走已有 Nasdaq 日历 + 日线接口，不新增数据源；模拟数据不参与计算。
import { NextRequest, NextResponse } from 'next/server';
import { getFullSeries } from '@/lib/marketData';

export interface EarningsEvent {
  date: string;
  symbol: string;
  name: string;
  session: string; // pre / after / during / tbd（展示层按语言映射）
}

const dateCache = new Map<string, { at: number; rows: any[] }>();
const TTL = 6 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

function mapSession(t: string): string {
  if (t === 'time-pre-market') return 'pre';
  if (t === 'time-after-hours') return 'after';
  if (t === 'time-during-hours') return 'during';
  return 'tbd';
}

async function rowsForDate(date: string): Promise<any[]> {
  const hit = dateCache.get(date);
  if (hit && Date.now() - hit.at < TTL) return hit.rows;
  const r = await fetch(
    `https://api.nasdaq.com/api/calendar/earnings?date=${date}`,
    { headers: { 'User-Agent': UA, Accept: 'application/json' } },
  );
  if (!r.ok) throw new Error(`nasdaq earnings ${r.status}`);
  const j = await r.json();
  const rows = j?.data?.rows || [];
  dateCache.set(date, { at: Date.now(), rows });
  return rows;
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (q.get('mode') === 'reactions') return getReactions(q);
  const start = q.get('start') || new Date().toISOString().slice(0, 10);
  const days = Math.min(Math.max(parseInt(q.get('days') || '7', 10), 1), 14);
  const symbols = new Set(
    (q.get('symbols') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean),
  );
  if (symbols.size === 0) {
    return NextResponse.json({ events: [] });
  }
  try {
    const events: EarningsEvent[] = [];
    const startDt = new Date(start + 'T12:00:00');
    const dates: string[] = [];
    for (let i = 0; i < days; i++) {
      const dt = new Date(startDt);
      dt.setDate(dt.getDate() + i);
      dates.push(dt.toISOString().slice(0, 10));
    }
    // 并行拉（原来是顺序 await，冷缓存时 14 个请求串行太慢）；单个日期失败按空处理
    const allRows = await Promise.all(dates.map((ds) => rowsForDate(ds).catch(() => [] as any[])));
    for (let i = 0; i < dates.length; i++) {
      const ds = dates[i];
      for (const row of allRows[i]) {
        const sym = String(row.symbol || '').toUpperCase();
        if (symbols.has(sym)) {
          events.push({
            date: ds,
            symbol: sym,
            name: String(row.name || sym),
            session: mapSession(String(row.time || '')),
          });
        }
      }
    }
    events.sort((a, b) => a.date.localeCompare(b.date));
    return NextResponse.json({ events });
  } catch (e) {
    console.error('[api/earnings]', e);
    return NextResponse.json({ events: [], error: '财报日历暂时拿不到' });
  }
}

/* ================= mode=reactions：财报后反应实测 ================= */

export interface EarningReaction {
  date: string; // 过去某次财报日 YYYY-MM-DD
  nextDayPct: number; // 财报后次日涨跌 %（财报日收盘 → 下一交易日收盘）
}

export interface SymbolReactions {
  upcoming: string | null; // 下一次财报日
  past: EarningReaction[]; // 新 → 旧，最多 4 条
  up: number;
  down: number;
  avg: number | null; // 次日涨跌均值 %
}

const reactCache = new Map<string, { at: number; data: SymbolReactions }>();
const REACT_TTL = 6 * 60 * 60 * 1000;

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function hasSymbol(rows: any[], sym: string): boolean {
  return rows.some((r) => String(r.symbol || '').toUpperCase() === sym);
}

/** 往前扫下一次财报日：14 天一批，最多 100 天，命中即停 */
async function findUpcoming(sym: string, today: string): Promise<string | null> {
  const start = new Date(today + 'T12:00:00');
  for (let off = 0; off < 100; off += 14) {
    const dates: string[] = [];
    for (let i = off; i < Math.min(off + 14, 100); i++) dates.push(fmtD(addDays(start, i)));
    const allRows = await Promise.all(dates.map((ds) => rowsForDate(ds).catch(() => [] as any[])));
    for (let i = 0; i < dates.length; i++) {
      if (hasSymbol(allRows[i], sym)) return dates[i];
    }
  }
  return null;
}

/**
 * 按约 91 天 cadence 反查过去 4 次财报日。
 * 每个预期日前后 ±7 天按"离预期越近越优先"扫，命中即收（财报日基本落在同一周）。
 */
async function findPast(sym: string, anchor: string, today: string): Promise<string[]> {
  const out: string[] = [];
  const base = new Date(anchor + 'T12:00:00');
  const order: number[] = [0];
  for (let d = 1; d <= 7; d++) order.push(-d, d);
  for (let k = 1; k <= 4; k++) {
    const expected = addDays(base, -91 * k);
    const dates = order.map((d) => fmtD(addDays(expected, d)));
    const allRows = await Promise.all(dates.map((ds) => rowsForDate(ds).catch(() => [] as any[])));
    for (let i = 0; i < dates.length; i++) {
      if (dates[i] >= today) continue; // 只要过去的
      if (hasSymbol(allRows[i], sym)) {
        if (!out.includes(dates[i])) out.push(dates[i]);
        break;
      }
    }
  }
  return out.sort().reverse(); // 新 → 旧
}

async function reactionsFor(sym: string, today: string): Promise<SymbolReactions> {
  const hit = reactCache.get(sym);
  if (hit && Date.now() - hit.at < REACT_TTL) return hit.data;
  const empty: SymbolReactions = { upcoming: null, past: [], up: 0, down: 0, avg: null };
  // 韩股不在 Nasdaq 日历覆盖范围，直接返回空（不编造）
  if (sym.endsWith('.KS')) {
    reactCache.set(sym, { at: Date.now(), data: empty });
    return empty;
  }
  try {
    const upcoming = await findUpcoming(sym, today);
    const pastDates = await findPast(sym, upcoming ?? today, today);
    const { series, source } = await getFullSeries(sym);
    const past: EarningReaction[] = [];
    // 模拟数据不参与实测，避免"假往绩"
    if (source !== 'simulated' && series.length > 1) {
      const idx = new Map(series.map((p, i) => [p.date, i]));
      for (const d of pastDates) {
        // 财报日若落在非交易日，向最近交易日对齐（±3 天内）
        let i: number | undefined;
        for (const off of [0, -1, 1, -2, 2, -3, 3]) {
          const dd = fmtD(addDays(new Date(d + 'T12:00:00'), off));
          const j = idx.get(dd);
          if (j != null) {
            i = j;
            break;
          }
        }
        if (i == null || i + 1 >= series.length) continue;
        const c0 = series[i].close;
        const c1 = series[i + 1].close;
        if (c0 > 0 && Number.isFinite(c1)) {
          past.push({ date: d, nextDayPct: Number((((c1 - c0) / c0) * 100).toFixed(2)) });
        }
      }
    }
    const up = past.filter((p) => p.nextDayPct > 0).length;
    const down = past.filter((p) => p.nextDayPct < 0).length;
    const avg = past.length
      ? Number((past.reduce((s, p) => s + p.nextDayPct, 0) / past.length).toFixed(2))
      : null;
    const data: SymbolReactions = { upcoming, past, up, down, avg };
    reactCache.set(sym, { at: Date.now(), data });
    return data;
  } catch (e) {
    console.error('[api/earnings reactions]', sym, e);
    return empty;
  }
}

async function getReactions(q: URLSearchParams) {
  const symbols = (q.get('symbols') || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 8);
  const today = new Date().toISOString().slice(0, 10);
  const reactions: Record<string, SymbolReactions> = {};
  await Promise.all(
    symbols.map(async (s) => {
      reactions[s] = await reactionsFor(s, today);
    }),
  );
  return NextResponse.json({ reactions });
}
