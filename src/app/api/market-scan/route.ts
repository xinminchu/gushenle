// src/app/api/market-scan/route.ts
// 公开读：最新一次扫描的结果 + 汇总。首页「今日信号」三行、盘前盘后两报都走这里。
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface ScanItem {
  symbol: string;
  name: string;
  score: number;
  statusKey: string;
  changePct: number | null;
  prevChangePct: number | null;
  inflowEst: number | null;
  /** 连涨天数（030 未执行时为 null，前端不显示标签） */
  upStreak?: number | null;
  /** 连跌天数（030 未执行时为 null，前端不显示标签） */
  downStreak?: number | null;
  /** 近20天累计净流入（031 未执行时为 null，中间行退回不过滤） */
  flow20d?: number | null;
  /** 捡漏形态：rebound=昨天跌今天涨 / streak=连跌两天 */
  pattern?: 'rebound' | 'streak';
}

function anon() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!URL || !ANON) return null;
  return createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function GET(req: Request) {
  const sb = anon();
  if (!sb) return NextResponse.json({ ok: false, error: 'supabase 未配置' }, { status: 500 });
  try {
    // 取"最近3天里数据最全"的那一天：避免某次手动扫描中途停掉（如手机锁屏）
    // 只写了几条，就把首页信号牌洗成残缺数据
    const { data: dateRows, error: e0 } = await sb
      .from('market_scan')
      .select('scan_date')
      .order('scan_date', { ascending: false })
      .limit(600);
    if (e0) throw e0;
    const dates: string[] = [];
    for (const r of dateRows || []) {
      const d = r.scan_date as string;
      if (d && !dates.includes(d)) dates.push(d);
      if (dates.length >= 3) break;
    }
    if (dates.length === 0) {
      return NextResponse.json({ ok: true, empty: true });
    }
    let scanDate = dates[0];
    let bestCount = 0;
    for (const d of dates) {
      const { count } = await sb.from('market_scan').select('*', { count: 'exact', head: true }).eq('scan_date', d);
      const c = count || 0;
      if (c > bestCount) { bestCount = c; scanDate = d; }
      if (c >= 100) break; // 够全就不用再往前找
    }
    // ?pool=1：轻量返回全扫描池（symbol/name/score），供掷骰子"换一批"等取"律动分结果里的股票"
    if (new URL(req.url).searchParams.get('pool') === '1') {
      const r = await sb.from('market_scan').select('symbol,name,score').eq('scan_date', scanDate);
      if (r.error) throw r.error;
      const pool = ((r.data || []) as { symbol: string; name: string; score: number }[]).map(
        (x) => ({ symbol: x.symbol, name: x.name, score: x.score }),
      );
      return NextResponse.json({ ok: true, scanDate, total: pool.length, pool });
    }
    // 031 没执行时（flow_20d 列不存在）降级：中间行退回"离50最近"不过滤；
    // 030 没执行时（up_streak/down_streak 不存在）降级：连涨连跌标不显示
    const COLS_FULL =
      'symbol,name,score,status_key,change_pct,prev_change_pct,inflow_est,up_streak,down_streak,flow_20d';
    const COLS_NO_FLOW20 =
      'symbol,name,score,status_key,change_pct,prev_change_pct,inflow_est,up_streak,down_streak';
    const COLS_BASE = 'symbol,name,score,status_key,change_pct,prev_change_pct,inflow_est';
    let rows: Record<string, unknown>[] | null = null;
    let withStreak = true;
    let withFlow20 = true;
    try {
      const r = await sb.from('market_scan').select(COLS_FULL).eq('scan_date', scanDate);
      if (r.error) throw r.error;
      rows = r.data;
    } catch {
      try {
        withFlow20 = false;
        const r2 = await sb.from('market_scan').select(COLS_NO_FLOW20).eq('scan_date', scanDate);
        if (r2.error) throw r2.error;
        rows = r2.data;
      } catch {
        withStreak = false;
        const r3 = await sb.from('market_scan').select(COLS_BASE).eq('scan_date', scanDate);
        if (r3.error) throw r3.error;
        rows = r3.data;
      }
    }
    const items: ScanItem[] = (rows || []).map((r) => ({
      symbol: r.symbol as string,
      name: r.name as string,
      score: r.score as number,
      statusKey: (r.status_key as string) || '',
      changePct: r.change_pct as number | null,
      prevChangePct: r.prev_change_pct as number | null,
      inflowEst: r.inflow_est as number | null,
      upStreak: withStreak ? (r.up_streak as number | null) : null,
      downStreak: withStreak ? (r.down_streak as number | null) : null,
      flow20d: withFlow20 ? (r.flow_20d as number | null) : null,
    }));

    // 第一行：涨得欢 —— 冲高过热，按分从高到低取 5
    const hot = items
      .filter((i) => i.statusKey === 'overheated')
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const hotSymbols = new Set(hot.map((h) => h.symbol));

    // 第三行：跌得凶 —— 底部栏杆：按分从低到高取 5 只，保证每天都有；
    // 模型判定的跌过头（oversoldBottom）分最低，天然排最前面；
    // 放宽条件：不要求 trend>45，也不要求分≤th.cold
    const cold = items
      .filter((i) => !hotSymbols.has(i.symbol))
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);

    // 第二行：看一眼 —— 离50由近到远，50上下成对比较，留"近20天买入多"者：
    // 每对（50下方离50最近一只，50上方离50最近一只）：净流入为正者入选，
    // 净流出/数据缺失跳过；两个都为正时取前一日涨幅（changePct）大者，涨幅打平取离50近者；
    // 每对比较完左右指针各往前推一格，直到取满 5 只。涨得欢/跌得凶已占的不重复出现。
    // 031 未执行时（flow20d 全 null）退回"离50最近"不过滤。
    const coldSymbols = new Set(cold.map((c) => c.symbol));
    let middle: ScanItem[];
    if (!withFlow20) {
      middle = items
        .filter((i) => !hotSymbols.has(i.symbol) && !coldSymbols.has(i.symbol))
        .sort((a, b) => Math.abs(a.score - 50) - Math.abs(b.score - 50) || b.score - a.score)
        .slice(0, 5);
    } else {
      const isInflow = (s: ScanItem) => s.flow20d != null && s.flow20d > 0;
      const below = items
        .filter((i) => !hotSymbols.has(i.symbol) && !coldSymbols.has(i.symbol) && i.score < 50)
        .sort((a, b) => b.score - a.score); // 离50由近到远
      const above = items
        .filter((i) => !hotSymbols.has(i.symbol) && !coldSymbols.has(i.symbol) && i.score >= 50)
        .sort((a, b) => a.score - b.score); // 离50由近到远
      middle = [];
      let bi = 0;
      let ai = 0;
      while (middle.length < 5 && (bi < below.length || ai < above.length)) {
        const l = bi < below.length ? below[bi] : null;
        const r = ai < above.length ? above[ai] : null;
        const lIn = !!l && isInflow(l);
        const rIn = !!r && isInflow(r);
        if (lIn && rIn && l && r) {
          const lc = l.changePct ?? -1e9;
          const rc = r.changePct ?? -1e9;
          if (rc !== lc) middle.push(rc > lc ? r : l);
          else middle.push(Math.abs(r.score - 50) <= Math.abs(l.score - 50) ? r : l);
        } else if (lIn && l) {
          middle.push(l);
        } else if (rIn && r) {
          middle.push(r);
        }
        // 左右各往前推一格：净流出的就地跳过
        if (l) bi++;
        if (r) ai++;
      }
    }

    // 大盘
    const idx = (s: string) => items.find((i) => i.symbol === s) || null;

    // 昨日资金异动：估算净流入/流出各前 3（标"估算"）
    const withFlow = items.filter((i) => i.inflowEst != null);
    const inflowTop = [...withFlow].sort((a, b) => (b.inflowEst ?? 0) - (a.inflowEst ?? 0)).slice(0, 3);
    const outflowTop = [...withFlow].sort((a, b) => (a.inflowEst ?? 0) - (b.inflowEst ?? 0)).slice(0, 3);

    const counts: Record<string, number> = {};
    for (const i of items) counts[i.statusKey || 'unknown'] = (counts[i.statusKey || 'unknown'] || 0) + 1;

    return NextResponse.json({
      ok: true,
      scanDate,
      total: items.length,
      hot,
      middle,
      cold,
      /** 中间行是否经过"近20天净流入为正"过滤（031 未执行时为 false） */
      flowFilter: withFlow20,
      qqq: idx('QQQ'),
      spy: idx('SPY'),
      inflowTop,
      outflowTop,
      counts,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
