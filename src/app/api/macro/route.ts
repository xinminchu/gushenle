// GET /api/macro —— 「分母」指标：30Y / 10Y 美债收益率（FRED DGS30/DGS10，免费 key）
// + 「市场情绪」：VIX（FRED VIXCLS，需 key）与 CNN 贪婪指数（免 key，浏览器头）。
// 服务端缓存 6 小时（日度数据，不必频繁刷）。取不到就字段为 null，前端静默隐藏。
import { NextResponse } from 'next/server';

interface FredObs {
  date: string;
  value: string;
}

let cache: { at: number; payload: unknown } | null = null;
const TTL = 6 * 60 * 60 * 1000;

async function fredLatest(seriesId: string, key: string): Promise<{ date: string; value: number } | null> {
  const url =
    `https://api.stlouisfed.org/fred/series/observations` +
    `?series_id=${seriesId}&api_key=${encodeURIComponent(key)}` +
    `&file_type=json&sort_order=desc&limit=10`;
  const r = await fetch(url, { next: { revalidate: 21600 }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`fred ${seriesId} ${r.status}`);
  const j = await r.json();
  const obs: FredObs[] = j?.observations || [];
  for (const o of obs) {
    const v = parseFloat(o.value);
    if (o.value !== '.' && Number.isFinite(v)) return { date: o.date, value: v };
  }
  return null;
}

/** CNN 贪婪指数：内部接口，需带浏览器头否则 418 */
async function fearGreed(): Promise<{ score: number; rating: string; date: string } | null> {
  const r = await fetch('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      Accept: 'application/json',
      Referer: 'https://www.cnn.com/markets/fear-and-greed',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return null;
  const j = await r.json();
  const fg = j?.fear_and_greed;
  if (!fg || !Number.isFinite(fg.score)) return null;
  const ts: string = fg.timestamp || '';
  return { score: Math.round(fg.score * 10) / 10, rating: String(fg.rating || 'neutral'), date: ts.slice(0, 10) };
}

/** 大白话解读：只描述分母贵贱，不下买卖结论 */
function noteFor(y30: number): string {
  if (y30 >= 5.5) return '22 年高位，分母很贵——这时候追高要更慎';
  if (y30 >= 5.0) return '分母偏贵，估值容易被往下压';
  if (y30 >= 4.5) return '分母中性偏贵，多看少动也挺好';
  return '分母温和，估值压力不大';
}

function noteForEn(y30: number): string {
  if (y30 >= 5.5) return 'Near 22-year highs — the denominator is pricey. Be extra careful chasing here';
  if (y30 >= 5.0) return 'Denominator on the pricey side — valuations get pressed down';
  if (y30 >= 4.5) return 'Denominator neutral-to-pricey — watching more and doing less is fine';
  return 'Denominator mild — little valuation pressure';
}

function fmtDateCN(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  return `${Number(m[2])}月${Number(m[3])}日`;
}

function fmtDateEn(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthEn[Number(m[2]) - 1]} ${Number(m[3])}`;
}

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json(cache.payload);
  }
  const key = process.env.FRED_API_KEY;

  // 分母（需 FRED key）
  const denom: Record<string, unknown> = { ok: false };
  if (key) {
    try {
      const [y30, y10] = await Promise.all([
        fredLatest('DGS30', key),
        fredLatest('DGS10', key),
      ]);
      if (y30) {
        Object.assign(denom, {
          ok: true,
          y30: Math.round(y30.value * 100) / 100,
          y10: y10 ? Math.round(y10.value * 100) / 100 : null,
          date: y30.date,
          dateCN: fmtDateCN(y30.date),
          dateEn: fmtDateEn(y30.date),
          note: noteFor(y30.value),
          noteEn: noteForEn(y30.value),
        });
      }
    } catch {
      // 分母取不到就空着，情绪条照常
    }
  } else {
    denom.reason = 'no_key';
  }

  // 市场情绪：VIX（需 key）+ CNN 贪婪指数（免 key）
  let vix: { date: string; value: number } | null = null;
  if (key) {
    try {
      vix = await fredLatest('VIXCLS', key);
    } catch {
      vix = null;
    }
  }
  const fg = await fearGreed().catch(() => null);
  const sentiment =
    vix || fg
      ? {
          vix: vix ? Math.round(vix.value * 100) / 100 : null,
          vixDate: vix ? vix.date : null,
          vixDateCN: vix ? fmtDateCN(vix.date) : null,
          vixDateEn: vix ? fmtDateEn(vix.date) : null,
          fearGreed: fg ? fg.score : null,
          fearGreedRating: fg ? fg.rating : null,
          fearGreedDate: fg ? fg.date : null,
          fearGreedDateCN: fg ? fmtDateCN(fg.date) : null,
          fearGreedDateEn: fg ? fmtDateEn(fg.date) : null,
        }
      : null;

  const payload = { ...denom, sentiment };
  cache = { at: Date.now(), payload };
  return NextResponse.json(payload);
}
