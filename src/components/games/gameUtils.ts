'use client';

import { loadColorScheme } from '../../lib/colorScheme';
import { STOCK_LIST } from '../../lib/stockList';

/**
 * 小游戏共享工具：自选列表读取、K 线数据拉取归一化、canvas K 线绘制。
 * 新游戏复用，避免各文件重复造轮子。
 */

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

const WATCH_KEY = 'gushenle:watchlist:v1';

export const DEFAULT_WATCH = [
  { symbol: 'AAPL', name: '苹果' },
  { symbol: 'NVDA', name: '英伟达' },
  { symbol: 'MSFT', name: '微软' },
  { symbol: 'TSLA', name: '特斯拉' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'MSTR', name: '微策略' },
];

export function readWatchlist(): { symbol: string; name: string }[] {
  try {
    const raw = localStorage.getItem(WATCH_KEY);
    if (!raw) return DEFAULT_WATCH;
    const j = JSON.parse(raw);
    const items = Array.isArray(j?.items) ? j.items : [];
    const cleaned = items
      .filter((it: unknown) => it && typeof (it as { symbol?: unknown }).symbol === 'string')
      .map((it: { symbol: string; name?: string }) => ({
        symbol: it.symbol.toUpperCase(),
        name: it.name || it.symbol.toUpperCase(),
      }));
    return cleaned.length > 0 ? cleaned : DEFAULT_WATCH;
  } catch {
    return DEFAULT_WATCH;
  }
}

export function normalizeSeries(raw: unknown[]): Candle[] {
  return (raw || [])
    .filter(
      (k) =>
        k &&
        typeof (k as { close?: unknown }).close === 'number' &&
        typeof (k as { date?: unknown }).date === 'string',
    )
    .map((k) => {
      const c = k as { date: string; open?: number; high?: number; low?: number; close: number };
      const close = c.close;
      return {
        date: c.date,
        open: typeof c.open === 'number' ? c.open : close,
        high: typeof c.high === 'number' ? c.high : close,
        low: typeof c.low === 'number' ? c.low : close,
        close,
      };
    });
}

/** 拉某只股票全部历史 K 线；失败返回 null（调用方用兜底）。 */
export async function fetchSeries(symbol: string): Promise<Candle[] | null> {
  try {
    const r = await fetch(`/api/rhythm?symbol=${encodeURIComponent(symbol)}&range=ALL`);
    const j = (await r.json()) as { series?: unknown[] };
    const s = normalizeSeries(j.series || []);
    return s.length >= 30 ? s : null;
  } catch {
    return null;
  }
}

/** 本地兜底：随机生成 n 根 K 线（日期倒推至今天） */
export function syntheticCandles(n: number): Candle[] {
  const out: Candle[] = [];
  let price = 80 + Math.random() * 120;
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const open = price;
    const drift = (Math.random() - 0.47) * price * 0.04;
    const close = Math.max(1, open + drift);
    const high = Math.max(open, close) * (1 + Math.random() * 0.015);
    const low = Math.min(open, close) * (1 - Math.random() * 0.015);
    out.push({ date: d.toISOString().slice(0, 10), open, high, low, close });
    price = close;
  }
  return out;
}

export const shortDate = (d: string) => d.slice(5).replace('-', '/'); // MM/DD

export const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;

/** 涨跌色：跟随全站设置，默认绿涨红跌 */
export function bullBearColors(): { up: string; down: string } {
  try {
    return loadColorScheme() === 'cn'
      ? { up: '#ef4444', down: '#22c55e' }
      : { up: '#22c55e', down: '#ef4444' };
  } catch {
    return { up: '#22c55e', down: '#ef4444' };
  }
}

export interface DrawCandleOpts {
  /** 高亮区间 [from, to]（如下跌决策点之后），用半透明遮罩标出 */
  highlightFrom?: number;
  /** 垂直标记线位置（如下跌决策点） */
  markerAt?: number;
  markerLabel?: string;
}

