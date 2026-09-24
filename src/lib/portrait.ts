// src/lib/portrait.ts
// 我的投资画像：纯函数，本地计算。口径与操作记忆的复盘小结完全一致
// （verdictFor：卖出后涨了=卖飞，买入后跌了=买高；20 天优先、5 天兜底）。

import { verdictFor, type OperationRecord } from './operations';

export interface PortraitWorst {
  op: OperationRecord;
  pct: number; // 卖飞为正（涨了多少），买高为负（跌了多少）
}

export interface PortraitSide {
  total: number; // 有复盘结果的笔数（含持平）
  bad: number; // 卖飞 / 买高笔数
  rate: number | null; // bad / total；样本不足时为 null（养成中）
  worst: PortraitWorst | null; // 最可惜 / 最惨的一笔
}

export interface Portrait {
  sell: PortraitSide; // 卖飞率
  buy: PortraitSide; // 买高率
}

/** 单边至少 3 笔有结果才给比率，少了就是玄学 */
export const PORTRAIT_MIN_SAMPLE = 3;

const blank = (): PortraitSide => ({ total: 0, bad: 0, rate: null, worst: null });

export function computePortrait(
  ops: OperationRecord[],
  reviews: Record<string, { r5: number | null; r20: number | null }>,
): Portrait {
  const sell = blank();
  const buy = blank();
  for (const op of ops) {
    const rv = reviews[op.id];
    if (!rv) continue;
    const fwd = rv.r20 ?? rv.r5;
    const v = verdictFor(op.action, fwd);
    if (!v || fwd == null) continue;
    const side = op.action === 'sell' ? sell : buy;
    side.total += 1;
    if (!v.good) {
      side.bad += 1;
      const pct = fwd;
      if (
        !side.worst ||
        (op.action === 'sell' ? pct > side.worst.pct : pct < side.worst.pct)
      ) {
        side.worst = { op, pct };
      }
    }
  }
  for (const s of [sell, buy]) {
    if (s.total >= PORTRAIT_MIN_SAMPLE) s.rate = s.total > 0 ? s.bad / s.total : 0;
  }
  return { sell, buy };
}

/** 一句话人话总结：只陈述事实，不贴人格标签 */
export function portraitSummary(p: Portrait): string | null {
  const { sell, buy } = p;
  if (sell.rate == null && buy.rate == null) return null;
  const bits: string[] = [];
  if (sell.rate != null) {
    bits.push(
      sell.rate >= 0.5
        ? `卖飞率 ${Math.round(sell.rate * 100)}%，一半以上的卖出卖早了`
        : sell.rate === 0
          ? '卖出时机把握得不错，还没卖飞过'
          : `卖飞率 ${Math.round(sell.rate * 100)}%，卖出节奏基本靠谱`,
    );
  }
  if (buy.rate != null) {
    bits.push(
      buy.rate >= 0.5
        ? `买高率 ${Math.round(buy.rate * 100)}%，一半以上的买入买在了高点`
        : buy.rate === 0
          ? '买入时机把握得不错，还没买高过'
          : `买高率 ${Math.round(buy.rate * 100)}%，买入节奏基本靠谱`,
    );
  }
  return bits.join('；') + '。';
}

/**
 * 画像反哺：从买入操作里统计单笔投入金额的中位数。
 * 本周关注问预算时直接反填——"你过去单笔通常 X 元左右"，越用越准。
 * 返回 null 表示样本不足（买入笔数 < 1）。
 */
export function typicalBuyAmount(ops: OperationRecord[]): number | null {
  const amounts: number[] = [];
  for (const op of ops) {
    if (op.action !== 'buy') continue;
    if (!(op.price > 0)) continue;
    const qty = op.qty && op.qty > 0 ? op.qty : 1;
    amounts.push(op.price * qty);
  }
  if (amounts.length === 0) return null;
  amounts.sort((a, b) => a - b);
  const mid = Math.floor(amounts.length / 2);
  const median =
    amounts.length % 2 === 1 ? amounts[mid] : (amounts[mid - 1] + amounts[mid]) / 2;
  return Math.round(median);
}
