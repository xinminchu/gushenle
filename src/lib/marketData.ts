// src/lib/marketData.ts — 服务端行情源
// 每个标的只拉一次多年日线，/api/rhythm 与 /api/accuracy 共用。
// 注意：本模块只在服务端使用（含 Node fetch 缓存）。

import type { RhythmPoint } from '@/lib/rhythm';

export type DataSource = 'nasdaq' | 'yahoo' | 'naver' | 'fred' | 'coinbase' | 'simulated';

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

/** 全部真实源都不可用时的兜底：生成多年确定性模拟日线（含 OHLC，供 K线用）
 * 种子只用 symbol（不用日期）：同一只股票每天看到同一条假走势，
 * 避免"昨天一个样今天一个样"制造假转折信号。2026-10-09 修。 */
function simulatedFull(symbol: string): RhythmPoint[] {
  const base = BASE_PRICES[symbol] ?? 150;
  const rand = mulberry32(hashSeed(symbol));
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

/* ---------- FRED（美联储经济数据；宏观品种专用，需 FRED_API_KEY） ---------- */
// 免费 key：https://fred.stlouisfed.org/docs/api/api_key.html 注册 2 分钟即得
const FRED_MAP: Record<string, string> = {
  'CL=F': 'DCOILWTICO', // WTI 原油
  'BZ=F': 'DCOILBRENTEU', // Brent 原油
  'GC=F': 'GOLDAMGBD228NLBM', // 黄金
  'SI=F': 'SILVERAMGBD228NLBM', // 白银（若无则降级）
  'HG=F': 'PCOPPUSDM', // 铜
  'NG=F': 'DHHNGSP', // 天然气（Henry Hub 现货）
  '^TNX': 'DGS10', // 10年期美债收益率
  '^VIX': 'VIXCLS', // VIX
  'DX-Y.NYB': 'DTWEXBGS', // 美元指数
};

async function fetchFred(symbol: string): Promise<RhythmPoint[]> {
  const apiKey = process.env.FRED_API_KEY;
  if (!apiKey) throw new Error('FRED_API_KEY 未配置');
  const seriesId = FRED_MAP[symbol];
  if (!seriesId) throw new Error(`FRED 无映射: ${symbol}`);
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 3);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const url =
    `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}` +
    `&observation_start=${fmt(start)}&observation_end=${fmt(end)}` +
    `&file_type=json&api_key=${apiKey}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED status ${res.status}`);
  const json = (await res.json()) as {
    observations?: { date: string; value: string }[];
  };
  const obs = json.observations || [];
  const series: RhythmPoint[] = [];
  for (const o of obs) {
    const v = parseFloat(o.value);
    if (isNaN(v)) continue; // FRED 用 "." 表示缺失
    series.push({
      date: o.date,
      close: Number(v.toFixed(2)),
      open: Number(v.toFixed(2)),
      high: Number(v.toFixed(2)),
      low: Number(v.toFixed(2)),
    });
  }
  if (series.length < 2) throw new Error('FRED returned too few points');
  return series;
}

