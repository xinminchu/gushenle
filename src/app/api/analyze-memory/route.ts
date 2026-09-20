import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    const { rawText } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: '未接收到文本内容' }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      你是一个极简且严谨的投资决策结构化提取助手。
      请从以下用户的表达中，提取出投资决策的关键要素。

      输出 JSON 格式，必须包含以下字段：
      - symbol: 股票代码 (例如 NVDA, AAPL, TSLA)，若未明确提及则返回 "UNKNOWN"
      - action: 交易动作 (例如: "BUY", "SELL", "REDUCE_33%", "WATCH")
      - thesis: 操作背后的买入逻辑或交易理由
      - emotion: 用户的心理或情绪状态 (例如: "冷静", "冲动", "谨慎", "乐观")

      用户原话：
      "${rawText}"
    `;

    const result = await model.generateContent(prompt);
    const parsedData = JSON.parse(result.response.text());

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error('Gemini 解析失败:', error);
    return NextResponse.json({ error: '结构化解析失败', details: error.message }, { status: 500 });
  }
}