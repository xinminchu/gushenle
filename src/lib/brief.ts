// 一句话播报 + 诊断卡多空一句话 + K线关键价位计算。
// 全部本地确定性逻辑，不调 AI、不新增接口。
// 口径：只讲事实和纪律（拦追高、拦割肉），不预测涨跌。

import type { RhythmResponse, RhythmPoint } from './rhythm';
import { statusLabel } from './rhythm';
import type { Lang } from '@/lib/i18n';
import { tx } from '@/lib/hant';

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

/** 行动提示英文版：商量式语气 */
const ACTION_TIP_EN: Record<string, string> = {
  overheated: 'Careful chasing',
  hotStrong: 'Fine to hold, skip the chase',
  risingAccel: "Picking up speed — don't chase",
  sideways: 'Wait and see',
  bottomUp: 'Selling pressure easing — no rush to cut',
  weakLow: "Still falling — don't catch the knife",
  oversoldBottom: 'No rush to cut losses',
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
export function buildBrief(symbol: string, name: string, d: RhythmResponse, lang: Lang = 'zh'): string | null {
  if (d.source === 'simulated') return null;
  const s = d.series;
  if (s.length < 2) return null;

  // 当日涨跌：用日线最后两根收盘价（盘中/收盘都一致）
  const last = s[s.length - 1];
  const prev = s[s.length - 2];
  const chg = prev.close > 0 ? ((last.close - prev.close) / prev.close) * 100 : 0;

  let moveTxt: string;
  if (chg >= 3) moveTxt = tx(lang, `Up big ${chg.toFixed(1)}%`, `大涨 ${chg.toFixed(1)}%`);
  else if (chg <= -3) moveTxt = tx(lang, `Down big ${Math.abs(chg).toFixed(1)}%`, `大跌 ${Math.abs(chg).toFixed(1)}%`);
  else moveTxt = chg >= 0 ? `+${chg.toFixed(1)}%` : `${chg.toFixed(1)}%`;

  // 放量：最后一根成交量 >= 前 20 根均量的 1.5 倍
  const vols = s
    .slice(-21, -1)
    .map((p) => p.volume)
    .filter((v): v is number => v != null && v > 0);
  if (last.volume && last.volume > 0 && vols.length >= 10) {
    const avg = vols.reduce((a, b) => a + b, 0) / vols.length;
    if (avg > 0 && last.volume >= avg * 1.5) moveTxt += tx(lang, ' on heavy volume', ' 放量');
  }

  // 位置：距年内实际高低点
  const hl = actualHighLow(s);
  const price = d.price > 0 ? d.price : last.close;
  let posTxt = '';
  if (hl) {
    const distHigh = ((hl.high - price) / hl.high) * 100;
    const distLow = ((price - hl.low) / hl.low) * 100;
    if (distHigh <= 3) posTxt = tx(lang, 'Near the 1-year high', '接近年内高点');
    else if (distLow <= 3) posTxt = tx(lang, 'Near the 1-year low', '接近年内低点');
    else posTxt = tx(lang, `${distHigh.toFixed(0)}% below the 1-year high`, `距年内高点 ${distHigh.toFixed(0)}%`);
  }

  // 律动 + 行动提示
  const j = d.judgment;
  const rhythmTxt = j.statusKey
    ? tx(lang, `Rhythm ${j.score} — ${statusLabel(j.statusKey, 'en')}`, `律动 ${j.score} 分${statusLabel(j.statusKey, 'zh')}`)
    : tx(lang, 'Not enough rhythm data', '律动数据不足');
  const tip = (j.statusKey && (lang === 'en' ? ACTION_TIP_EN[j.statusKey] : ACTION_TIP[j.statusKey])) || '';

  const label = name && name !== symbol ? `${symbol} ${name}` : symbol;
  const sep = tx(lang, ', ', '，');
  const tail = [posTxt, rhythmTxt, tip].filter(Boolean).join(sep);
  return `${label} ${moveTxt}${sep}${tail}`;
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
  lang: Lang = 'zh',
): { bull: string; bear: string } {
  const en = lang === 'en';
  const bullC: Array<[number, string]> = [];
  const bearC: Array<[number, string]> = [];

  if (pos >= 65) {
    bullC.push([pos, tx(lang, 'Position is high — tailwind is easy', '位置站得高，顺风好走')]);
    bearC.push([pos, tx(lang, 'Position is high — chasing has low win rate', '位置已高，追高胜率低')]);
  } else if (pos <= 35) {
    bullC.push([100 - pos, tx(lang, 'Position is low — limited room below', '位置够低，往下空间有限')]);
    bearC.push([100 - pos, tx(lang, 'This low — the market has its worries', '位置这么低，市场自有它的担心')]);
  }
  if (trend >= 65) bullC.push([trend, tx(lang, 'Trend is genuinely strong', '趋势确实强')]);
  else if (trend <= 35) bearC.push([100 - trend, tx(lang, 'Trend is still heading down', '趋势还在往下走')]);
  if (vel >= 65) bearC.push([vel, tx(lang, 'Up too fast — beware a pullback', '涨太急，小心回调')]);
  else if (vel <= 35) bullC.push([100 - vel, tx(lang, 'Not rising fast — not euphoric', '涨得不快，不算疯')]);

  const pick = (c: Array<[number, string]>) =>
    c.length > 0 ? c.sort((a, b) => b[0] - a[0])[0][1] : null;
  return {
    bull: pick(bullC) ?? (tx(lang, 'No clear bullish signal', '没明显的多头信号')),
    bear: pick(bearC) ?? (tx(lang, 'No clear bearish signal', '没明显的空头信号')),
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
/**
 * 关键价位：年内最高 / 年内最低 / 50 日均线。
 * 分工：回撤线归「黄金分割」模式管（两处曾用不同锚导致 0.618 打架，
 * 2026-09-28 起关键价位不再画回撤线，只留大位置，避免重复）。
 */
export function computeKeyLevels(
  d: RhythmResponse,
  lang: Lang = 'zh',
): KeyLevel[] | null {
  const s = d.series;
  if (s.length < 50) return null;
  const hl = actualHighLow(s);
  if (!hl) return null;
  const closes = s.map((p) => p.close);
  const ma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
  const en = lang === 'en';
  return [
    { label: tx(lang, '1Y high', '年高'), price: hl.high, color: 'rgba(244,114,182,0.55)' },
    { label: tx(lang, '1Y low', '年低'), price: hl.low, color: 'rgba(56,189,248,0.55)' },
    { label: 'MA50', price: ma50, color: 'rgba(167,139,250,0.55)' },
  ];
}
