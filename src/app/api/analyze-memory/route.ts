import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: '未接收到文本内容' }, { status: 400 });
    }

    const prompt = `
      你是一个投资助手。先判断用户这句话的意图，三选一：
      - record：用户在记录一笔真实发生的买卖操作（提到买入/卖出/加仓/减仓/观望等动作和具体股票）。
      - advice：用户在咨询投资建议（问买什么、卖不卖、怎么看某只股票、推荐、能不能买等）。
      - chat：其他闲聊、感慨，或与操作记录、投资建议无关的表达。

      只输出 JSON，不要输出其他内容：
      - 意图为 record 时：{"intent":"record","symbol":"股票代码如AAPL，未提及填UNKNOWN","action":"BUY/SELL等","price":成交价数字或null,"qty":数量数字或null,"opDate":"YYYY-MM-DD，用户说今天用今天，无法判断填null","thesis":"操作理由","emotion":"情绪如冷静/冲动/谨慎/乐观"}
      - 意图为 advice 时：{"intent":"advice"}
      - 意图为 chat 时：{"intent":"chat","reply":"一句简短亲切的中文回复，说明这句话记不了一笔，引导用户说一笔具体操作（例如：今天235卖了100股AAPL）或直接问买什么建议"}

      用户原话：
      "${rawText}"
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    const intent = parsed.intent === 'advice' || parsed.intent === 'chat' ? parsed.intent : 'record';

    if (intent === 'record') {
      return NextResponse.json({ success: true, intent: 'record', data: parsed });
    }
    if (intent === 'advice') {
      return NextResponse.json({ success: true, intent: 'advice' });
    }
    return NextResponse.json({
      success: true,
      intent: 'chat',
      reply: parsed.reply || '这句话记不了一笔。说一笔操作（例如：今天235卖了100股AAPL），或直接问我现在买什么好。',
    });
  } catch (error: any) {
    console.error('Gemini 解析失败:', error);
    return NextResponse.json({ error: 'AI 没能理解这句话，换个说法试试', details: error.message }, { status: 500 });
  }
}
