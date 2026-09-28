// GET /api/macro —— 「分母」指标：30Y / 10Y 美债收益率（FRED DGS30/DGS10，免费 key）
// 服务端缓存 6 小时（日度数据，不必频繁刷）。没有 FRED_API_KEY 时返回 ok:false，前端静默隐藏。
import { NextResponse } from 'next/server';

interface FredObs {
  date: string;
  value: string;
}

let cache: { at: number; payload: unknown } | null = null;
const TTL = 6 * 60 * 60 * 1000;

async function latestYield(seriesId: string, key: string): Promise<{ date: string; value: number } | null> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${seriesId}&api_key=${encodeURIComponent(key)}` +
    `&file_type=json&sort_order=desc&limit=10`;
  const r = await fetch(url, { next: { revalidate: 21600 } });
  if (!r.ok) throw new Error(`fred ${seriesId} ${r.status}`);
  const j = await r.json();
  const obs: FredObs[] = j?.observations || [];
  for (const o of obs) {
    const v = parseFloat(o.value);
    if (o.value !== '.' && Number.isFinite(v)) return { date: o.date, value: v };
  }
  return null;
}

/** 大白话解读：只描述分母贵贱，不下买卖结论 */
function noteFor(y30: number): string {
  if (y30 >= 5.5) return '22 年高位，分母很贵——这时候追高要更慎';
  if (y30 >= 5.0) return '分母偏贵，估值容易被往下压';
  if (y30 >= 4.5) return '分母中性偏贵，多看少动也挺好';
  return '分母温和，估值压力不大';
}

function fmtDateCN(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[2])}月${Number(m[3])}日`;
}

export async function GET() {
  const key = process.env.FRED_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, reason: 'no_key' });
  }
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json(cache.payload);
  }
  try {
    const [y30, y10] = await Promise.all([
      latestYield('DGS30', key),
      latestYield('DGS10', key),
    ]);
    if (!y30) throw new Error('no dgs30 data');
    const payload = {
      ok: true,
      y30: Math.round(y30.value * 100) / 100,
      y10: y10 ? Math.round(y10.value * 100) / 100 : null,
      date: y30.date,
      dateCN: fmtDateCN(y30.date),
      note: noteFor(y30.value),
    };
    cache = { at: Date.now(), payload };
    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json(
      { ok: false, reason: e instanceof Error ? e.message : 'fetch_failed' },
      { status: 502 },
    );
  }
}
