// src/hooks/useFocusList.ts
// 本周关注（冷静池）的共享状态：今日页的一句话播报和持仓页的本周关注共用。
// 两处是同一页面的不同 tab，用 CustomEvent 做同页签内的实时同步。

import { useState, useEffect, useCallback } from 'react';
import { loadFocus, saveFocus, FOCUS_MAX, type FocusState } from '@/lib/focus';
import { logFocusWatch } from '@/lib/focusHistory';

const EVT = 'gushenle:focus-changed';

export function useFocusList() {
  const [focus, setFocus] = useState<FocusState>(() => loadFocus());

  useEffect(() => {
    const reload = () => setFocus(loadFocus());
    window.addEventListener(EVT, reload);
    return () => window.removeEventListener(EVT, reload);
  }, []);

  const persistFocus = useCallback((next: FocusState) => {
    setFocus(next);
    saveFocus(next);
    window.dispatchEvent(new Event(EVT));
  }, []);

  /** 加关注：满了/已在返回 false；成功返回 true */
  const addFocus = useCallback(
    (symbol: string, onFirstOfWeek?: () => void): boolean => {
      const s = symbol.toUpperCase();
      let added = false;
      let first = false;
      setFocus((cur) => {
        if (cur.items.some((i) => i.symbol === s)) return cur;
        if (cur.items.length >= FOCUS_MAX) return cur;
        first = cur.items.length === 0;
        added = true;
        const next = { ...cur, items: [...cur.items, { symbol: s, addedAt: Date.now() }] };
        saveFocus(next);
        return next;
      });
      if (added) {
        window.dispatchEvent(new Event(EVT));
        logFocusWatch(s); // 关注历史：持仓页按周展示
        if (first) onFirstOfWeek?.();
      }
      return added;
    },
    [],
  );

  const removeFocus = useCallback(
    (symbol: string) => {
      setFocus((cur) => {
        const next = { ...cur, items: cur.items.filter((i) => i.symbol !== symbol) };
        saveFocus(next);
        return next;
      });
      window.dispatchEvent(new Event(EVT));
    },
    [],
  );

  return { focus, persistFocus, addFocus, removeFocus };
}
