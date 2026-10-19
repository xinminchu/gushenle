// 全 app 共享的行情缓存：今日 / 持仓走同一份数据，同一 symbol+range 只发一次请求。
// 数据仍由 /api/rhythm 按 symbol 拉取（服务端一次拉全年、按区间切片），
// 这里只做客户端去重 + 短期缓存 + 手动失效。

import type { RhythmResponse } from './rhythm';
import type { Lang } from '@/lib/i18n';

const cache = new Map<string, { data: RhythmResponse; fetchedAt: number }>();
const inflight = new Map<string, Promise<RhythmResponse>>();

/** 缓存有效期：盘中实时价 60 秒（跟轮询对齐），收盘后 5 分钟 */
const TTL_LIVE_MS = 60 * 1000;
const TTL_CLOSED_MS = 5 * 60 * 1000;

/** 单次请求超时：弱网/老手机上连接 hang 住时不无限转圈 */
const FETCH_TIMEOUT_MS = 20 * 1000;
/** 超时或网络错时自动再试一次 */
const MAX_ATTEMPTS = 2;

function fetchWithTimeout(url: string): Promise<Response> {
  if (typeof AbortController === 'undefined') return fetch(url);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

export function getRhythm(
  symbol: string,
  range: string,
  opts?: { force?: boolean; lang?: Lang },
): Promise<RhythmResponse> {
  const lang = opts?.lang ?? 'zh';
  const key = `${symbol}:${range}:${lang}`;
  const hit = cache.get(key);
  if (!opts?.force && hit) {
    const ttl = hit.data.priceLive ? TTL_LIVE_MS : TTL_CLOSED_MS;
    if (Date.now() - hit.fetchedAt < ttl) return Promise.resolve(hit.data);
  }
  const ongoing = inflight.get(key);
  if (ongoing) return ongoing;

  const url = `/api/rhythm?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}&lang=${lang}`;
  const attempt = (n: number): Promise<RhythmResponse> =>
    fetchWithTimeout(url)
      .then((res) => {
        if (!res.ok) throw new Error(`rhythm api ${res.status}`);
        return res.json() as Promise<RhythmResponse>;
      })
      .catch((err) => {
        if (n < MAX_ATTEMPTS) return attempt(n + 1);
        throw err;
      });

  const p = attempt(1)
    .then((json) => {
      const fixed = applyFrozenAH(symbol, json);
      cache.set(key, { data: fixed, fetchedAt: Date.now() });
      inflight.delete(key);
      return fixed;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });
  inflight.set(key, p);
  return p;
}

/** 失效缓存：不传 symbol 则全清（如下拉刷新）；收盘后自动刷新时按 symbol 清。 */
export function invalidateRhythm(symbol?: string): void {
  if (!symbol) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(`${symbol}:`)) cache.delete(key);
  }
}

/** 日涨跌幅：用日线最后两个收盘价计算（持仓页用，不再另起接口）。 */
export function dayChangePct(data: RhythmResponse): number | null {
  // portfolio-2：盘中/盘后用服务端算好的实时涨跌幅（相对昨收），跟今日页同口径；
  // 只有纯收盘会话才回退到日线最后两根收盘价
  if (data.dayChangePct != null && data.priceSession !== 'close') return data.dayChangePct;
  const s = data.series;
  if (s.length < 2) return null;
  const prev = s[s.length - 2].close;
  const last = s[s.length - 1].close;
  if (!prev) return null;
  return +((((last - prev) / prev) * 100).toFixed(2));
}

/**
 * 夜盘冻结价顶替：已停用（2026-10-18）。
 * 停用原因：Nasdaq 的 /info 报价接口不提供真正的盘后价（isRealTime=False，
 * 无盘后字段，lastSalePrice 在盘后时段不更新）。此前在 marketStatus='After-Hours'
 * 时把常规收盘价误存为"盘后价"，导致周末显示的"盘后"价与券商真盘后价差 2-4%。
 * 收盘后一律显示日线收盘价（session='close'），不再伪装成盘后价。
 * 若未来接入真盘后数据源（如 Yahoo postMarket），可在此恢复。
 */
function applyFrozenAH(symbol: string, json: RhythmResponse): RhythmResponse {
  void symbol;
  return json;
}
