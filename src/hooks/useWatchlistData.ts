// 自选股全量 1Y 数据：播报（一句话/异动/位置）和 K线关键价位共用一份，
// 每只股票只拉一次（走 market.ts 的共享缓存，跟今日/持仓同源）。

'use client';

import { useEffect, useState } from 'react';
import { getRhythm } from '@/lib/market';
import type { RhythmResponse } from '@/lib/rhythm';

export function useWatchlistData(symbols: string[]): Record<string, RhythmResponse> {
  const [map, setMap] = useState<Record<string, RhythmResponse>>({});
  const key = symbols.join(',');

  useEffect(() => {
    let cancelled = false;
    if (symbols.length === 0) {
      setMap({});
      return;
    }
    // 1Y：一份数据同时给出 3M 锚定的律动判断、年内高低点、日线量价
    Promise.allSettled(symbols.map((s) => getRhythm(s, '1Y'))).then((results) => {
      if (cancelled) return;
      const next: Record<string, RhythmResponse> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled') next[symbols[i]] = r.value;
      });
      setMap(next);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return map;
}
