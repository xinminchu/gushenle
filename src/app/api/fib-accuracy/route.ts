import { NextRequest, NextResponse } from 'next/server';
import { getFullSeries } from '@/lib/marketData';
import {
  findSwing,
  fibLevels,
  FIB_COMBOS,
  FIB_COMBO_IDS,
  type FibComboId,
  type FibLevel,
} from '@/lib/fibonacci';

/**
 * 黄金分割参考线回测：无未来函数，调参用。
 *
 * 对过去每一天 T：只用 T 及之前的 lookback 根K线找波段、算参考线，
 * 用 T+1..T+5 的真实走势验证"线有没有被尊重"。
 *
 * 命中规则（按线的语义）：
 * - 支撑位（上涨波段回调）：5日内最低价触及线±1.5%，且第5日收盘守住线之上（-1%内）→ 命中
 * - 压力位（下跌波段反弹）：5日内最高价触及线±1.5%，且第5日收盘没站上线（+1%内）→ 命中
 * - 上方目标位：触及后第5日收盘没一穿而过（线上+2%内）→ 命中（视为遇阻）
 * - 下方目标位：触及后第5日收盘没砸穿（线下-2%内）→ 命中（视为企稳）
 *
 * 基线：无脑持有5天、收盘不跌破1%的占比（粗糙对照，仅看相对）。
 * 模拟数据（source=simulated）的标的直接跳过，不参与调参。
 */

const LOOKBACKS = [40, 60, 120];
const DEFAULT_SYMBOLS = ['AAPL', 'NVDA', 'MSFT', 'TSLA', 'COIN', 'MSTR'];

const cache = new Map<string, { data: unknown; expires: number }>();
const pct1 = (v: number) => Math.round(v * 1000) / 10;

interface RatioStat {
  ratio: number;
  tests: number;
  touches: number;
  hits: number;
  hitRate: number | null;
}

interface ComboStat {
  combo: FibComboId;
  comboName: string;
  lookback: number;
  tests: number;
  touches: number;
  touchRate: number | null;
  hits: number;
  hitRate: number | null;
  baseline: number | null;
  edge: number | null;
  perRatio: RatioStat[];
}

export async function GET(req: NextRequest) {
  const cacheKey = req.nextUrl.searchParams.get('symbols') || 'default';
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return NextResponse.json(cached.data);
  }
  try {
    const symbols = (req.nextUrl.searchParams.get('symbols') || DEFAULT_SYMBOLS.join(','))
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
      .slice(0, 12);

    // 聚合器：key = combo|lookback
    const agg = new Map<string, { tests: number; touches: number; hits: number }>();
    const ratioAgg = new Map<string, { tests: number; touches: number; hits: number }>();
    let baseTests = 0;
    let baseHits = 0;
    const usedSymbols: string[] = [];

    for (const symbol of symbols) {
      const { series, source } = await getFullSeries(symbol);
      if (source === 'simulated' || series.length < 150) continue;
      usedSymbols.push(symbol);
      const pts = series
        .map((p) => ({
          date: p.date,
          high: p.high ?? p.close,
          low: p.low ?? p.close,
          close: p.close,
        }))
        .filter((p) => p.high > 0 && p.low > 0 && p.close > 0);
      const n = pts.length;

      for (const lookback of LOOKBACKS) {
        for (let t = lookback; t < n - 5; t++) {
          const win = pts.slice(t - lookback, t);
          const swing = findSwing(win, lookback);
          if (!swing) continue;
          const fwd = pts.slice(t, t + 5);
          const fwdLow = Math.min(...fwd.map((p) => p.low));
          const fwdHigh = Math.max(...fwd.map((p) => p.high));
          const close5 = fwd[4].close;

          // 基线：无脑持有5天，收盘不跌破1%
          baseTests++;
          if (close5 >= pts[t - 1].close * 0.99) baseHits++;

          for (const comboId of FIB_COMBO_IDS) {
            // smart 是混搭视图（扩展 1.272/1.618 + 深回调 0.618/0.786），
            // 零件在各自组合里都已回测，不重复测
            if (comboId === 'smart') continue;
            const levels = fibLevels(swing, comboId);
            for (const lv of levels) {
              const key = `${comboId}|${lookback}`;
              const rkey = `${comboId}|${lookback}|${lv.ratio}`;
              if (!agg.has(key)) agg.set(key, { tests: 0, touches: 0, hits: 0 });
              if (!ratioAgg.has(rkey)) ratioAgg.set(rkey, { tests: 0, touches: 0, hits: 0 });
              const a = agg.get(key)!;
              const ra = ratioAgg.get(rkey)!;
              a.tests++;
              ra.tests++;
              const { touched, held } = checkLevel(lv, fwdLow, fwdHigh, close5);
              if (touched) {
                a.touches++;
                ra.touches++;
                if (held) {
                  a.hits++;
                  ra.hits++;
                }
              }
            }
          }
        }
      }
    }

    const baseline = baseTests > 0 ? baseHits / baseTests : null;
    const combos: ComboStat[] = [];
    for (const comboId of FIB_COMBO_IDS) {
      if (comboId === 'smart') continue; // 混搭视图不参与回测，见上
      for (const lookback of LOOKBACKS) {
        const key = `${comboId}|${lookback}`;
        const a = agg.get(key);
        if (!a || a.tests < 50) continue;
        const touchRate = a.touches > 0 ? a.hits / a.touches : null;
        const perRatio: RatioStat[] = FIB_COMBOS[comboId].ratios.map((r) => {
          const ra = ratioAgg.get(`${key}|${r}`) || { tests: 0, touches: 0, hits: 0 };
          return {
            ratio: r,
            tests: ra.tests,
            touches: ra.touches,
            hits: ra.hits,
            hitRate: ra.touches > 0 ? pct1(ra.hits / ra.touches) : null,
          };
        });
        combos.push({
          combo: comboId,
          comboName: FIB_COMBOS[comboId].name,
          lookback,
          tests: a.tests,
          touches: a.touches,
          touchRate: a.touches > 0 ? pct1(a.touches / a.tests) : null,
          hits: a.hits,
          hitRate: touchRate == null ? null : pct1(touchRate),
          baseline: baseline == null ? null : pct1(baseline),
          edge: touchRate == null || baseline == null ? null : pct1(touchRate - baseline),
          perRatio,
        });
      }
    }
    combos.sort((x, y) => (y.hitRate ?? -1) - (x.hitRate ?? -1));

    const result = { ok: true, symbols: usedSymbols, combos };
    cache.set(cacheKey, { data: result, expires: Date.now() + 10 * 60 * 1000 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}

function checkLevel(
  lv: FibLevel,
  fwdLow: number,
  fwdHigh: number,
  close5: number
): { touched: boolean; held: boolean } {
  const p = lv.price;
  switch (lv.kind) {
    case 'support':
      return {
        touched: fwdLow <= p * 1.015,
        held: close5 >= p * 0.99,
      };
    case 'resistance':
      return {
        touched: fwdHigh >= p * 0.985,
        held: close5 <= p * 1.01,
      };
    case 'target-up':
      return {
        touched: fwdHigh >= p * 0.985,
        held: close5 <= p * 1.02,
      };
    case 'target-down':
      return {
        touched: fwdLow <= p * 1.015,
        held: close5 >= p * 0.98,
      };
  }
}
