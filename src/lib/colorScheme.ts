// src/lib/colorScheme.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * 涨跌配色方案
 * - 'cn' = 红涨绿跌（国内习惯）
 * - 'us' = 绿涨红跌（美股习惯，默认）
 * 选择存在 localStorage，全站统一生效。
 */
export type ColorScheme = 'cn' | 'us';

const KEY = 'gsl-color-scheme';
const EVENT = 'gsl-scheme-change';

export function loadColorScheme(): ColorScheme {
  try {
    return localStorage.getItem(KEY) === 'cn' ? 'cn' : 'us';
  } catch {
    return 'us';
  }
}

export function useColorScheme() {
  const [scheme, setScheme] = useState<ColorScheme>('us');
  useEffect(() => {
    setScheme(loadColorScheme());
    const sync = () => setScheme(loadColorScheme());
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const toggle = useCallback(() => {
    const next: ColorScheme = loadColorScheme() === 'cn' ? 'us' : 'cn';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 忽略 */
    }
    window.dispatchEvent(new Event(EVENT));
    setScheme(next);
  }, []);
  return { scheme, toggle };
}

/** 页面上明确写出来的方案名 */
export const schemeLabel = (s: ColorScheme) => (s === 'cn' ? '红涨绿跌' : '绿涨红跌');

/** 涨的文字颜色（Tailwind） */
export const upText = (s: ColorScheme) => (s === 'cn' ? 'text-rose-400' : 'text-emerald-400');
/** 跌的文字颜色（Tailwind） */
export const downText = (s: ColorScheme) => (s === 'cn' ? 'text-emerald-400' : 'text-rose-400');
/** 涨的 HEX（canvas 图表用） */
export const upHex = (s: ColorScheme) => (s === 'cn' ? '#f43f5e' : '#22c55e');
/** 跌的 HEX（canvas 图表用） */
export const downHex = (s: ColorScheme) => (s === 'cn' ? '#22c55e' : '#f43f5e');
