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
  /** 五探针（computeProbes 一次算好；simulated 假数据为 null） */
  probes: ProbeData | null;
}

/** 发现雷达探针数据（写端在扫描时一次算好，存 probes JSONB）。
 * 依据：实证研究 + 本地回测（2026-10-12）：单日上穿50是噪音（Jegadeesh 1990 短期反转），
 * 趋势确认（连2天HOT+分≥55+流入>0）本地前向5日 +1.42% vs 基线 +0.49%（n=114）；
 * 放量突破/相对强度/中线动量/VCP 取文献参数，本地台账从上线日起积累。 */
export interface ProbeData {
  /** 当日相对成交量 = 当日量 / 前20日均量（放量突破阈值 ≥1.5，Minervini 口径） */
  rvol: number | null;
  /** 收盘突破前20日最高收盘（不含当日） */
  break20: boolean;
  /** 突破位价格（前20日最高收盘），作废线用 */
  breakPrice: number | null;
  /** 6个月涨幅（跳过最近1个月，Jegadeesh-Titman 口径），0.23 = +23% */
  ret6m: number | null;
  /** 近3个月涨幅 */
  ret3m: number | null;
  /** 近3个月相对 SPY 超额 */
  xs3m: number | null;
  /** VCP 蓄势：ATR20/ATR50 < 0.6 且站上50日线 且量能萎缩 */
  vcp: boolean;
  atrRatio: number | null;
}

interface BarLike {
  date: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

function sma(vals: number[], n: number): number | null {
  if (vals.length < n) return null;
  const s = vals.slice(-n);
  return s.reduce((a, b) => a + b, 0) / n;
}

/** ATR：真实波幅均值（high/low 缺失时返回 null） */
function atrOf(bars: BarLike[], n: number): number | null {
  if (bars.length < n + 1) return null;
  let sum = 0;
  for (let k = bars.length - n; k < bars.length; k++) {
    const b = bars[k];
    const p = bars[k - 1];
    if (b.high == null || b.low == null) return null;
    sum += Math.max(b.high - b.low, Math.abs(b.high - p.close), Math.abs(b.low - p.close));
  }
  return sum / n;
}

function meanVol(bars: BarLike[], endExclusive: number, n: number): number | null {
  const vs: number[] = [];
  for (let k = endExclusive - n; k < endExclusive; k++) {
    if (k < 0) return null;
    const v = bars[k].volume;
    if (typeof v === 'number' && v > 0) vs.push(v);
  }
  if (vs.length < Math.ceil(n * 0.7)) return null;
  return vs.reduce((a, b) => a + b, 0) / vs.length;
}

/** 五探针一次算好。spyByDate: SPY 的 date->close（scanChunk 统一拉一次传入）。 */
export function computeProbes(bars: BarLike[], spyByDate?: Map<string, number>): ProbeData | null {
  const n = bars.length;
  if (n < 60) return null;
  const closes = bars.map((b) => b.close);
  const last = bars[n - 1];

  // 放量突破：RVOL + 20日新高
  const volBase = meanVol(bars, n - 1, 20);
  const volLast = typeof last.volume === 'number' && last.volume > 0 ? last.volume : null;
  const rvol = volLast != null && volBase ? +(volLast / volBase).toFixed(2) : null;
  const prior20High = Math.max(...closes.slice(n - 21, n - 1));
  const break20 = last.close > prior20High;
  const breakPrice = break20 ? +prior20High.toFixed(2) : null;

  // 中线动量：6个月涨幅跳过最近1个月（约126个交易日，往前再跳21天）
  const ret6m =
    n >= 170 && closes[n - 148] > 0 ? +((closes[n - 22] / closes[n - 148] - 1).toFixed(4)) : null;

  // 相对强度：近3个月（63天）涨幅及相对 SPY 超额
  let ret3m: number | null = null;
  let xs3m: number | null = null;
  if (n >= 70 && closes[n - 64] > 0) {
    ret3m = +((closes[n - 1] / closes[n - 64] - 1).toFixed(4));
    if (spyByDate) {
      const spyNow = spyByDate.get(last.date.slice(0, 10));
      const spyThen = spyByDate.get(bars[n - 64].date.slice(0, 10));
      if (spyNow && spyThen && spyThen > 0) {
        xs3m = +((ret3m - (spyNow / spyThen - 1)).toFixed(4));
      }
    }
  }

  // VCP 蓄势：波动收缩 + 站上50日线 + 量能萎缩
  const atr20 = atrOf(bars, 20);
  const atr50 = atrOf(bars, 50);
  const atrRatio = atr20 != null && atr50 ? +(atr20 / atr50).toFixed(3) : null;
  const sma50 = sma(closes, 50);
  const vol10 = meanVol(bars, n, 10);
  const vol30 = meanVol(bars, n - 10, 20);
  const volDry = vol10 != null && vol30 ? vol10 < vol30 * 0.85 : false;
  const vcp =
    atrRatio != null && atrRatio < 0.6 && sma50 != null && last.close > sma50 && volDry;

  return { rvol, break20, breakPrice, ret6m, ret3m, xs3m, vcp, atrRatio };
}
/** 扫一只：拿日线 -> 律动打分 -> 昨日涨跌 -> 昨日估算资金流 -> 五探针 */
export async function scanOne(symbol: string, spyByDate?: Map<string, number>): Promise<ScanRow | null> {
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
  // 五探针：simulated 假数据没有真实量价，记 null（不进雷达）
  const probes = source === 'simulated' ? null : computeProbes(series, spyByDate);
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
    probes,
  };
}

