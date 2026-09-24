import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { localParse } from '@/lib/memoryParse';

/**
 * 意图识别：本地确定性解析优先，Gemini 只做增强。
 * 原因：生产环境经常没有 GEMINI_API_KEY，核心链路不能依赖它。
 */

const MODEL = 'gemini-3.6-flash';
const hasGeminiKey = () => !!process.env.GEMINI_API_KEY;

async function classifyWithGemini(rawText: string): Promise<any> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const prompt = `
    你是一个投资助手。先判断用户这句话的意图，五选一：
    - record：用户在记录一笔真实发生的买卖操作（提到买入/卖出/加仓/减仓等动作和具体股票）。
    - advice：用户在咨询投资建议（问买什么、卖不卖、怎么看某只股票、推荐、能不能买等）。
    - correct：用户在更正之前记的一笔操作（说了"说错了/改成/更正"之类，要改单价、数量、日期或方向）。
    - audit：用户在查操作记录有没有重复/记重（说了"重复/记重/两次/两笔/对账"之类，但没提新的买卖动作）。
    - chat：其他闲聊、感慨，或与操作记录、投资建议无关的表达。

    只输出 JSON，不要输出其他内容：
    - 意图为 record 时：{"intent":"record","symbol":"股票代码如AAPL，未提及填UNKNOWN","action":"BUY/SELL","price":成交价数字或null,"qty":数量数字或null,"opDate":"YYYY-MM-DD，用户说今天用今天，无法判断填null","thesis":"操作理由","emotion":"情绪如冷静/冲动/谨慎/乐观"}
    - 意图为 advice 时：{"intent":"advice","symbol":"提到的股票代码或null","side":"buy/sell"}
    - 意图为 correct 时：{"intent":"correct","field":"price/qty/date/action（单价/数量/日期/方向）","value":"改成的值：单价数量填数字，日期填YYYY-MM-DD，方向填buy/sell，听不清填null","symbol":"点名了哪只股票填代码，没点名填null（表示改最近一笔）"}
    - 意图为 audit 时：{"intent":"audit"}
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
    if (local.intent === 'correct') {
      return NextResponse.json({ success: true, intent: 'correct', data: local.data, local: true });
    }
    if (local.intent === 'audit') {
      return NextResponse.json({ success: true, intent: 'audit', local: true });
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
        if (parsed.intent === 'correct') {
          return NextResponse.json({ success: true, intent: 'correct', data: parsed });
        }
        if (parsed.intent === 'audit') {
          return NextResponse.json({ success: true, intent: 'audit' });
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