/** 在 canvas 上画 K 线；canvas 用 CSS 宽度，内部按 DPR 缩放。 */
export function drawCandles(
  canvas: HTMLCanvasElement,
  candles: Candle[],
  opts: DrawCandleOpts = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || candles.length === 0) return;
  const dpr = 2;
  const W = canvas.clientWidth || 320;
  const H = canvas.clientHeight || 200;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const { up, down } = bullBearColors();
  let hi = -Infinity;
  let lo = Infinity;
  for (const c of candles) {
    hi = Math.max(hi, c.high);
    lo = Math.min(lo, c.low);
  }
  const pad = (hi - lo) * 0.08 || 1;
  hi += pad;
  lo -= pad;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const n = candles.length;
  const slot = W / n;
  const bw = Math.max(2, slot * 0.55);

  // 高亮区间底色
  if (opts.highlightFrom !== undefined && opts.highlightFrom < n) {
    ctx.fillStyle = 'rgba(56,189,248,0.08)';
    ctx.fillRect(opts.highlightFrom * slot, 0, W - opts.highlightFrom * slot, H);
  }

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const x = i * slot + slot / 2;
    const isUp = c.close >= c.open;
    ctx.strokeStyle = isUp ? up : down;
    ctx.fillStyle = isUp ? up : down;
    ctx.lineWidth = 1;
    // 影线
    ctx.beginPath();
    ctx.moveTo(x, y(c.high));
    ctx.lineTo(x, y(c.low));
    ctx.stroke();
    // 实体
    const yO = y(c.open);
    const yC = y(c.close);
    const top = Math.min(yO, yC);
    const hgt = Math.max(1, Math.abs(yO - yC));
    ctx.fillRect(x - bw / 2, top, bw, hgt);
  }

  // 决策标记线
  if (opts.markerAt !== undefined && opts.markerAt >= 0 && opts.markerAt < n) {
    const x = opts.markerAt * slot + slot / 2;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
    ctx.setLineDash([]);
    if (opts.markerLabel) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10px sans-serif';
      ctx.fillText(opts.markerLabel, Math.min(x + 4, W - 44), 12);
    }
  }
}

/** 简单折线图（定投/消息游戏用） */
export function drawLines(
  canvas: HTMLCanvasElement,
  series: { label: string; color: string; values: number[] }[],
  opts: { markerAt?: number; markerLabel?: string } = {},
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx || series.length === 0) return;
  const dpr = 2;
  const W = canvas.clientWidth || 320;
  const H = canvas.clientHeight || 200;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  let hi = -Infinity;
  let lo = Infinity;
  for (const s of series)
    for (const v of s.values) {
      hi = Math.max(hi, v);
      lo = Math.min(lo, v);
    }
  const pad = (hi - lo) * 0.1 || 1;
  hi += pad;
  lo -= pad;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i: number) => (n <= 1 ? 0 : (i / (n - 1)) * W);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;

  if (opts.markerAt !== undefined && opts.markerAt >= 0 && opts.markerAt < n) {
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(x(opts.markerAt), 0);
    ctx.lineTo(x(opts.markerAt), H);
    ctx.stroke();
    ctx.setLineDash([]);
    if (opts.markerLabel) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = '10px sans-serif';
      ctx.fillText(opts.markerLabel, Math.min(x(opts.markerAt) + 4, W - 60), 12);
    }
  }

  for (const s of series) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.values.forEach((v, i) => {
      if (i === 0) ctx.moveTo(x(i), y(v));
      else ctx.lineTo(x(i), y(v));
    });
    ctx.stroke();
  }
}

export interface BuyRevealItem {
  symbol: string;
  name: string;
  pct: number; // "昨日"涨跌幅
  next5: number; // 后 5 天涨跌幅
}

export interface BuyReveal {
  items: BuyRevealItem[];
  dayLabel: string;
  qqq5: number;
}

/**
 * 自选不足时用默认名单 + 精选股票库补齐到 n 只（按代码去重）。
 * 顺序：自选优先 → 默认名单 → 股票库随机打乱补充。
 * 掷骰子（6/12 只）、酒鬼走位（25 只）等"随机买入"类游戏用。
 */
