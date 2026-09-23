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
