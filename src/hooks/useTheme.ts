// 主题切换：深色 / 浅色，localStorage 持久化（gushenle:theme），默认深色
'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';
const KEY = 'gushenle:theme';

function applyTheme(t: Theme) {
  try {
    document.documentElement.classList.toggle('light', t === 'light');
    document.documentElement.classList.toggle('dark', t === 'dark');
  } catch {
    /* 忽略 */
  }
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
        applyTheme(saved);
      }
    } catch {
      /* 忽略 */
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* 忽略 */
      }
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
