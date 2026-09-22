// 全 app 共享的行情缓存：今日 / 持仓走同一份数据，同一 symbol+range 只发一次请求。
// 数据仍由 /api/rhythm 按 symbol 拉取（服务端一次拉全年、按区间切片），
// 这里只做客户端去重 + 短期缓存 + 手动失效。

import type { RhythmResponse } from './rhythm';

const cache = new Map<string, { data: RhythmResponse; fetchedAt: number }>();
const inflight = new Map<string, Promise<RhythmResponse>>();

/** 缓存有效期：5 分钟（与服务端 Vercel 缓存对齐） */
const TTL_MS = 5 * 60 * 1000;

export function getRhythm(symbol: string, range: string): Promise<RhythmResponse> {
  const key = `${symbol}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
    return Promise.resolve(hit.data);
  }
  const ongoing = inflight.get(key);
  if (ongoing) return ongoing;

  const p = fetch(`/api/rhythm?symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`rhythm api ${res.status}`);
      return res.json() as Promise<RhythmResponse>;
    })
    .then((json) => {
      cache.set(key, { data: json, fetchedAt: Date.now() });
      inflight.delete(key);
      return json;
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
