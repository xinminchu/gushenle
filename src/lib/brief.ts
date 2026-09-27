// 一句话播报 + 诊断卡多空一句话 + K线关键价位计算。
// 全部本地确定性逻辑，不调 AI、不新增接口。
// 口径：只讲事实和纪律（拦追高、拦割肉），不预测涨跌。

import type { RhythmResponse, RhythmPoint } from './rhythm';
import { STATUS_LABELS } from './rhythm';

/* ---------------- 一句话播报 ---------------- */

/** 行动提示：跟全站行为纠偏口径一致，大白话 */
const ACTION_TIP: Record<string, string> = {
  overheated: '追高慎重',
  hotStrong: '拿着可以，追就免了',
  risingAccel: '涨速起来了，别追',
  sideways: '先看着',
  bottomUp: '跌不动了，别急着割',
  weakLow: '还在跌，别接飞刀',
  oversoldBottom: '别急着割肉',
};

/** 序列的实际最高 / 最低（用 high/low，没有就用 close） */
export function actualHighLow(series: RhythmPoint[]): { high: number; low: number } | null {
  let high = -Infinity;
  let low = Infinity;
  for (const p of series) {
    const h = p.high ?? p.close;
    const l = p.low ?? p.close;
    if (h > high) high = h;
    if (l < low) low = l;
  }
  if (!isFinite(high) || !isFinite(low)) return null;
  return { high, low };
}

/**
 * 为一只股票生成一句话播报，例如：
 * "NVDA 英伟达 大涨 3.2% 放量，接近年内高点，律动 82 分涨太猛了，追高慎重"
 * 模拟数据兜底的股票返回 null（不生成播报，跟单只咨询拒掉模拟数据的口径一致）。
 * 期望传入 1Y 区间的数据：判断锚定近 3 月（服务端已保证），高低点按年内算。
 */
export function buildBrief(symbol: string, name: string, d: RhythmResponse): string | null {
  if (d.source === 'simulated') return null;
  const s = d.series;
  if (s.length < 2) return null;

  // 当日涨跌：用日线最后两根收盘价（盘中/收盘都一致）
  const last = s[s.length - 1];
  const prev = s[s.length - 2];
  const chg = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;

  let moveTxt: string;
  if (chg >= 3) moveTxt = `大涨 ${chg.toFixed(1)}%`;
  else if (chg <= -3) moveTxt = `大跌 ${Math.abs(chg).toFixed(1)}%`;
  else moveTxt = chg >= 0 ? `+${chg.toFixed(1)}%` : `${chg.toFixed(1)}%`;

  // 放量：最后一根成交量 >= 前 20 根均量的 1.5 倍
  const vols = s
    .slice(-21, -1)
    .map((p) => p.volume)
    .filter((v): v is number => v != null && v > 0);
  if (last.volume && last.volume > 0 && vols.length >= 10) {
    const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
    if (avg > 0 && last.volume >= avg * 1.5) moveTxt += ' 放量';
  }

  // 位置：距年内实际高低点
  const hl = actualHighLow(s);
  const price = d.price > 0 ? d.price : last.close;
  let posTxt = '';
  if (hl) {
    const distHigh = ((hl.high - price) / hl.high) * 100;
    const distLow = ((price - hl.low) / hl.low) * 100;
    if (distHigh <= 3) posTxt = '接近年内高点';
    else if (distLow <= 3) posTxt = '接近年内低点';
    else posTxt = `距年内高点 ${distHigh.toFixed(0)}%`;
  }

  // 律动 + 行动提示
  const j = d.judgment;
  const rhythmTxt = j.statusKey ? `律动 ${j.score} 分${STATUS_LABELS[j.statusKey]}` : '律动数据不足';
  const tip = (j.statusKey && ACTION_TIP[j.statusKey]) || '';

  const label = name && name !== symbol ? `${symbol} ${name}` : symbol;
  const tail = [posTxt, rhythmTxt, tip].filter(Boolean).join('，');
  return `${label} ${moveTxt}，${tail}`;
}

/* ---------------- 诊断卡多空一句话 ---------------- */

/**
 * 由律动三因子自动拼多空两句话，不向用户暴露"分量"术语。
 * 最强的看多因子 -> 多头理由，最强的看空因子 -> 空头理由。
 */
export function bullBearLines(
  pos: number,
  trend: number,
  vel: number,
): { bull: string; bear: string } {
  const bullC: Array<[number, string]> = [];
  const bearC: Array<[number, string]> = [];

  if (pos >= 65) {
    bullC.push([pos, '位置站得高，顺风好走']);
    bearC.push([pos, '位置已高，追高胜率低']);
  } else if (pos <= 35) {
    bullC.push([100 - pos, '位置够低，往下空间有限']);
    bearC.push([100 - pos, '位置这么低，市场自有它的担心']);
  }
  if (trend >= 65) bullC.push([trend, '趋势确实强']);
  else if (trend <= 35) bearC.push([100 - trend, '趋势还在往下走']);
  if (vel >= 65) bearC.push([vel, '涨太急，小心回调']);
  else if (vel <= 35) bullC.push([100 - vel, '涨得不快，不算疯']);

  const pick = (c: Array<[number, string]>) =>
    c.length > 0 ? c.sort((a, b) => b[0] - a[0])[0][1] : null;
  return {
    bull: pick(bullC) ?? '没明显的多头信号',
    bear: pick(bearC) ?? '没明显的空头信号',
  };
}

/* ---------------- K线关键价位 ---------------- */

export interface KeyLevel {
  label: string;
  price: number;
  /** rgba 虚线颜色 */
  color: string;
}

/**
 * 关键价位：年内最高 / 年内最低 / 50 日均线 / 年内低点→高点的
 * 黄金分割回撤 0.382 / 0.5 / 0.618。细虚线 + 轴上小标签，不喧宾夺主。
 * 需要至少 50 个点（算 MA50）；不够返回 null。
 */
export function computeKeyLevels(d: RhythmResponse): KeyLevel[] | null {
  const s = d.series;
  if (s.length < 50) return null;
  const hl = actualHighLow(s);
  if (!hl) return null;
  const closes = s.map((p) => p.close);
  const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const out: KeyLevel[] = [
    { label: '年高', price: hl.high, color: 'rgba(244,114,182,0.55)' },
    { label: '年低', price: hl.low, color: 'rgba(56,189,248,0.55)' },
    { label: 'MA50', price: ma50, color: 'rgba(167,139,250,0.55)' },
  ];
  for (const r of [0.382, 0.5, 0.618]) {
    out.push({
      label: String(r),
      price: hl.low + (hl.high - hl.low) * r,
      color: 'rgba(212,160,23,0.5)',
    });
  }
  return out;
}
