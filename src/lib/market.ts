// 全 app 共享的行情缓存：今日 / 持仓走同一份数据，同一 symbol+range 只发一次请求。
// 数据仍由 /api/rhythm 按 symbol 拉取（服务端一次拉全年、按区间切片），
// 这里只做客户端去重 + 短期缓存 + 手动失效。

import type { RhythmResponse } from './rhythm';
import { getAHPrint, saveAHPrint } from './ahCache';
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
  const s = data.series;
  if (s.length < 2) return null;
  const prev = s[s.length - 2].close;
  const last = s[s.length - 1].close;
  if (!prev) return null;
  return +((((last - prev) / prev) * 100).toFixed(2));
}

/**
 * 夜盘冻结价顶替：美东 20:00 后 Nasdaq 不再更新报价，后端只能报 close + 常规收盘价；
 * 若本机在盘后见过当天最后一笔夜盘价，用冻结价显示（跟券商 App 一样：冻结价 + 时间戳）。
 * 生效条件：缓存的交易日 == 日线最后一根的日期（第二天开盘/有新 bar 后自动失效）。
 * 返回的 session 为 'after-hours-frozen'：前端显示琥珀色"盘后"但不轮询（价格不会再变）。
 */
function applyFrozenAH(symbol: string, json: RhythmResponse): RhythmResponse {
  if (json.priceSession === 'after-hours') {
    if (json.priceTime) saveAHPrint(symbol, json.price, json.dayChangePct, json.priceTime);
    return json;
  }
  if (json.priceSession !== 'close') return json;
  const entry = getAHPrint(symbol);
  const s = json.series;
  const dailyLastDate = s.length > 0 ? s[s.length - 1].date : '';
  if (!entry || !dailyLastDate || entry.etDate !== dailyLastDate) return json;
  const first = s.length > 0 ? s[0].close : 0;
  const changePct =
    first > 0 ? +(((entry.price - first) / first) * 100).toFixed(2) : json.changePct;
  const slicePos =
    json.high > json.low
      ? Math.round(
          Math.min(100, Math.max(0, ((entry.price - json.low) / (json.high - json.low)) * 100)),
        )
      : json.slicePos;
  return {
    ...json,
    price: entry.price,
    priceSession: 'after-hours-frozen',
    priceLive: true,
    priceTime: entry.time,
    dayChangePct: entry.pct,
    changePct,
    slicePos,
  };
}
