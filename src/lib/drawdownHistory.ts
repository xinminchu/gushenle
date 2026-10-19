/**
 * 历史对照：大跌那天的"历史锚"。
 *
 * 方法（向"美股拆解"那种回测致敬，但用自己的数据和方法）：
 * - 事件定义：单日跌幅 ≤ 阈值（如下跌超 1.5%）的每个交易日；
 * - 去重：上一事件还没涨回跌前收盘价之前的新事件不计入（"每轮只算一次"）；
 * - 对每个事件，算多少个交易日后收盘价回到跌前水平（数据不够判定的记为未收复）。
 *
 * 只摆历史事实，不预测，不给操作建议。
 */

export interface DropEvent {
  /** 跌的那天 YYYY-MM-DD */
  date: string;
  /** 单日跌幅（负数，如 -2.31） */
  dropPct: number;
  /** 跌前收盘价 */
  preClose: number;
  /** 收复失地用的交易日数；数据窗口内没收复则为 null */
  recoverDays: number | null;
}

export interface DrawdownStats {
  /** 样本跨度（年，保留 1 位小数） */
  spanYears: number;
  /** 触发阈值（负数，如 -1.5） */
  threshold: number;
  /** 符合条件的事件数 */
  count: number;
  /** 其中已收复的事件数 */
  recoveredCount: number;
  /** 收复用时的中位数（交易日）；无收复样本则为 null */
  medianRecoverDays: number | null;
  /** 最惨的一次（用时最长；未收复的排在最前） */
  worst: DropEvent | null;
  /** 全部事件（按日期倒序） */
  events: DropEvent[];
}

export interface Bar {
  date: string;
  close: number;
}

/**
 * 从日线序列中提取"大跌事件"。
 * @param bars 按日期升序的日线
 * @param threshold 触发阈值（负数，如 -1.5 表示单日跌超 1.5%）
 */
export function analyzeDrops(bars: Bar[], threshold: number): DrawdownStats {
  const events: DropEvent[] = [];
  const n = bars.length;

  let i = 1;
  while (i < n) {
    const prev = bars[i - 1].close;
    const cur = bars[i].close;
    if (!prev || !cur) {
      i++;
      continue;
    }
    const dropPct = ((cur - prev) / prev) * 100;
    if (dropPct > threshold) {
      i++;
      continue;
    }
    // 找到一个事件：从 i+1 起找第一个收盘价 ≥ 跌前收盘价的交易日
    let recoverDays: number | null = null;
    for (let j = i + 1; j < n; j++) {
      if (bars[j].close >= prev) {
        recoverDays = j - i;
        break;
      }
    }
    events.push({ date: bars[i].date, dropPct: +dropPct.toFixed(2), preClose: prev, recoverDays });
    // 去重：涨回跌前收盘价之前的新事件不计入
    if (recoverDays != null) {
      i = i + recoverDays + 1;
    } else {
      // 没收复：跳到序列末尾（后面都是同一轮下跌的一部分）
      break;
    }
  }

  const recovered = events.filter((e) => e.recoverDays != null);
  const sorted = [...recovered].sort((a, b) => (a.recoverDays as number) - (b.recoverDays as number));
  const medianRecoverDays =
    sorted.length === 0
      ? null
      : sorted.length % 2 === 1
        ? sorted[(sorted.length - 1) / 2].recoverDays
        : Math.round(
            ((sorted[sorted.length / 2 - 1].recoverDays as number) +
              (sorted[sorted.length / 2].recoverDays as number)) /
              2,
          );

  // 最惨：未收复的优先（按日期最早），其次是收复用时最长的
  const unrecovered = events.filter((e) => e.recoverDays == null);
  const worst =
    unrecovered.length > 0
      ? unrecovered[0]
      : sorted.length > 0
        ? sorted[sorted.length - 1]
        : null;

  const spanYears =
    n >= 2
      ? Math.max(
          0.1,
          Math.round(
            ((new Date(bars[n - 1].date).getTime() - new Date(bars[0].date).getTime()) /
              (365.25 * 24 * 3600 * 1000)) *
              10,
          ) / 10,
        )
      : 0;

  return {
    spanYears,
    threshold,
    count: events.length,
    recoveredCount: recovered.length,
    medianRecoverDays,
    worst,
    events: [...events].reverse(),
  };
}
