/**
 * 操作记忆的本地意图解析：纯函数，不依赖 AI。
 * 意图四选一：advice（咨询）/ record（记一笔）/ correct（更正上一笔）/ unknown。
 *
 * 从路由里抽出来，方便单测。生产环境经常没有 GEMINI_API_KEY，
 * 核心链路（记一笔、改一笔）必须本地确定性可用。
 */
import { extractSymbol } from '@/lib/stockAliases';
import { normalizeSpeechText } from '@/lib/cnNumber';

/** 明确的咨询信号（想买/能不能/疑问语气…） */
const ADVICE_WANT =
  /想买|要买|打算买|考虑买|买什么|推荐|建议|怎么看|怎么样|能不能|可不可以|该买|该卖|要不要|卖不卖|买哪|值得买|抄底吗|现在买|现在卖|可以买|可以卖|还拿着吗|拿着吗|是否|吗|？|\?/;
/** 真实发生的动作（买了/卖了…） */
const DONE_MARKER = /(买了|卖了|买入|卖出|加仓了|减仓了|建仓了|清仓了|入手)/;
/** 买卖词 */
const BUY_WORD = /(买入|买进|加仓|建仓|抄底|买)/;
const SELL_WORD = /(卖出|卖掉|减仓|清仓|止盈|卖)/;
/** 更正信号：说错了/改成…（优先于咨询和记录，因为"刚才那笔单价说错了"里也可能带买卖词） */
const CORRECT_MARKER =
  /(说错了|报错了|报高了|报低了|记错了|写错了|搞错了|改成|改为|更正|应该是|不对[，,]?\s*是)/;

export type LocalIntent =
  | { intent: 'advice'; symbol: string | null; side: 'buy' | 'sell' }
  | { intent: 'record'; data: RecordParse }
  | { intent: 'correct'; data: CorrectParse }
  | { intent: 'unknown' };

export interface RecordParse {
  intent: 'record';
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number | null;
  qty: number | null;
  opDate: string | null;
  thesis: string;
  emotion: string;
}

