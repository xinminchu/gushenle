import { loadPositions } from './positions';
import { loadOperations } from './operations';
import { getRhythm } from './market';
import { statusLabel, type SignalStatusKey } from './rhythm';
import type { Lang } from './i18n';

/**
 * 卖出冷静：记"卖出"时，若同时满足
 *   ① 有持仓且浮亏超过阈值
 *   ② 当前律动信号是"跌不动了"/"跌过头了"
 * 则先弹三眼（买入理由 / 信号应验率 / 回本线），用户看完再决定。
 * 这是摩擦不是拦截：用户仍可继续卖出。
 */

export const SELL_COOLDOWN_LOSS_PCT = -10; // 浮亏触发线（%）
const COOLDOWN_KEYS: SignalStatusKey[] = ['bottomUp', 'oversoldBottom'];

export interface CooldownSignalStat {
  label: string;
  total: number;
  accuracy: number | null;
  baseline: number | null;
  edge: number | null;
}

export interface CooldownData {
  symbol: string;
  price: number;
  lossPct: number;
  avgCost: number;
  shares: number;
  thesis: string | null;
  statusKey: SignalStatusKey;
  statusLabel: string;
  stat: CooldownSignalStat | null;
  recentLow: number | null; // 近3月分位低点（5%）
}

/** 不满足触发条件返回 null；满足则返回三眼数据 */
export async function checkSellCooldown(
  symbol: string,
  price: number,
  lang: Lang = 'zh',
): Promise<CooldownData | null> {
  const sym = symbol.toUpperCase();
  const pos = loadPositions().find((p) => p.symbol.toUpperCase() === sym);
  if (!pos || !(pos.avgCost > 0) || !(price > 0)) return null;
  const lossPct = ((price - pos.avgCost) / pos.avgCost) * 100;
  if (lossPct > SELL_COOLDOWN_LOSS_PCT) return null;

  let rhythm;
  try {
    rhythm = await getRhythm(sym, '3m', { lang: 'zh' });
  } catch {
    return null;
  }
  const key = rhythm.judgment.statusKey as SignalStatusKey;
  if (!COOLDOWN_KEYS.includes(key)) return null;

  // ① 买入理由：最近一条有 thesis 的买入
  const buys = loadOperations()
    .filter((o) => o.symbol.toUpperCase() === sym && o.action === 'buy')
    .sort((a, b) => b.createdAt - a.createdAt);
  const thesis = buys.find((o) => o.thesis && o.thesis.trim())?.thesis?.trim() ?? null;

  // ② 信号应验率：读判断复盘台账
  let stat: CooldownSignalStat | null = null;
  try {
    const r = await fetch(`/api/accuracy?symbol=${encodeURIComponent(sym)}&lang=${lang}`);
    const j = await r.json();
    const s = j?.stats?.statuses?.[key];
    if (s) {
      stat = {
        label: String(s.label ?? ''),
        total: Number(s.total ?? 0),
        accuracy: s.accuracy == null ? null : Number(s.accuracy),
        baseline: s.baseline == null ? null : Number(s.baseline),
        edge: s.edge == null ? null : Number(s.edge),
      };
    }
  } catch {
    stat = null;
  }

  return {
    symbol: sym,
    price,
    lossPct,
    avgCost: pos.avgCost,
    shares: pos.shares,
    thesis,
    statusKey: key,
    statusLabel: statusLabel(key, lang),
    stat,
    recentLow: rhythm.low > 0 ? rhythm.low : null,
  };
}
