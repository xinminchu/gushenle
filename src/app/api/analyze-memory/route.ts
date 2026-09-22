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
      你是一个极简且严谨的投资决策结构化提取助手。
      请从以下用户的表达中，提取出投资决策的关键要素。

      输出 JSON 格式，必须包含以下字段：
      - symbol: 股票代码 (例如 NVDA, AAPL, TSLA)，若未明确提及则返回 "UNKNOWN"
      - action: 交易动作 (例如: "BUY", "SELL", "REDUCE_33%", "WATCH")
      - price: 成交价格数字（例如 235.5），若未提及则返回 null
      - qty: 成交数量数字（例如 100），若未提及则返回 null
      - opDate: 操作日期 YYYY-MM-DD；用户说"今天"用今天，"昨天"用昨天，明确日期直接用；若无法判断则返回 null
      - thesis: 操作背后的买入逻辑或交易理由
      - emotion: 用户的心理或情绪状态 (例如: "冷静", "冲动", "谨慎", "乐观")

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

    const parsedData = JSON.parse(response.text || '{}');

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Gemini 解析失败:', error);
    return NextResponse.json({ error: '结构化解析失败', details: error.message }, { status: 500 });
  }
}
