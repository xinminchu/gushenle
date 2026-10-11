// GET /api/fundamentals?symbol=TSLA&price=250.5
// 探市全家桶 P1：基本面一行。SEC companyfacts（免费无 key）取营收/EPS/股数，
// price 由前端传入（已有实时行情），服务端只算 PE/市值/营收同比。
// 只摆事实，不做解读。失败 → {unavailable: true}，前端静默隐藏。
import { NextRequest, NextResponse } from 'next/server';
import { getCik10, cikNoZero, secFetchJson } from '@/lib/sec';

const cache = new Map<string, { at: number; data: any }>();
const TTL = 24 * 60 * 60 * 1000; // 24 小时：财报数据低频

interface FactRow {
  end: string;
  fp: string;
  val: number;
  days: number; // end - start 跨度（天），用于区分季度/YTD/年度
}

function rowsOf(facts: any, concept: string, unit: string): FactRow[] {
  const us = facts?.['us-gaap']?.[concept]?.units?.[unit] || [];
  return us
    .filter((r: any) => Number.isFinite(Number(r.val)) && !r.segment) // 去掉分部口径
    .map((r: any) => {
      const end = new Date(String(r.end));
      const start = r.start ? new Date(String(r.start)) : end;
      const days = Math.round((end.getTime() - start.getTime()) / 86400000);
      return { end: String(r.end), fp: String(r.fp || ''), val: Number(r.val), days };
    });
}

/** 同一 end 只留一条（去重修订版），按 end 升序 */
function dedupe(rows: FactRow[]): FactRow[] {
  const m = new Map<string, FactRow>();
  for (const r of rows) m.set(r.end, r);
  return [...m.values()].sort((a, b) => a.end.localeCompare(b.end));
}

/** 真季度：跨度约 3 个月（排除 YTD 累计值） */
const isQuarter = (r: FactRow) => /^Q[1-4]$/.test(r.fp) && r.days >= 80 && r.days <= 100;
/** 真年度：跨度约 12 个月（排除误标 FY 的季度值） */
const isAnnual = (r: FactRow) => r.fp === 'FY' && r.days >= 350 && r.days <= 380;

/** 营收概念名各公司不统一，按顺序找第一个有 ≥2 个真年度值的 */
const REV_CONCEPTS = [
  'Revenues',
  'SalesRevenueNet',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
];

async function fundamentalsFor(symbol: string, price: number | null): Promise<any> {
  const key = symbol;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    const d = hit.data;
    return withPrice(d, price);
  }
  const done = (data: any) => {
    cache.set(key, { at: Date.now(), data });
    return withPrice(data, price);
  };
  const unavailable = { unavailable: true };
  try {
    const cik10 = await getCik10(symbol);
    if (!cik10) return done(unavailable);
    const j = await secFetchJson(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10}.json`);
    const facts = j?.facts;
    if (!facts) return done(unavailable);

    // 营收：真年度值。概念名各公司/各年份不统一，选"数据最新鲜"的那个概念
    let rev: FactRow[] = [];
    let bestEnd = '';
    for (const c of REV_CONCEPTS) {
      const rows = dedupe(rowsOf(facts, c, 'USD').filter(isAnnual));
      if (rows.length >= 2) {
        const end = rows[rows.length - 1].end;
        if (end > bestEnd) {
          bestEnd = end;
          rev = rows;
        }
      }
    }
    let revenueLatest: number | null = null;
    let revenueYoY: number | null = null;
    if (rev.length >= 1) revenueLatest = rev[rev.length - 1].val;
    if (rev.length >= 2) {
      const a = rev[rev.length - 1].val;
      const b = rev[rev.length - 2].val;
      if (b !== 0) revenueYoY = (a - b) / Math.abs(b);
    }

    // EPS TTM：最近 4 个真季度 diluted EPS 求和；最新季度超过 400 天视为过期
    const epsQ = dedupe(
      rowsOf(facts, 'EarningsPerShareDiluted', 'USD/shares').filter(isQuarter),
    );
    let epsTTM: number | null = null;
    if (epsQ.length >= 4) {
      const latestEnd = epsQ[epsQ.length - 1].end;
      const ageDays = Math.round(
        (Date.now() - new Date(latestEnd).getTime()) / 86400000,
      );
      if (ageDays < 400) {
        epsTTM = epsQ.slice(-4).reduce((s, r) => s + r.val, 0);
      }
    }

    // 流通股数（最新）
    const so = dedupe(rowsOf(facts, 'CommonStockSharesOutstanding', 'shares'));
    const sharesOut = so.length ? so[so.length - 1].val : null;

    const asOf = rev.length ? rev[rev.length - 1].end.slice(0, 10) : null;
    if (revenueLatest == null && epsTTM == null && sharesOut == null) return done(unavailable);
    return done({
      symbol: symbol.toUpperCase(),
      cik: cikNoZero(cik10),
      revenueLatest,
      revenueYoY,
      epsTTM,
      sharesOut,
      asOf,
    });
  } catch (e) {
    console.error('[api/fundamentals]', symbol, e);
    return done(unavailable);
  }
}

/** price 每次都重新算（缓存里不存价格相关结果） */
function withPrice(d: any, price: number | null) {
  if (d.unavailable || price == null || !Number.isFinite(price) || price <= 0) {
    if (d.unavailable) return d;
    return { ...d, peTTM: null, marketCap: null };
  }
  const peTTM = d.epsTTM != null && d.epsTTM > 0 ? price / d.epsTTM : null;
  const marketCap = d.sharesOut != null ? price * d.sharesOut : null;
  return { ...d, peTTM, marketCap, price };
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const symbol = (q.get('symbol') || '').trim().toUpperCase();
  const price = q.get('price') ? Number(q.get('price')) : null;
  if (!symbol) return NextResponse.json({ unavailable: true });
  const data = await fundamentalsFor(symbol, price);
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}
