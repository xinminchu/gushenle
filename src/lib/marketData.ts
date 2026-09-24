// src/lib/marketData.ts — 服务端行情源
// 每个标的只拉一次多年日线，/api/rhythm 与 /api/accuracy 共用。
// 注意：本模块只在服务端使用（含 Node fetch 缓存）。

import type { RhythmPoint } from '@/lib/rhythm';

export type DataSource = 'nasdaq' | 'yahoo' | 'naver' | 'simulated';

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
  volume?: string; // "13,960,650"
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
      const vol = num(r.volume);
      series.push({
        date: `${m[3]}-${m[1]}-${m[2]}`,
        close: Number(close.toFixed(2)),
        // 缺失时回退为 close，保证 K线不断裂
        open: Number.isFinite(open) ? Number(open.toFixed(2)) : Number(close.toFixed(2)),
        high: Number.isFinite(high) ? Number(high.toFixed(2)) : Number(close.toFixed(2)),
        low: Number.isFinite(low) ? Number(low.toFixed(2)) : Number(close.toFixed(2)),
        // 筹码分布用：Nasdaq 的 volume 如 "13,960,650"
        ...(vol > 0 ? { volume: vol } : {}),
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
      volume: (number | null)[];
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
          ...(quotes.volume?.[i] != null && quotes.volume[i]! > 0 ? { volume: quotes.volume[i]! } : {}),
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

/* ---------- Naver 财经（韩股专用；Nasdaq 不覆盖 KRX，Yahoo 对机房 IP 限流） ---------- */

/** 首尔当前时间（KRX 交易时间判断用） */
function seoulNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
}

function fmtDT(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}000000`;
}

interface NaverDayRow {
  localDate: string; // "20240102"
  closePrice: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  accumulatedTradingVolume?: number;
}

/** Naver 韩股多年日线：symbol 如 000660.KS -> Naver 代码 000660 */
async function fetchNaverFull(symbol: string): Promise<RhythmPoint[]> {
  const code = symbol.split('.')[0];
  if (!/^\d{6}$/.test(code)) throw new Error('not a KRX code');
  const end = seoulNow();
  const start = new Date(end);
  start.setDate(start.getDate() - 1100);
  const url =
    `https://api.stock.naver.com/chart/domestic/item/${code}/day` +
    `?startDateTime=${fmtDT(start)}&endDateTime=${fmtDT(end)}&timeframe=day`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Naver status ${res.status}`);
  const arr = (await res.json()) as NaverDayRow[];
  if (!Array.isArray(arr) || arr.length < 2) throw new Error('bad Naver payload');
  const series: RhythmPoint[] = [];
  for (const r of arr) {
    if (!r?.localDate || !Number.isFinite(r.closePrice) || r.closePrice <= 0) continue;
    series.push({
      date: `${r.localDate.slice(0, 4)}-${r.localDate.slice(4, 6)}-${r.localDate.slice(6, 8)}`,
      close: r.closePrice,
      open: Number.isFinite(r.openPrice) ? r.openPrice : r.closePrice,
      high: Number.isFinite(r.highPrice) ? r.highPrice : r.closePrice,
      low: Number.isFinite(r.lowPrice) ? r.lowPrice : r.closePrice,
      ...(r.accumulatedTradingVolume != null && r.accumulatedTradingVolume > 0
        ? { volume: r.accumulatedTradingVolume }
        : {}),
    });
  }
  if (series.length < 2) throw new Error('Naver returned too few points');
  return series;
}

/** KRX 是否开盘中（周一~周五 09:00~15:30 KST） */
function isKrxOpen(): boolean {
  const n = seoulNow();
  const day = n.getDay();
  if (day === 0 || day === 6) return false;
  const mins = n.getHours() * 60 + n.getMinutes();
  return mins >= 9 * 60 && mins < 15 * 60 + 30;
}

interface NaverMinRow {
  localDateTime: string;
  currentPrice: number;
  openPrice: number;
}

/** Naver 韩股实时价：当天分钟线最后一点；失败返回 null（静默降级为日线收盘价） */
async function getNaverLiveQuote(code: string): Promise<LiveQuote | null> {
  try {
    const n = seoulNow();
    const p2 = (v: number) => String(v).padStart(2, '0');
    const day = `${n.getFullYear()}${p2(n.getMonth() + 1)}${p2(n.getDate())}`;
    const url =
      `https://api.stock.naver.com/chart/domestic/item/${code}/minute` +
      `?startDateTime=${day}000000&endDateTime=${day}235959&timeframe=minute`;
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as NaverMinRow[];
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const last = arr[arr.length - 1];
    const price = Number(last.currentPrice);
    if (!Number.isFinite(price) || price <= 0) return null;
    const open = Number(arr[0].openPrice) || price;
    return {
      price,
      dayChangePct: Number((((price - open) / open) * 100).toFixed(2)),
      time: String(last.localDateTime || ''),
      marketOpen: isKrxOpen(),
    };
  } catch {
    return null;
  }
}

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
  if (key.endsWith('.KS')) {
    // 韩股：Nasdaq 不覆盖，直接走 Naver，失败再试 Yahoo
    try {
      series = await fetchNaverFull(key);
      source = 'naver';
    } catch (e1) {
      errors.naver = e1 instanceof Error ? e1.message : String(e1);
      try {
        series = await fetchYahooFull(key);
        source = 'yahoo';
      } catch (e2) {
        errors.yahoo = e2 instanceof Error ? e2.message : String(e2);
      }
    }
  } else {
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
  const key = symbol.toUpperCase();
  // 韩股走 Naver 分钟线
  if (key.endsWith('.KS')) {
    const code = key.split('.')[0];
    if (/^\d{6}$/.test(code)) return getNaverLiveQuote(code);
    return null;
  }
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
      next: { revalidate: 30 },
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
