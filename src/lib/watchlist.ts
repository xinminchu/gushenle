// 自选列表：全 app 唯一的股票名单来源（今日 / 持仓共用）
// 用户未自定义时，使用默认推荐（科技巨头 + 加密概念股）；持久化在 localStorage。

import { CODE_CORRECTIONS, findStock } from './stockList';

export interface WatchlistItem {
  symbol: string;
  name: string;
}

export const DEFAULT_WATCHLIST: WatchlistItem[] = [
  { symbol: 'AAPL', name: '苹果' },
  { symbol: 'NVDA', name: '英伟达' },
  { symbol: 'MSFT', name: '微软' },
  { symbol: 'TSLA', name: '特斯拉' },
  { symbol: 'COIN', name: 'Coinbase' },
  { symbol: 'MSTR', name: '微策略' },
];

const STORAGE_KEY = 'gushenle:watchlist:v1';

export function loadWatchlist(): { items: WatchlistItem[]; customized: boolean } {
  if (typeof window === 'undefined') return { items: DEFAULT_WATCHLIST, customized: false };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { items: DEFAULT_WATCHLIST, customized: false };
    const parsed = JSON.parse(raw) as { items?: unknown; customized?: unknown };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return { items: DEFAULT_WATCHLIST, customized: false };
    }
    const items = (parsed.items as Array<{ symbol?: unknown; name?: unknown }>)
      .filter((i) => i && typeof i.symbol === 'string' && i.symbol.trim())
      .map((i) => {
        let sym = String(i.symbol).trim().toUpperCase();
        // 输错自愈：TESLA/APPLE/INTEL 这类常见输错自动纠正为正确代码
        if (CODE_CORRECTIONS[sym]) sym = CODE_CORRECTIONS[sym];
        const known = findStock(sym);
        const rawName = typeof i.name === 'string' && i.name.trim() ? i.name.trim() : '';
        return {
          symbol: sym,
          // 名字是输错代码自带的（如 APPLE APPLE）就换成正确的中文名
          name: rawName && rawName !== String(i.symbol).trim().toUpperCase() ? rawName : known?.zh || sym,
        };
      });
    // 纠正后去重（保留第一次出现）
    const seen = new Set<string>();
    const deduped = items.filter((it) => (seen.has(it.symbol) ? false : (seen.add(it.symbol), true)));
    if (deduped.length === 0) return { items: DEFAULT_WATCHLIST, customized: false };
    return { items: deduped, customized: !!parsed.customized };
  } catch {
    return { items: DEFAULT_WATCHLIST, customized: false };
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, customized: true }));
  } catch {
    // 存储失败时静默忽略，不阻塞使用
  }
}

export function resetWatchlist(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
