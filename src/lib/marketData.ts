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

/** 全部真实源都不可用时的兜底：生成多年确定性模拟日线（含 OHLC，供 K线用） */
function simulatedFull(symbol: string): RhythmPoint[] {
  const base = BASE_PRICES[symbol] ?? 150;
  const rand = mulberry32(hashSeed(`${symbol}:${isoDate(new Date())}`));
  const points = 780; // ~3 年
  const now = Date.now();
  const series: RhythmPoint[] = [];
  let price = base * 0.96;
  for (let i = points - 1; i >= 0; i--) {
    price = price * (1 + (Math.sin(i * 0.7) * 0.5 + (rand() - 0.48)) * 0.02);
    const close = Number(price.toFixed(2));
    const open = Number((price * (1 + (rand() - 0.5) * 0.012)).toFixed(2));
    const high = Number((Math.max(open, close) * (1 + rand() * 0.008)).toFixed(2));
    const low = Number((Math.min(open, close) * (1 - rand() * 0.008)).toFixed(2));
    series.push({ date: isoDate(new Date(now - i * 86400000)), close, open, high, low });
  }
  return series;
}

/* ---------- 真实数据源（多年日线） ---------- */

interface NasdaqRow {
  date: string; // "09/21/2026"
  close: string; // "$338.98"
  open: string; // "$335.28"
  high: string; // "$339.64"
  low: string; // "$333.05"
}

interface NasdaqResponse {
  data?: {
    tradesTable?: {
      rows?: NasdaqRow[];
    };
  };
}

/** "$1,234.56" -> 1234.56 */
function num(s: string | undefined): number {
  return Number((s || '').replace(/[$,]/g, ''));
}

/** Nasdaq 官方历史日线（无需 key），作为首选源；带 open/high/low 供 K线用 */
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
    const close = num(r.close);
    if (m && Number.isFinite(close)) {
      const open = num(r.open);
      const high = num(r.high);
      const low = num(r.low);
      series.push({
        date: `${m[3]}-${m[1]}-${m[2]}`,
        close: Number(close.toFixed(2)),
        // 缺失时回退为 close，保证 K线不断裂
        open: Number.isFinite(open) ? Number(open.toFixed(2)) : Number(close.toFixed(2)),
        high: Number.isFinite(high) ? Number(high.toFixed(2)) : Number(close.toFixed(2)),
        low: Number.isFinite(low) ? Number(low.toFixed(2)) : Number(close.toFixed(2)),
      });
    }
  }
  if (series.length < 2) throw new Error('Nasdaq returned too few points');
  return series;
}

interface YahooChartResult {
  timestamp: number[];
  indicators: {
    quote: Array<{
      close: (number | null)[];
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
    }>;
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
  // query1 被限时换 query2 再试，两台主机限流通常不同步
  const hosts = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];
  let lastErr: unknown = null;
  for (const host of hosts) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(
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
        const c = Number(close.toFixed(2));
        const o = quotes.open[i];
        const h = quotes.high[i];
        const l = quotes.low[i];
        series.push({
          date: isoDate(new Date(result.timestamp[i] * 1000)),
          close: c,
          open: o != null ? Number(o.toFixed(2)) : c,
          high: h != null ? Number(h.toFixed(2)) : c,
          low: l != null ? Number(l.toFixed(2)) : c,
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
    try {
      return await attempt();
    } catch (e2) {
      lastErr = e2;
    }
  }
  } // end host loop
  throw lastErr instanceof Error ? lastErr : new Error('Yahoo all hosts failed');
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

export interface LiveQuote {
  price: number;
  /** 当日涨跌幅（%），相对昨收 */
  dayChangePct: number;
  /** 如 "Sep 23, 2026 11:37 AM ET" */
  time: string;
  marketOpen: boolean;
}

/**
 * Nasdaq 实时报价（盘中用）。
 * 日线接口在盘中拿不到今天的 bar（永远显示昨收），所以开盘期间用这个补实时价。
 * 失败返回 null，调用方静默降级为日线收盘价，不抛错。
 */
export async function getLiveQuote(symbol: string): Promise<LiveQuote | null> {
  try {
    const url = `https://api.nasdaq.com/api/quote/${encodeURIComponent(
      symbol.toUpperCase(),
    )}/info?assetclass=stocks`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    const p = data?.primaryData;
    const price = num(p?.lastSalePrice);
    if (!Number.isFinite(price) || price <= 0) return null;
    const dayChangePct = Number(String(p?.percentageChange || '').replace('%', ''));
    return {
      price: Number(price.toFixed(2)),
      dayChangePct: Number.isFinite(dayChangePct) ? Number(dayChangePct.toFixed(2)) : 0,
      time: String(p?.lastTradeTimestamp || ''),
      marketOpen: data?.marketStatus === 'Open',
    };
  } catch {
    return null;
  }
}
