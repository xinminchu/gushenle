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
  '茅台': '600519', // A股：数据可能没有，提取出来再说，查不到会友好提示
};

/** 代码 -> 中文名（单只咨询卡展示用） */
export const STOCK_NAMES: Record<string, string> = {
  AAPL: '苹果', MSFT: '微软', NVDA: '英伟达', TSLA: '特斯拉',
  INTC: '英特尔', GOOGL: '谷歌', AMZN: '亚马逊', META: 'Meta',
  NFLX: '奈飞', AMD: '超微', QCOM: '高通', AVGO: '博通',
  TSM: '台积电', BABA: '阿里巴巴', MU: '美光', COIN: 'Coinbase',
  MSTR: '微策略', IBM: 'IBM', ORCL: '甲骨文', ADBE: 'Adobe',
  CRM: '赛富时', PDD: '拼多多', JD: '京东', BIDU: '百度',
  PLTR: 'Palantir', SMCI: '超微电脑', DELL: '戴尔', HPQ: '惠普',
  CSCO: '思科', WMT: '沃尔玛', KO: '可口可乐',
};

/** 已知的美股代码集合：从文本里抓大写代码时，只有命中这里才认，避免把"AI"当成股票 */
const KNOWN_TICKERS = new Set<string>([
  ...Object.values(STOCK_ALIASES),
  'IBM', 'GOOG', 'NFLX', 'AMD', 'INTC', 'MU', 'COIN', 'MSTR',
  'PLTR', 'SMCI', 'DELL', 'HPQ', 'CSCO', 'ORCL', 'ADBE', 'CRM',
  'PDD', 'JD', 'BIDU', 'WMT', 'KO', 'PEP', 'DIS', 'NKE', 'BA',
  'XOM', 'JPM', 'V', 'MA', 'LLY', 'UNH', 'COST', 'AVGO', 'QCOM',
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
