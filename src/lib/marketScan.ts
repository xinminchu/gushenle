// src/lib/marketScan.ts
// 每日市场扫描：收盘后把精选池每只股票的律动分/信号/涨跌/昨日估算资金流算好，
// 写入 market_scan 表。首页「今日信号」和盘前盘后两报直接读表，不实时算。
import { getFullSeries, type DataSource } from './marketData';
import { buildJudgment } from './rhythm';
import { estimateFlows } from './flows';
import { STOCK_LIST, findStock } from './stockList';
import { serviceClient } from './adminAuth';

/** 扫描池：精选名单 + 大盘 ETF（QQQ/SPY 供两报的大盘行用） */
export function scanSymbols(): string[] {
  const codes = STOCK_LIST.map((s) => s.code.toUpperCase());
  for (const extra of ['QQQ', 'SPY']) {
    if (!codes.includes(extra)) codes.push(extra);
  }
  return [...new Set(codes)];
}

export interface ScanRow {
  symbol: string;
  name: string;
  score: number;
  statusKey: string;
  changePct: number | null;
  /** 前一日涨跌幅（%），供「姿态低」看 昨天跌/连跌 用 */
  prevChangePct: number | null;
  /** 昨日估算净流入（美元；flows.ts 确定性估算，非逐笔数据） */
  inflowEst: number | null;
  /** 近20天累计净流入（flows.ts 确定性估算；正=买入多），供中间行过滤用 */
  flow20d: number | null;
  /** 连涨天数：从最新一根日线往前数，连续收涨天数；平盘打断 */
  upStreak: number;
  /** 连跌天数：从最新一根日线往前数，连续收跌天数；平盘打断 */
  downStreak: number;
  /** 最新一根日线的日期 YYYY-MM-DD（即本次扫描的数据日期） */
  barDate: string;
  /** 数据源：nasdaq/yahoo/naver 为真数据，simulated 为假数据兜底（不进 discovery/信号行） */
  source: DataSource;
}

/** 扫一只：拿日线 -> 律动打分 -> 昨日涨跌 -> 昨日估算资金流 */
export async function scanOne(symbol: string): Promise<ScanRow | null> {
  const sym = symbol.toUpperCase();
  let series;
  let source: DataSource = 'simulated';
  try {
    ({ series, source } = await getFullSeries(sym));
  } catch {
    return null;
  }
  if (!series || series.length < 22) return null;
  const closes = series.map((p) => p.close);
  const j = buildJudgment(closes);
  const n = series.length;
  const prev = series[n - 2].close;
  const last = series[n - 1].close;
  const changePct = prev > 0 ? Number((((last - prev) / prev) * 100).toFixed(2)) : null;
  const prevPrev = series[n - 3].close;
  const prevChangePct =
    prevPrev > 0 ? Number((((prev - prevPrev) / prevPrev) * 100).toFixed(2)) : null;
  // 连涨/连跌天数：从最新一根往前数，连续收涨（收跌）天数；平盘（0）打断；两者互斥
  let upStreak = 0;
  for (let k = n - 1; k >= 1 && series[k].close > series[k - 1].close; k--) upStreak++;
  let downStreak = 0;
  for (let k = n - 1; k >= 1 && series[k].close < series[k - 1].close; k--) downStreak++;
  let inflowEst: number | null = null;
  let flow20d: number | null = null;
  try {
    const f = estimateFlows(series, sym);
    if (f && f.days.length > 0) {
      inflowEst = Math.round(f.days[f.days.length - 1].flow);
      flow20d = Math.round(f.net);
    }
  } catch {
    /* 资金流算不出不影响整行 */
  }
  const info = findStock(sym);
  return {
    symbol: sym,
    name: info?.zh || info?.en || sym,
    score: j.score,
    statusKey: j.statusKey ?? '',
    changePct,
    prevChangePct,
    inflowEst,
    flow20d,
    upStreak,
    downStreak,
    barDate: series[n - 1].date.slice(0, 10),
    source,
  };
}

/** 并发扫一片（serverless 单次别太久，limit 建议 <= 8） */
export async function scanChunk(symbols: string[], concurrency = 4): Promise<ScanRow[]> {
  const rows: ScanRow[] = [];
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const got = await Promise.all(batch.map((s) => scanOne(s).catch(() => null)));
    for (const r of got) if (r) rows.push(r);
  }
  return rows;
}

/** 写入 market_scan（按 symbol+scan_date 幂等，周末重跑不会产生新行） */
export async function upsertScanRows(rows: ScanRow[]): Promise<{ ok: boolean; error?: string }> {  const sb = serviceClient();
  if (!sb) return { ok: false, error: 'service_role 未配置' };
  if (rows.length === 0) return { ok: true };
  const payload = rows.map((r) => ({
    symbol: r.symbol,
    scan_date: r.barDate,
    name: r.name,
    score: r.score,
    status_key: r.statusKey,
    change_pct: r.changePct,
    prev_change_pct: r.prevChangePct,
    inflow_est: r.inflowEst,
    flow_20d: r.flow20d,
    up_streak: r.upStreak,
    down_streak: r.downStreak,
    source: r.source,
  }));
  const { error } = await sb.from('market_scan').upsert(payload, {
    onConflict: 'symbol,scan_date',
  });
  if (error) {
    // 037 未执行（source 列不存在）：去掉 source 重试
    if (/source/i.test(error.message)) {
      const legacy = payload.map(({ source: _s, ...rest }) => rest);
      const r2 = await sb.from('market_scan').upsert(legacy, {
        onConflict: 'symbol,scan_date',
      });
      if (r2.error) return { ok: false, error: r2.error.message };
      return { ok: true };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * 删除已不在 STOCK_LIST 里的 symbol 的所有扫描行。
 * 名单移除退市股（如 ANSS/CFLT）后，旧扫描行仍留在表里，upsert 不会删它们；
 * 每天全量扫描结束时调一次，保证首页信号牌不再出现退市股。
 */
export async function pruneStaleSymbols(): Promise<{
  ok: boolean;
  pruned?: string[];
  error?: string;
}> {
  const sb = serviceClient();
  if (!sb) return { ok: false, error: 'service_role 未配置' };
  const valid = new Set(STOCK_LIST.map((s) => s.code.toUpperCase()));
  const { data, error } = await sb.from('market_scan').select('symbol');
  if (error) return { ok: false, error: error.message };
  const inDb = [...new Set((data || []).map((r) => r.symbol as string))];
  const stale = inDb.filter((s) => !valid.has(s.toUpperCase()));
  if (stale.length === 0) return { ok: true, pruned: [] };
  const { error: e2 } = await sb.from('market_scan').delete().in('symbol', stale);
  if (e2) return { ok: false, error: e2.message };
  return { ok: true, pruned: stale };
}
