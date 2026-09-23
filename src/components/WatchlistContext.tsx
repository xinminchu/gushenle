'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  DEFAULT_WATCHLIST,
  loadWatchlist,
  saveWatchlist,
  resetWatchlist,
  type WatchlistItem,
} from '@/lib/watchlist';
import { symbolToName } from '@/lib/stockAliases';

interface WatchlistContextValue {
  items: WatchlistItem[];
  /** true = 当前是默认推荐，用户尚未自定义 */
  isDefault: boolean;
  addItem: (symbol: string, name?: string) => 'ok' | 'exists' | 'invalid';
  removeItem: (symbol: string) => void;
  resetToDefault: () => void;
  nameOf: (symbol: string) => string;
  /** 跨 tab 跳转：持仓页点某只 -> 今日页看它的诊断 */
  focusSymbol: string | null;
  setFocusSymbol: (s: string | null) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchlistItem[]>(DEFAULT_WATCHLIST);
  const [isDefault, setIsDefault] = useState(true);
  const [focusSymbol, setFocusSymbol] = useState<string | null>(null);

  useEffect(() => {
    const { items: loaded, customized } = loadWatchlist();
    setItems(loaded);
    setIsDefault(!customized);
  }, []);

  const persist = (next: WatchlistItem[]) => {
    setItems(next);
    setIsDefault(false);
    saveWatchlist(next);
  };

  const addItem = (symbol: string, name?: string): 'ok' | 'exists' | 'invalid' => {
    const sym = symbol.trim().toUpperCase();
    // 美股代码（如 AAPL）或数字代码（如韩股 000660.KS）
    if (!/^([A-Z]{1,8}|\d{6}\.[A-Z]{2})$/.test(sym)) return 'invalid';
    if (items.some((i) => i.symbol === sym)) return 'exists';
    // 名称没填时，有中文名就自动用中文名
    persist([...items, { symbol: sym, name: name?.trim() || symbolToName(sym) }]);
    return 'ok';
  };

  const removeItem = (symbol: string) => {
    if (items.length <= 1) return; // 至少保留一只
    persist(items.filter((i) => i.symbol !== symbol));
  };

  const resetToDefault = () => {
    resetWatchlist();
    setItems(DEFAULT_WATCHLIST);
    setIsDefault(true);
  };

  const nameOf = (symbol: string) => items.find((i) => i.symbol === symbol)?.name ?? symbol;

  return (
    <WatchlistContext.Provider
      value={{ items, isDefault, addItem, removeItem, resetToDefault, nameOf, focusSymbol, setFocusSymbol }}
    >
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist 必须在 WatchlistProvider 内使用');
  return ctx;
}
