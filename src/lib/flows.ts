import type { RhythmPoint } from './rhythm';
import { fmtCompactMoney } from './currency';

export interface DayFlow {
  /** YYYY-MM-DD */
  date: string;
  /** 当日净资金：正=流入，负=流出（美元/韩元） */
  flow: number;
}

export interface FlowResult {
  days: DayFlow[];
  /** 近 N 日累计净流入 */
  net: number;
  /** 近 N 日进出总额（用于判断多空僵持） */
  gross: number;
  daysCount: number;
  verdict: string;
}

const DAYS = 20;

export interface FlowBucket {
  label: string;
  inSum: number;
  outSum: number;
}

/** 按 近5日 / 6-10日 / 11-20日 分桶（days 老->新） */
export function bucketizeFlows(days: DayFlow[]): FlowBucket[] {
  const defs = [
    { label: '近5日', from: -5 },
    { label: '6-10日', from: -10, to: -5 },
    { label: '11-20日', from: -20, to: -10 },
  ];
  return defs.map((d) => {
    const slice = d.to == null ? days.slice(d.from) : days.slice(d.from, d.to);
    let inSum = 0;
    let outSum = 0;
    for (const x of slice) {
      if (x.flow > 0) inSum += x.flow;
      else outSum -= x.flow;
    }
    return { label: d.label, inSum, outSum };
  });
}

/** 一句"怎么用"：行为纠偏口吻，不预测 */
export function flowUsage(totalIn: number, totalOut: number): string {
  if (totalIn <= 0 && totalOut <= 0) return '数据不足，先不动';
  if (totalOut > totalIn * 1.5) return '红色占了一大块：卖盘更用力，先别急着买';
  if (totalIn > totalOut * 1.5) return '绿色占了一大块：买盘更主动，拿着的别慌着卖';
  return '红绿差不多：多空僵持，看不懂就先不动';
}

/**
 * 日线资金流向估算（确定性本地算法，非逐笔大单数据）：
 * 每日资金 = 典型价((H+L+C)/3) × 成交量；
 * 收盘涨 -> 记流入，收盘跌 -> 记流出，平盘记 0。
 * 这是公开的标准做法（Chaikin 资金流思路），不是交易所逐笔数据。
 */
export function estimateFlows(series: RhythmPoint[], symbol: string): FlowResult | null {
  const bars = series.filter(
    (p) =>
      p.volume != null &&
      p.volume > 0 &&
      p.high != null &&
      p.low != null &&
      p.high >= p.low &&
      p.low > 0,
  );
  if (bars.length < DAYS + 1) return null;

  const days: DayFlow[] = [];
  for (let i = 1; i < bars.length; i++) {
    const b = bars[i];
    const tp = (b.high! + b.low! + b.close) / 3;
    const mf = tp * b.volume!;
    const dir = b.close > bars[i - 1].close ? 1 : b.close < bars[i - 1].close ? -1 : 0;
    days.push({ date: b.date, flow: dir * mf });
  }
  const last = days.slice(-DAYS);
  const net = last.reduce((a, d) => a + d.flow, 0);
  const gross = last.reduce((a, d) => a + Math.abs(d.flow), 0);

  let verdict: string;
  if (gross > 0 && Math.abs(net) < gross * 0.1) {
    verdict = '进出基本打平，多空在僵持';
  } else if (net > 0) {
    verdict = `净流入 ${fmtCompactMoney(symbol, net)}，买盘更主动`;
  } else {
    verdict = `净流出 ${fmtCompactMoney(symbol, -net)}，小心点`;
  }
  return { days: last, net, gross, daysCount: last.length, verdict };
}
