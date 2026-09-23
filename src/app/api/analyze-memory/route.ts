import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { extractSymbol } from '@/lib/stockAliases';

/**
 * 意图识别：本地确定性解析优先，Gemini 只做增强。
 * 原因：生产环境经常没有 GEMINI_API_KEY，核心链路不能依赖它。
 */

const MODEL = 'gemini-3.6-flash';
const hasGeminiKey = () => !!process.env.GEMINI_API_KEY;

/** 明确的咨询信号（想买/能不能/疑问语气…） */
const ADVICE_WANT =
  /想买|要买|打算买|考虑买|买什么|推荐|建议|怎么看|怎么样|能不能|可不可以|该买|该卖|要不要|卖不卖|买哪|值得买|抄底吗|现在买|现在卖|可以买|可以卖|还拿着吗|拿着吗|是否|吗|？|\?/;
/** 真实发生的动作（买了/卖了…） */
const DONE_MARKER = /(买了|卖了|买入|卖出|加仓了|减仓了|建仓了|清仓了|入手)/;
/** 买卖词 */
const BUY_WORD = /(买入|买进|加仓|建仓|抄底|买)/;
const SELL_WORD = /(卖出|卖掉|减仓|清仓|止盈|卖)/;

export type LocalIntent =
  | { intent: 'advice'; symbol: string | null; side: 'buy' | 'sell' }
  | { intent: 'record'; data: RecordParse }
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

function todayStr(offsetDays = 0): string {
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

function parseRecord(text: string, symbol: string): RecordParse {
  const isSell = SELL_WORD.test(text) && !BUY_WORD.test(text) ? true
    : BUY_WORD.test(text) && !SELL_WORD.test(text) ? false
    : /卖/.test(text); // 都有提到时，默认按卖处理（用户多半在说卖）
  const qtyM = text.match(/(\d+)\s*股/);
  // 价格：动作词前面的数字（今天235卖了…）、@ 后面的数字、带单位的数字
  let price: number | null = null;
  const pm1 = text.match(/(\d+(?:\.\d+)?)\s*(买了|卖了|买入|卖出|加仓|减仓|建仓|清仓)/);
  const pm2 = text.match(/[@＠]\s*(\d+(?:\.\d+)?)/);
  const pm3 = text.match(/(\d+(?:\.\d+)?)\s*(元|块|美元|美金)/);
  const pm = pm1 || pm2 || pm3;
  if (pm) price = parseFloat(pm[1]);
  return {
    intent: 'record',
    symbol,
    action: isSell ? 'SELL' : 'BUY',
    price,
    qty: qtyM ? parseInt(qtyM[1], 10) : null,
    opDate: parseDate(text),
    thesis: '',
    emotion: '冷静',
  };
}

/**
 * 本地意图识别。返回 unknown 表示本地拿不准，调用方再决定要不要问 Gemini。
 */
export function localParse(rawText: string): LocalIntent {
  const text = rawText.trim();
  if (!text) return { intent: 'unknown' };
  const symbol = extractSymbol(text);

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

async function classifyWithGemini(rawText: string): Promise<any> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const prompt = `
    你是一个投资助手。先判断用户这句话的意图，三选一：
    - record：用户在记录一笔真实发生的买卖操作（提到买入/卖出/加仓/减仓等动作和具体股票）。
    - advice：用户在咨询投资建议（问买什么、卖不卖、怎么看某只股票、推荐、能不能买等）。
    - chat：其他闲聊、感慨，或与操作记录、投资建议无关的表达。

    只输出 JSON，不要输出其他内容：
    - 意图为 record 时：{"intent":"record","symbol":"股票代码如AAPL，未提及填UNKNOWN","action":"BUY/SELL","price":成交价数字或null,"qty":数量数字或null,"opDate":"YYYY-MM-DD，用户说今天用今天，无法判断填null","thesis":"操作理由","emotion":"情绪如冷静/冲动/谨慎/乐观"}
    - 意图为 advice 时：{"intent":"advice","symbol":"提到的股票代码或null","side":"buy/sell"}
    - 意图为 chat 时：{"intent":"chat","reply":"一句简短亲切的中文回复，说明这句话记不了一笔，引导用户说一笔具体操作（例如：今天235卖了100股AAPL）或直接问买什么建议"}

    用户原话：
    "${rawText}"
  `;
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  return JSON.parse(response.text || '{}');
}

const CHAT_FALLBACK =
  '这句话记不了一笔。说一笔操作（例如：今天235卖了100股AAPL），或直接问我现在买什么好。';

export async function POST(req: NextRequest) {
  let rawText = '';
  try {
    rawText = String((await req.json()).rawText || '');
    if (!rawText.trim()) {
      return NextResponse.json({ error: '未接收到文本内容' }, { status: 400 });
    }

    // ① 本地先判
    const local = localParse(rawText);
    if (local.intent === 'advice') {
      return NextResponse.json({
        success: true,
        intent: 'advice',
        symbol: local.symbol,
        side: local.side,
        local: true,
      });
    }
    if (local.intent === 'record') {
      return NextResponse.json({ success: true, intent: 'record', data: local.data, local: true });
    }

    // ② 本地拿不准：有 key 就问 Gemini
    if (hasGeminiKey()) {
      try {
        const parsed = await classifyWithGemini(rawText);
        if (parsed.intent === 'record' && parsed.symbol && parsed.symbol !== 'UNKNOWN') {
          return NextResponse.json({ success: true, intent: 'record', data: parsed });
        }
        if (parsed.intent === 'advice') {
          return NextResponse.json({
            success: true,
            intent: 'advice',
            symbol: parsed.symbol || null,
            side: parsed.side === 'sell' ? 'sell' : 'buy',
          });
        }
        if (parsed.intent === 'chat') {
          return NextResponse.json({ success: true, intent: 'chat', reply: parsed.reply || CHAT_FALLBACK });
        }
      } catch (e: any) {
        console.error('gemini 分类失败，走本地兜底:', e?.message || e);
      }
    }

    // ③ 都不行：给一句引导，不报错
    return NextResponse.json({ success: true, intent: 'chat', reply: CHAT_FALLBACK });
  } catch (error: any) {
    console.error('analyze-memory 失败:', error?.message || error);
    return NextResponse.json(
      { error: 'AI 没能理解这句话，换个说法试试' },
      { status: 500 },
    );
  }
}
