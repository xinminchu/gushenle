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
  /** 数据源：simulated 为假数据兜底，不进任何信号行/discovery */
  source?: string | null;
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
    // 取"最近7天里数据最全"的那一天：避免某次手动扫描中途停掉（如手机锁屏）
    // 只写了几条，就把首页信号牌洗成残缺数据；7 天窗口也给"空行回补"留往前找的余地
    const { data: dateRows, error: e0 } = await sb
      .from('market_scan')
      .select('scan_date')
      .order('scan_date', { ascending: false })
      .limit(1200);
    if (e0) throw e0;
    const dates: string[] = [];
    for (const r of dateRows || []) {
      const d = r.scan_date as string;
      if (d && !dates.includes(d)) dates.push(d);
      if (dates.length >= 7) break;
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
      const r1 = await sb.from('market_scan').select('symbol,name,score,source').eq('scan_date', scanDate);
      // 037 未执行：source 列不存在，退回无 source 版（不过滤）
      const r = r1.error
        ? await sb.from('market_scan').select('symbol,name,score').eq('scan_date', scanDate)
        : r1;
      if (r.error) throw r.error;
      const pool = ((r.data || []) as { symbol: string; name: string; score: number; source?: string }[])
        .filter((x) => x.source !== 'simulated')
        .map((x) => ({ symbol: x.symbol, name: x.name, score: x.score }));
      return NextResponse.json({ ok: true, scanDate, total: pool.length, pool });
    }
    // 031 没执行时（flow_20d 列不存在）降级：中间行退回"离50最近"不过滤；
    // 030 没执行时（up_streak/down_streak 不存在）降级：连涨连跌标不显示
    const COLS_FULL =
      'symbol,name,score,status_key,change_pct,prev_change_pct,inflow_est,up_streak,down_streak,flow_20d,source';
    const COLS_NO_FLOW20 =
      'symbol,name,score,status_key,change_pct,prev_change_pct,inflow_est,up_streak,down_streak,source';
    const COLS_BASE = 'symbol,name,score,status_key,change_pct,prev_change_pct,inflow_est,source';
    // 037 未执行时（source 列不存在）终极降级：不带 source，按真数据处理
    const COLS_LEGACY = 'symbol,name,score,status_key,change_pct,prev_change_pct,inflow_est';
    let cols = COLS_FULL;
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
        cols = COLS_NO_FLOW20;
        const r2 = await sb.from('market_scan').select(COLS_NO_FLOW20).eq('scan_date', scanDate);
        if (r2.error) throw r2.error;
        rows = r2.data;
      } catch {
        withStreak = false;
        cols = COLS_BASE;
        try {
          const r3 = await sb.from('market_scan').select(COLS_BASE).eq('scan_date', scanDate);
          if (r3.error) throw r3.error;
          rows = r3.data;
        } catch {
          // 037 未执行：source 列不存在
          withStreak = false;
          cols = COLS_LEGACY;
          const r4 = await sb.from('market_scan').select(COLS_LEGACY).eq('scan_date', scanDate);
          if (r4.error) throw r4.error;
          rows = r4.data;
        }
      }
    }
    // 假数据兜底（source=simulated）不进任何信号行/discovery/资金异动；
    // source 为空（037 未执行的老快照）按真数据处理
    const isReal = (i: ScanItem) => i.source !== 'simulated';
    const toItems = (rs: Record<string, unknown>[] | null): ScanItem[] =>
      (rs || []).map((r) => ({
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
        source: (r.source as string) || null,
      }));
    const loadItems = async (d: string): Promise<ScanItem[]> => {
      const r = await sb.from('market_scan').select(cols).eq('scan_date', d);
      if (r.error) throw r.error;
      return toItems((r.data || []) as unknown as Record<string, unknown>[]);
    };

    // 三行算法（与原来一致）：先 hot，再 cold（排除 hot），再 middle（排除 hot+cold）
    function computeRows(items: ScanItem[]) {
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
      // 流出（估算）/数据缺失跳过；两个都为正时取20天流入（估算）大者，流入（估算）打平取离50近者；
      // 每对比较完左右指针各往前推一格，直到取满 5 只。涨得欢/跌得凶已占的不重复出现。
      // 031 未执行、或列已建但快照里还没有 flow_20d 数据：退回"离50最近"不过滤。
      const coldSymbols = new Set(cold.map((c) => c.symbol));
      const hasFlowData = withFlow20 && items.some((i) => i.flow20d != null);
      let middle: ScanItem[];
      if (!hasFlowData) {
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
            const lf = l.flow20d ?? -1e18;
            const rf = r.flow20d ?? -1e18;
            if (rf !== lf) middle.push(rf > lf ? r : l);
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
      return { hot, middle, cold, flowFilter: hasFlowData };
    }

    const primary = toItems(rows).filter(isReal);
    /** 假数据行数（监控用：突然增多说明数据源出问题） */
    const simulatedCount = toItems(rows).length - primary.length;
    const computed = computeRows(primary);
    let hot = computed.hot;
    let middle = computed.middle;
    let cold = computed.cold;
    const flowFilter = computed.flowFilter;
    // 每行的数据日期：默认都是 scanDate；空行回补后，回补行标注实际日期
    const rowDates: Record<'hot' | 'middle' | 'cold', string> = {
      hot: scanDate,
      middle: scanDate,
      cold: scanDate,
    };
    // 空行回补：某行当天是空的，往前找最近有数据的那一天补上（比如周一用上周五的）
    const emptyKeys = (['hot', 'middle', 'cold'] as const).filter(
      (k) => (k === 'hot' ? hot : k === 'middle' ? middle : cold).length === 0,
    );
    for (const d of dates) {
      if (d === scanDate || emptyKeys.length === 0) continue;
      let fb: ScanItem[];
      try {
        fb = await loadItems(d);
      } catch {
        continue;
      }
      if (fb.length === 0) continue;
      const r = computeRows(fb);
      for (let i = emptyKeys.length - 1; i >= 0; i--) {
        const k = emptyKeys[i];
        if (r[k].length > 0) {
          if (k === 'hot') hot = r.hot;
          else if (k === 'middle') middle = r.middle;
          else cold = r.cold;
          rowDates[k] = d;
          emptyKeys.splice(i, 1);
        }
      }
    }

    // 大盘
    const idx = (s: string) => primary.find((i) => i.symbol === s) || null;

    // ---- 潜力发现：前后两天对比找"刚转折"，不是按位置挑 ----
    // 趋势初起：昨天 50 分下方（非热），今天转入 risingAccel/hotStrong
    // 止跌回升：昨天是 oversoldBottom/bottomUp/weakLow，今天转入 risingAccel/hotStrong
    // 每只带昨天分数 + 作废线（前端展示），只摆数据不做推荐
    let discovery: {
      emerging: Array<ScanItem & { prevScore: number; prevStatusKey: string }>;
      rebounding: Array<ScanItem & { prevScore: number; prevStatusKey: string }>;
      prevDate: string | null;
    } = { emerging: [], rebounding: [], prevDate: null };
    try {
      const prevDate = dates.find((d) => d < scanDate) ?? null;
      if (prevDate) {
        const prevItems = await loadItems(prevDate);
        const prevMap = new Map(prevItems.map((p) => [p.symbol, p]));
        const HOT = new Set(['risingAccel', 'hotStrong']);
        const COLD = new Set(['oversoldBottom', 'bottomUp', 'weakLow']);
        const emerging: Array<ScanItem & { prevScore: number; prevStatusKey: string }> = [];
        const rebounding: Array<ScanItem & { prevScore: number; prevStatusKey: string }> = [];
        for (const t of primary) {
          const p = prevMap.get(t.symbol);
          if (!p || !HOT.has(t.statusKey)) continue;
          const item = { ...t, prevScore: p.score, prevStatusKey: p.statusKey };
          if (COLD.has(p.statusKey)) rebounding.push(item);
          else if (p.score < 50) emerging.push(item);
        }
        const byJump = (
          a: { score: number; prevScore: number },
          b: { score: number; prevScore: number },
        ) => b.score - b.prevScore - (a.score - a.prevScore);
        rebounding.sort(byJump);
        const rbSyms = new Set(rebounding.map((r) => r.symbol));
        discovery = {
          emerging: emerging.filter((e) => !rbSyms.has(e.symbol)).sort(byJump).slice(0, 5),
          rebounding: rebounding.slice(0, 5),
          prevDate,
        };
      }
    } catch {
      /* 前日快照读不到就空着，不影响主流程 */
    }

    // 昨日资金异动：估算净流入/流出各前 3（标"估算"）
    const withFlow = primary.filter((i) => i.inflowEst != null);
    const inflowTop = [...withFlow].sort((a, b) => (b.inflowEst ?? 0) - (a.inflowEst ?? 0)).slice(0, 3);
    const outflowTop = [...withFlow].sort((a, b) => (a.inflowEst ?? 0) - (b.inflowEst ?? 0)).slice(0, 3);

    const counts: Record<string, number> = {};
    for (const i of primary) counts[i.statusKey || 'unknown'] = (counts[i.statusKey || 'unknown'] || 0) + 1;

    return NextResponse.json({
      ok: true,
      scanDate,
      total: primary.length,
      hot,
      middle,
      cold,
      /** 每行实际用的数据日期（空行回补时与 scanDate 不同，前端标注） */
      rowDates,
      /** 潜力发现：前后两天对比的转折（趋势初起/止跌回升），只摆数据不做推荐 */
      discovery,
      /** 中间行是否经过"近20天净流入为正"过滤（有真实 flow_20d 数据时才为 true） */
      flowFilter,
      qqq: idx('QQQ'),
      spy: idx('SPY'),
      inflowTop,
      outflowTop,
      counts,
      /** 当日假数据行数（突然增多说明数据源出问题） */
      simulatedCount,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
