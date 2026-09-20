import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'GEMINI_API_KEY 未设置' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash', // <-- 改为最新推荐的 3.6-flash 模型
      contents: '用简短的一句话（10个字以内）跟“股神乐”打个快乐的招呼！',
    });

    return NextResponse.json({
      success: true,
      reply: response.text?.trim() || '连接成功！',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}