/* ---------- Coinbase（加密货币免 key；BTC 等） ---------- */
async function fetchCoinbase(symbol: string): Promise<RhythmPoint[]> {
  // symbol 如 BTC-USD -> Coinbase product BTC-USD
  const product = symbol.toUpperCase();
  if (!/^[A-Z]{2,10}-USD$/.test(product)) throw new Error('bad crypto symbol');
  const url = `https://api.exchange.coinbase.com/products/${product}/candles?granularity=86400`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Coinbase status ${res.status}`);
  const json = (await res.json()) as number[][];
  if (!Array.isArray(json) || json.length < 2) throw new Error('Coinbase returned too few points');
  // 返回 [timestamp, low, high, open, close, volume]，按时间倒序
  const series: RhythmPoint[] = [];
  for (const c of json) {
    const [ts, low, high, open, close] = c;
    series.push({
      date: isoDate(new Date(ts * 1000)),
      close: Number(close.toFixed(2)),
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
    });
  }
  series.sort((a, b) => (a.date < b.date ? -1 : 1));
  return series;
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
      marketStatus: '',
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
  const isMacroFuture = key in FRED_MAP;
  const isCrypto = /-USD$/i.test(key);
  if (isMacroFuture) {
    // 宏观期货/指数：FRED（美联储官方，需 key）；Yahoo 从机房 IP 被限，不可用
    try {
      series = await fetchFred(key);
      source = 'fred';
    } catch (e1) {
      errors.fred = e1 instanceof Error ? e1.message : String(e1);
    }
  } else if (isCrypto) {
    // 加密货币：Coinbase（免 key）
    try {
      series = await fetchCoinbase(key);
      source = 'coinbase';
    } catch (e1) {
      errors.coinbase = e1 instanceof Error ? e1.message : String(e1);
      try {
        series = await fetchYahooFull(key);
        source = 'yahoo';
      } catch (e2) {
        errors.yahoo = e2 instanceof Error ? e2.message : String(e2);
      }
    }
  } else if (key.endsWith('.KS')) {
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
  /** Nasdaq 原始 marketStatus：'Open' | 'After-Hours' | 'Pre-Market' | 'Closed' 等 */
  marketStatus: string;
}

/** 展示价的会话来源：实时 / 盘后 / 盘前 / 日线收盘 */
export type PriceSession = 'live' | 'after-hours' | 'pre-market' | 'close';

const MONTH_NUM: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

/**
 * 从报价时间串里抠出美东日历日期（YYYY-MM-DD）。
 * Nasdaq 格式如 "Sep 28, 2026 7:59 PM ET" 或 "Sep 28, 2026"；串里已经是美东时间，直接取日期部分，
 * 不做时区换算。解析失败返回 null（调用方按"不比日线新"处理）。
 */
export function quoteDateISO(time: string): string | null {
  const m = /([A-Za-z]{3})\s+(\d{1,2}),\s+(\d{4})/.exec(time || '');
  if (!m) return null;
  const mon = MONTH_NUM[m[1]];
  if (!mon) return null;
  return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`;
}

/**
 * 展示价选择（各页面共用，口径一致）：
 * ① 盘中用实时价；② 盘后用报价接口（夜盘价）；③ 盘前用报价接口（盘前价）；
 * ④ 收盘后~日线发布今日 bar 之前（约美东 20:00~次日），报价接口已有今日常规收盘价
 *    （如 SKHY 周一 21:56 ET 时报价 $181.92，日线还停在上周五 $191.56），此时也用报价，
 *    否则页面会整晚停在上一个交易日的收盘价。
 * 诊断（judgment）永远走日线收盘序列，不受影响。
 */
export function pickDisplayPrice(
  dailyLastClose: number,
  dailyLastDate: string,
  live: LiveQuote | null,
): { price: number; session: PriceSession } {
  const quoteOk = !!live && live.price > 0;
  const afterHours =
    quoteOk && !live!.marketOpen && live!.marketStatus === 'After-Hours';
  const preMarket =
    quoteOk && !live!.marketOpen && live!.marketStatus === 'Pre-Market';
  const qDate = quoteOk ? quoteDateISO(live!.time) : null;
  const quoteFresher = !!(qDate && dailyLastDate && qDate > dailyLastDate);
  const useQuote =
    quoteOk && (live!.marketOpen || afterHours || preMarket || quoteFresher);
  const session: PriceSession = !useQuote
    ? 'close'
    : live!.marketOpen
      ? 'live'
      : afterHours
        ? 'after-hours'
        : preMarket
          ? 'pre-market'
          : 'close';
  return { price: useQuote ? live!.price : dailyLastClose, session };
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
      marketStatus: String(data?.marketStatus || ''),
    };
  } catch {
    return null;
  }
}