export function fillPicks(n: number): { symbol: string; name: string }[] {
  const out: { symbol: string; name: string }[] = [];
  const seen = new Set<string>();
  const push = (symbol: string, name: string) => {
    const sym = symbol.toUpperCase();
    if (out.length >= n || seen.has(sym)) return;
    seen.add(sym);
    out.push({ symbol: sym, name });
  };
  for (const w of readWatchlist()) push(w.symbol, w.name);
  for (const w of DEFAULT_WATCH) push(w.symbol, w.name);
  // 股票库部分打乱，保证"不够的随机补充"
  const lib = [...STOCK_LIST];
  for (let i = lib.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lib[i], lib[j]] = [lib[j]!, lib[i]!];
  }
  for (const s of lib) {
    push(s.code, s.zh);
    if (out.length >= n) break;
  }
  return out;
}

let scanPoolCache: { symbol: string; name: string; score: number }[] | null = null;

/**
 * 取最新一次律动扫描的全量池（symbol/name/score），供"换一批"用。
 * 结果缓存，失败返回空数组（调用方自行降级）。
 */
export async function fetchScanPool(): Promise<{ symbol: string; name: string; score: number }[]> {
  if (scanPoolCache) return scanPoolCache;
  try {
    const r = await fetch('/api/market-scan?pool=1');
    const j = (await r.json()) as {
      ok?: boolean;
      pool?: { symbol: string; name: string; score: number }[];
    };
    if (j.ok && Array.isArray(j.pool)) {
      scanPoolCache = j.pool;
      return scanPoolCache;
    }
  } catch {
    /* 降级：返回空 */
  }
  return [];
}

/**
 * 通用"买入揭晓"数据准备：随机挑历史某一天当"昨日"，
 * 算每只候选的昨日涨跌 + 后 5 天涨跌 + QQQ 后 5 天。
 * 供"随机买入"类游戏共用（飞镖/骰子/酒鬼走位逻辑同源）。
 * 数据没拉全时返回 null。
 */
export async function prepareBuyReveal(
  picks: { symbol: string; name: string }[],
): Promise<BuyReveal | null> {
  if (picks.length < 3) return null;
  const all = await Promise.all([...picks.map((w) => fetchSeries(w.symbol)), fetchSeries('QQQ')]);
  const qqqSeries = all[all.length - 1];
  const items: { w: { symbol: string; name: string }; s: Candle[] }[] = [];
  picks.forEach((w, i) => {
    if (all[i] && all[i]!.length >= 60) items.push({ w, s: all[i]! });
  });
  if (items.length < 3 || !qqqSeries || qqqSeries.length < 60) return null;
  const maps = items.map(({ s }) => {
    const m = new Map<string, number>();
    s.forEach((c, i) => m.set(c.date, i));
    return m;
  });
  const qMap = new Map<string, number>();
  qqqSeries.forEach((c, i) => qMap.set(c.date, i));
  const base = items[0].s;
  for (let t = 0; t < 30; t++) {
    const i = 10 + Math.floor(Math.random() * (base.length - 20));
    const D = base[i].date;
    const idxs = items.map(({ s }, k) => {
      const j = maps[k].get(D);
      return j === undefined || j < 1 || j + 5 >= s.length ? -1 : j;
    });
    const qj = qMap.get(D);
    if (idxs.some((j) => j < 0) || qj === undefined || qj < 1 || qj + 5 >= qqqSeries.length) continue;
    return {
      items: items.map(({ w, s }, k) => {
        const j = idxs[k];
        return {
          symbol: w.symbol,
          name: w.name,
          pct: s[j].close / s[j - 1].close - 1,
          next5: s[j + 5].close / s[j].close - 1,
        };
      }),
      dayLabel: D,
      qqq5: qqqSeries[qj + 5].close / qqqSeries[qj].close - 1,
    };
  }
  return null;
}
