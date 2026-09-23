// GET /api/earnings?start=YYYY-MM-DD&days=7&symbols=AAPL,MSFT
// 未来 N 天内自选股的财报日（Nasdaq 官方日历），按天缓存 6 小时
import { NextRequest, NextResponse } from 'next/server';

export interface EarningsEvent {
  date: string;
  symbol: string;
  name: string;
  session: string; // 盘前 / 盘后 / 盘中 / 未定
}

const dateCache = new Map<string, { at: number; rows: any[] }>();
const TTL = 6 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

function mapSession(t: string): string {
  if (t === 'time-pre-market') return '盘前';
  if (t === 'time-after-hours') return '盘后';
  if (t === 'time-during-hours') return '盘中';
  return '时间未定';
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
    for (let i = 0; i < days; i++) {
      const dt = new Date(startDt);
      dt.setDate(dt.getDate() + i);
      const ds = dt.toISOString().slice(0, 10);
      let rows: any[] = [];
      try {
        rows = await rowsForDate(ds);
      } catch {
        continue;
      }
      for (const row of rows) {
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
