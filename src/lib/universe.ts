/**
 * 全市场名单：public/stock-universe.json（Nasdaq 官方 screener，nasdaq+nyse+amex，
 * 约 7000 只，scripts/refresh-universe.mjs 生成）。
 * 懒加载：只在精选名单搜不到时才 fetch，不进主包。精选名单（带中文名）永远优先展示。
 */

export interface UniverseEntry {
  code: string;
  en: string;
  sector: string;
}

let cache: UniverseEntry[] | null = null;
let inflight: Promise<UniverseEntry[]> | null = null;

export function loadUniverse(): Promise<UniverseEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch('/stock-universe.json')
      .then((r) => {
        if (!r.ok) throw new Error(`universe HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const rows = (d?.stocks ?? []) as [string, string, string][];
        cache = rows.map(([code, en, sector]) => ({ code, en, sector }));
        return cache as UniverseEntry[];
      })
      .catch(() => {
        inflight = null;
        return [] as UniverseEntry[];
      });
  }
  return inflight;
}

/** 精确匹配一个代码（排除精选名单已有的） */
export function findInUniverse(
  all: UniverseEntry[],
  code: string,
  exclude: Set<string>,
): UniverseEntry | null {
  const s = code.trim().toUpperCase();
  if (!s || exclude.has(s)) return null;
  return all.find((e) => e.code === s) ?? null;
}

/**
 * 全市场搜索：代码前缀 > 代码包含 > 英文名包含。
 * 精选名单命中的代码通过 exclude 排除（精选优先展示中文名）。
 */
export function searchUniverse(
  all: UniverseEntry[],
  q: string,
  exclude: Set<string>,
  limit = 8,
): UniverseEntry[] {
  const s = q.trim().toUpperCase();
  if (s.length < 1) return [];
  const starts: UniverseEntry[] = [];
  const contains: UniverseEntry[] = [];
  const nameHit: UniverseEntry[] = [];
  for (const e of all) {
    if (exclude.has(e.code)) continue;
    if (e.code.startsWith(s)) {
      if (starts.length < limit) starts.push(e);
    } else if (e.code.includes(s)) {
      contains.push(e);
    } else if (e.en.toUpperCase().includes(s)) {
      nameHit.push(e);
    }
  }
  return [...starts, ...contains, ...nameHit].slice(0, limit);
}