/** 并发扫一片（serverless 单次别太久，limit 建议 <= 8）。
 * SPY 序列只拉一次，供全片算相对强度（xs3m）用；失败则探针的 xs3m 为 null，不影响整行。 */
export async function scanChunk(symbols: string[], concurrency = 4): Promise<ScanRow[]> {
  const rows: ScanRow[] = [];
  let spyByDate: Map<string, number> | undefined;
  if (symbols.some((s) => s.toUpperCase() !== 'SPY')) {
    try {
      const { series } = await getFullSeries('SPY');
      spyByDate = new Map(
        (series || []).map((b) => [b.date.slice(0, 10), b.close] as [string, number]),
      );
    } catch {
      /* SPY 拉不到就降级，xs3m 为 null */
    }
  }
  for (let i = 0; i < symbols.length; i += concurrency) {
    const batch = symbols.slice(i, i + concurrency);
    const got = await Promise.all(batch.map((s) => scanOne(s, spyByDate).catch(() => null)));
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
    // 039 未执行（probes 列不存在）时整行 upsert 会失败 -> 下面 catch 按列缺失降级
    probes: r.probes,
  }));
  const { error } = await sb.from('market_scan').upsert(payload, {
    onConflict: 'symbol,scan_date',
  });
  if (error) {
    // 039 未执行（probes 列不存在）：去掉 probes 重试（保留 source）
    if (/probes/i.test(error.message)) {
      const noProbes = payload.map(({ probes: _p, ...rest }) => rest);
      const r3 = await sb.from('market_scan').upsert(noProbes, {
        onConflict: 'symbol,scan_date',
      });
      if (r3.error) return { ok: false, error: r3.error.message };
      return { ok: true };
    }
    // 037 未执行（source 列不存在）：去掉 source + probes 重试
    if (/source/i.test(error.message)) {
      const legacy = payload.map(({ source: _s, probes: _p, ...rest }) => rest);
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
  // 注意：scanSymbols() 会在 STOCK_LIST 之外追加 QQQ/SPY（大盘行），白名单必须包含它们，
  // 否则每天写入后会被当成"已移除"删掉（2026-10-12 实测：SPY/QQQ 从无保留行）。
  const valid = new Set([
    ...STOCK_LIST.map((s) => s.code.toUpperCase()),
    ...scanSymbols().map((s) => s.toUpperCase()),
  ]);
  const { data, error } = await sb.from('market_scan').select('symbol');
  if (error) return { ok: false, error: error.message };
  const inDb = [...new Set((data || []).map((r) => r.symbol as string))];
  const stale = inDb.filter((s) => !valid.has(s.toUpperCase()));
  if (stale.length === 0) return { ok: true, pruned: [] };
  const { error: e2 } = await sb.from('market_scan').delete().in('symbol', stale);
  if (e2) return { ok: false, error: e2.message };
  return { ok: true, pruned: stale };
}