export interface CorrectParse {
  intent: 'correct';
  /** price=单价 qty=数量 date=日期 action=方向 */
  field: 'price' | 'qty' | 'date' | 'action';
  /** price/qty: 数字；date: YYYY-MM-DD；action: 'buy'|'sell' */
  value: number | string | null;
  /** 点名了哪只股票就改那只的最近一笔，否则改最近一笔 */
  symbol: string | null;
}

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function parseDate(text: string): string | null {
  if (/前天/.test(text)) return todayStr(-2);
  if (/昨天|昨日/.test(text)) return todayStr(-1);
  if (/今天|今日|刚才|刚刚/.test(text)) return todayStr(0);
  const m = text.match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (m) {
    const y = new Date().getFullYear();
    const mm = m[1].padStart(2, '0');
    const dd = m[2].padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  }
  return null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

interface PriceHit {
  value: number;
  matched: string; // 命中的原文片段，供调用方剔除后继续提数量
}

function matchPrice(text: string): PriceHit | null {
  // 中文口语：227块9毛2（分恒为一位数；"一毛九五股"里 9 是分、5 是股数）
  let m = text.match(/(\d+(?:\.\d+)?)\s*块\s*(\d+)\s*毛\s*(\d)?/);
  if (m)
    return {
      value: round6(
        parseFloat(m[1]) + parseInt(m[2], 10) * 0.1 + (m[3] ? parseInt(m[3], 10) * 0.01 : 0),
      ),
      matched: m[0],
    };
  // 中文口语：两块五（=2.5；但"2块5股"是 2 块+5 股，不这么读）
  m = text.match(/(\d+(?:\.\d+)?)\s*块\s*(\d)(?!\s*股)(?![0-9])/);
  if (m)
    return { value: round6(parseFloat(m[1]) + parseInt(m[2], 10) * 0.1), matched: m[0] };
  // 中文口语：九毛二（=0.92，不到一块的价）
  m = text.match(/(\d+)\s*毛\s*(\d)?/);
  if (m)
    return {
      value: round6(parseInt(m[1], 10) * 0.1 + (m[2] ? parseInt(m[2], 10) * 0.01 : 0)),
      matched: m[0],
    };
  // 单价/价格/成交价 是 227.92（"单价说错了是227.92"中间隔几个字也认）
  m = text.match(/(单价|价格|成交价|均价|成本价?|股价)[^0-9]{0,6}(\d+(?:\.\d+)?)/);
  if (m) return { value: parseFloat(m[2]), matched: m[0] };
  // 动作词前的数字：今天235卖了…
  m = text.match(/(\d+(?:\.\d+)?)\s*(买了|卖了|买入|卖出|加仓|减仓|建仓|清仓)/);
  if (m) return { value: parseFloat(m[1]), matched: m[0] };
  // 动作词后的数字：买了IBM 227.92（排除"卖了100股"这种数量）
  m = text.match(/(买了|卖了|买入|卖出|加仓|减仓|建仓|清仓)[^0-9]{0,8}(\d+(?:\.\d+)?)(?!\s*股)(?![0-9.])/);
  if (m) return { value: parseFloat(m[2]), matched: m[0] };
  m = text.match(/[@＠]\s*(\d+(?:\.\d+)?)/);
  if (m) return { value: parseFloat(m[1]), matched: m[0] };
  m = text.match(/(\d+(?:\.\d+)?)\s*(元|块|美元|美金)/);
  if (m) return { value: parseFloat(m[1]), matched: m[0] };
  return null;
}

/** 价格提取：文本需先经过 normalizeSpeechText */
export function parsePrice(text: string): number | null {
  const hit = matchPrice(text);
  return hit ? hit.value : null;
}

function parseRecord(text: string, symbol: string): RecordParse {
  const isSell = SELL_WORD.test(text) && !BUY_WORD.test(text) ? true
    : BUY_WORD.test(text) && !SELL_WORD.test(text) ? false
    : /卖/.test(text); // 都有提到时，默认按卖处理（用户多半在说卖）
  const hit = matchPrice(text);
  // 先抠掉价格命中的片段再提数量，避免"217块1毛95股"里分位的 9 被吞成 95 股
  const restForQty = hit ? text.replace(hit.matched, ' ') : text;
  const qtyM = restForQty.match(/(\d+)\s*股/);
  return {
    intent: 'record',
    symbol,
    action: isSell ? 'SELL' : 'BUY',
    price: hit ? hit.value : null,
    qty: qtyM ? parseInt(qtyM[1], 10) : null,
    opDate: parseDate(text),
    thesis: '',
    emotion: '冷静',
  };
}

function parseCorrect(text: string, symbol: string | null): CorrectParse {
  let field: CorrectParse['field'] = 'price';
  if (/(数量|股数)/.test(text)) field = 'qty';
  else if (/(日期|时间|日子)/.test(text)) field = 'date';
  else if (/(方向|改成买入|改成卖出|改为买入|改为卖出)/.test(text)) field = 'action';
  // 其余默认改单价（"刚才那笔说错了是227.92"）

  let value: number | string | null = null;
  if (field === 'qty') {
    const m = text.match(/(\d+)\s*股/);
    value = m ? parseInt(m[1], 10) : null;
  } else if (field === 'price') {
    value = parsePrice(text);
    if (value == null) {
      // 更正的新值永远在句尾（"刚才那1笔的单价说错了是227.92"），取最后一个数字
      const all = text.match(/(\d+(?:\.\d+)?)(?!\s*股)(?![0-9.])/g);
      value = all && all.length > 0 ? parseFloat(all[all.length - 1]) : null;
    }
  } else if (field === 'date') {
    value = parseDate(text);
  } else {
    const sell = SELL_WORD.test(text);
    const buy = BUY_WORD.test(text);
    value = sell && !buy ? 'sell' : buy && !sell ? 'buy' : null;
  }
  return { intent: 'correct', field, value, symbol };
}

/**
 * 本地意图识别。返回 unknown 表示本地拿不准，调用方再决定要不要问 Gemini。
 */
export function localParse(rawText: string): LocalIntent {
  const text = normalizeSpeechText(rawText.trim());
  if (!text) return { intent: 'unknown' };
  const symbol = extractSymbol(text);

  // 0) 更正上一笔：优先判断
  if (CORRECT_MARKER.test(text)) {
    return { intent: 'correct', data: parseCorrect(text, symbol) };
  }
  // 1) 明确的咨询信号 -> advice
  if (ADVICE_WANT.test(text)) {
    const sell = SELL_WORD.test(text);
    const buy = BUY_WORD.test(text);
    const side = sell && !buy ? 'sell' : 'buy';
    return { intent: 'advice', symbol, side };
  }
  // 2) 真实发生的动作 -> record（必须能提取到股票，否则当 unknown）
  if (DONE_MARKER.test(text)) {
    if (!symbol) return { intent: 'unknown' };
    return { intent: 'record', data: parseRecord(text, symbol) };
  }
  // 3) 陈述句里提到买卖 + 具体股票，倾向于是记一笔（缺字段走表单补）
  if ((BUY_WORD.test(text) || SELL_WORD.test(text)) && symbol) {
    return { intent: 'record', data: parseRecord(text, symbol) };
  }
  return { intent: 'unknown' };
}
