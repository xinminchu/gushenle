/**
 * 股票别名库：中文名/常见叫法 -> 代码。
 * 给本地意图解析用，不依赖 AI 也能从"想买英特尔"里提取出 INTC。
 */

/** 别名 -> 代码（key 全小写，匹配时转小写） */
export const STOCK_ALIASES: Record<string, string> = {
  '苹果': 'AAPL', 'apple': 'AAPL',
  '微软': 'MSFT', 'microsoft': 'MSFT',
  '英伟达': 'NVDA', 'nvidia': 'NVDA', '英伟达公司': 'NVDA',
  '特斯拉': 'TSLA', 'tesla': 'TSLA',
  '英特尔': 'INTC', 'intel': 'INTC',
  '谷歌': 'GOOGL', 'google': 'GOOGL', '字母表': 'GOOGL',
  '亚马逊': 'AMZN', 'amazon': 'AMZN',
  '脸书': 'META', 'meta': 'META', 'facebook': 'META',
  '奈飞': 'NFLX', 'netflix': 'NFLX', '网飞': 'NFLX',
  '超微': 'AMD', 'amd': 'AMD',
  '高通': 'QCOM', 'qualcomm': 'QCOM',
  '博通': 'AVGO', 'broadcom': 'AVGO',
  '台积电': 'TSM', 'tsmc': 'TSM',
  '阿里': 'BABA', '阿里巴巴': 'BABA', 'alibaba': 'BABA',
  '美光': 'MU', 'micron': 'MU',
  '币基': 'COIN', 'coinbase': 'COIN',
  '微策略': 'MSTR', 'microstrategy': 'MSTR',
  '甲骨文': 'ORCL', 'oracle': 'ORCL',
  '奥多比': 'ADBE', 'adobe': 'ADBE',
  '赛富时': 'CRM', 'salesforce': 'CRM',
  '拼多多': 'PDD', 'pdd': 'PDD', 'pinduoduo': 'PDD',
  '京东': 'JD', 'jd': 'JD',
  '百度': 'BIDU', 'bidu': 'BIDU',
  '帕兰提尔': 'PLTR', 'palantir': 'PLTR',
  '超微电脑': 'SMCI', 'smci': 'SMCI',
  '戴尔': 'DELL', 'dell': 'DELL',
  '惠普': 'HPQ', 'hp': 'HPQ',
  '思科': 'CSCO', 'cisco': 'CSCO',
  '奈飞公司': 'NFLX',
  '沃尔玛': 'WMT', 'walmart': 'WMT',
  '可口可乐': 'KO', 'coca-cola': 'KO',
  '小火箭': 'RKLB', '火箭实验室': 'RKLB', 'rocket lab': 'RKLB',
  '海力士': 'SKHY', 'sk海力士': 'SKHY', 'sk hynix': 'SKHY', 'hynix': 'SKHY', 'skhy': 'SKHY',
  '红猫': 'RCAT', 'red cat': 'RCAT', 'rcat': 'RCAT',
  '航境': 'AVAV', 'avav': 'AVAV', 'aerovironment': 'AVAV',
  '克拉托斯': 'KTOS', 'ktos': 'KTOS', 'kratos': 'KTOS',
  '星空移动': 'ASTS', 'asts': 'ASTS', 'ast spacemobile': 'ASTS',
  '直觉机器': 'LUNR', 'lunr': 'LUNR', 'intuitive machines': 'LUNR',
  'ionq': 'IONQ', 'rigetti': 'RGTI', 'rgti': 'RGTI', 'd-wave': 'QBTS', 'qbts': 'QBTS', 'd wave': 'QBTS',
  '游戏驿站': 'GME', 'gme': 'GME', 'gamestop': 'GME',
  'amc院线': 'AMC', 'amc': 'AMC',
  '特朗普媒体': 'DJT', 'djt': 'DJT', 'trump media': 'DJT',
  'oklo': 'OKLO', 'nuscale': 'SMR', 'smr': 'SMR',
  'joby': 'JOBY', 'archer': 'ACHR', 'achr': 'ACHR',
  'mp材料': 'MP', 'mp': 'MP',
  '美洲锂业': 'LAC', 'lac': 'LAC', 'lithium americas': 'LAC',
  '茅台': '600519', // A股：数据可能没有，提取出来再说，查不到会友好提示
};

import { STOCK_LIST } from './stockList';

/** 代码 -> 中文名（单只咨询卡展示用）；从全栈名单库派生，单一数据源 */
export const STOCK_NAMES: Record<string, string> = Object.fromEntries(
  STOCK_LIST.map((s) => [s.code, s.zh]),
);

/** 已知的美股代码集合：从文本里抓大写代码时，只有命中这里才认，避免把"AI"当成股票 */
const KNOWN_TICKERS = new Set<string>([
  ...Object.values(STOCK_ALIASES),
  ...STOCK_LIST.map((s) => s.code),
]);

/**
 * 从一句话里提取股票代码。
 * 先找大写代码（如 IBM），再找中文别名（如 英特尔），找不到返回 null。
 */
export function extractSymbol(text: string): string | null {
  // 1) 大写代码：2~5 个字母，且在已知集合里
  const tickers = text.match(/\b[A-Z]{2,5}\b/g) || [];
  for (const t of tickers) {
    if (KNOWN_TICKERS.has(t)) return t;
  }
  // 1b) 数字代码（如韩股 000660.KS）
  const numTickers = text.match(/\b\d{6}\.[A-Z]{2}\b/i) || [];
  for (const t of numTickers) {
    const up = t.toUpperCase();
    if (KNOWN_TICKERS.has(up)) return up;
  }
  // 2) 中文别名（按 key 长度从长到短，避免"超微"先于"超微电脑"命中）
  const lower = text.toLowerCase();
  const keys = Object.keys(STOCK_ALIASES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k && lower.includes(k.toLowerCase())) return STOCK_ALIASES[k];
  }
  return null;
}

/** 代码转中文名，找不到就返回代码本身 */
export function symbolToName(symbol: string): string {
  return STOCK_NAMES[symbol.toUpperCase()] || symbol.toUpperCase();
}
