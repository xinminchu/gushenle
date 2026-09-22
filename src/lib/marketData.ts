// src/lib/marketData.ts — 服务端行情源
// 每个标的只拉一次多年日线，/api/rhythm 与 /api/accuracy 共用。
// 注意：本模块只在服务端使用（含 Node fetch 缓存）。

import type { RhythmPoint } from '@/lib/rhythm';

export type DataSource = 'nasdaq' | 'yahoo' | 'simulated';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** 各标的的基准价：兜底模拟曲线用，保证价格看起来真实 */
const BASE_PRICES: Record<string, number> = {
  AAPL: 228.45,
  NVDA: 118.2,
  TSLA: 238.1,
  MSFT: 432.6,
  COIN: 201.05,
  MSTR: 168.5,
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/* ---------- 确定性随机数：兜底数据每天、每标的全网一致 ---------- */

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 全部真实源都不可用时的兜底：生成多年确定性模拟日线 */
function simulatedFull(symbol: string): RhythmPoint[] {
  const base = BASE_PRICES[symbol] ?? 150;
  const rand = mulberry32(hashSeed(`${symbol}:${isoDate(new Date())}`));
  const points = 780; // ~3 年
  const now = Date.now();
  const series: RhythmPoint[] = [];
  let price = base * 0.96;
  for (let i = points - 1; i >= 0; i--) {
    price = price * (1 + (Math.sin(i * 0.7) * 0.5 + (rand() - 0.48)) * 0.02);
    series.push({
      date: isoDate(new Date(now - i * 86400000)),
      close: Number(price.toFixed(2)),
    });
  }
  return series;
}

/* ---------- 真实数据源（多年日线） ---------- */

interface NasdaqRow {
  date: string; // "09/21/2026"
  close: string; // "$338.98"
}

interface NasdaqResponse {
  data?: {
    tradesTable?: {
      rows?: NasdaqRow[];
    };
  };
}

/** Nasdaq 官方历史日线（无需 key），作为首选源 */
async function fetchNasdaqFull(symbol: string): Promise<RhythmPoint[]> {
  const from = isoDate(new Date(Date.now() - 1100 * 86400000)); // 约 3 年
  const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(
    symbol,
  )}/historical?assetclass=stocks&fromdate=${from}&limit=9999`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Nasdaq status ${res.status}`);
  const json = (await res.json()) as NasdaqResponse;
  const rows = json.data?.tradesTable?.rows;
  if (!rows || rows.length < 2) throw new Error('bad Nasdaq payload');
  const series: RhythmPoint[] = [];
  // rows 是倒序（最新在前），翻转成正序
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(r.date || '');
    const close = Number((r.close || '').replace(/[$,]/g, ''));
    if (m && Number.isFinite(close)) {
      series.push({ date: `${m[3]}-${m[1]}-${m[2]}`, close: Number(close.toFixed(2)) });
    }
  }
  if (series.length < 2) throw new Error('Nasdaq returned too few points');
  return series;
}

interface YahooChartResult {
  timestamp: number[];
  indicators: {
    quote: Array<{ close: (number | null)[] }>;
  };
}

interface YahooChartResponse {
  chart: {
    result?: YahooChartResult[];
    error?: { code: string; description: string };
  };
}

/** Yahoo Finance 多年日线（备用源；对机房 IP 偶发 429，失败自动重试一次） */
async function fetchYahooFull(symbol: string): Promise<RhythmPoint[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?range=3y&interval=1d`;
  const attempt = async (): Promise<RhythmPoint[]> => {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Yahoo status ${res.status}`);
    const json = (await res.json()) as YahooChartResponse;
    const result = json.chart?.result?.[0];
    if (!result?.timestamp || !result.indicators?.quote?.[0]) {
      throw new Error(json.chart?.error?.description || 'bad Yahoo payload');
    }
    const quotes = result.indicators.quote[0];
    const series: RhythmPoint[] = [];
    for (let i = 0; i < result.timestamp.length; i++) {
      const close = quotes.close[i];
      if (close != null) {
        series.push({
          date: isoDate(new Date(result.timestamp[i] * 1000)),
          close: Number(close.toFixed(2)),
        });
      }
    }
    if (series.length < 2) throw new Error('Yahoo returned too few points');
    return series;
  };
  try {
    return await attempt();
  } catch (e) {
    await new Promise((r) => setTimeout(r, 1500));
    return await attempt();
  }
}

// 按标的缓存全量日线（单实例内存；跨实例靠上面 fetch 的 Vercel Data Cache）
const cache = new Map<
  string,
  { series: RhythmPoint[]; source: DataSource; expires: number }
>();

/** 获取某标的的全量日线（带缓存），各 API 共用 */
export async function getFullSeries(symbol: string): Promise<{
  series: RhythmPoint[];
  source: DataSource;
  errors: Record<string, string>;
}> {
  const key = symbol.toUpperCase();
  const entry = cache.get(key);
  if (entry && entry.expires > Date.now()) {
    return { series: entry.series, source: entry.source, errors: {} };
  }
  const errors: Record<string, string> = {};
  let series: RhythmPoint[] | null = null;
  let source: DataSource = 'simulated';
  try {
    series = await fetchNasdaqFull(key);
    source = 'nasdaq';
  } catch (e1) {
    errors.nasdaq = e1 instanceof Error ? e1.message : String(e1);
    try {
      series = await fetchYahooFull(key);
      source = 'yahoo';
    } catch (e2) {
      errors.yahoo = e2 instanceof Error ? e2.message : String(e2);
    }
  }
  if (!series) {
    series = simulatedFull(key);
    console.error(`All sources failed for ${key}:`, errors);
  }
  cache.set(key, { series, source, expires: Date.now() + 60_000 });
  return { series, source, errors };
}
