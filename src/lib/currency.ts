/**
 * 币种小帮手：目前只有韩股（.KS 后缀）是韩元计价，其余按美元处理。
 * 韩元面额大（动辄上百万），显示时取整加千分位；美元保留两位小数。
 */

/** 是否韩元计价 */
export const isKrwSymbol = (symbol: string): boolean =>
  symbol.toUpperCase().endsWith('.KS');

/** 货币符号：₩ / $ */
export const currencySym = (symbol: string): string =>
  isKrwSymbol(symbol) ? '₩' : '$';

/** 价格格式化（含货币符号），直接用于展示 */
export const fmtMoney = (symbol: string, p: number): string =>
  `${currencySym(symbol)}${
    isKrwSymbol(symbol) ? Math.round(p).toLocaleString('en-US') : p.toFixed(2)
  }`;

/** 大金额紧凑格式：$1.2B / $350M / $800K（资金流向用） */
export const fmtCompactMoney = (symbol: string, v: number): string => {
  const sym = currencySym(symbol);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1e9) return `${sign}${sym}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${sign}${sym}${(abs / 1e6).toFixed(0)}M`;
  if (abs >= 1e3) return `${sign}${sym}${(abs / 1e3).toFixed(0)}K`;
  return fmtMoney(symbol, v);
};
