// src/app/api/operations/import-scan/route.ts
// 券商交易历史截图识别：把 Webull 等 App 的 History 截图转成操作记录。
// 流程：前端压缩图片 -> 本接口逐张调 Gemini vision 识别 -> 返回结构化操作数组 -> 前端预览勾选 -> 批量记入。
// 只做识别，不写库；去重和记入在前端做（localStorage 操作记录）。
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_IMAGES = 6;

const RETRYABLE = /503|429|500|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function scanImage(
  ai: GoogleGenAI,
  img: ScanImage,
): Promise<{ ops: Array<{ date: string; symbol: string; action: string; qty: number; price: number }>; model: string }> {
  let lastErr = '';
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { data: img.data, mimeType: img.mimeType || 'image/jpeg' } },
                { text: PROMPT },
              ],
            },
          ],
          config: { responseMimeType: 'application/json' },
        });
        const j = JSON.parse(response.text || '{"operations":[]}');
        const ops: Array<{ date: string; symbol: string; action: string; qty: number; price: number }> = [];
        for (const o of Array.isArray(j.operations) ? j.operations : []) {
          if (!o || !o.symbol || !o.date) continue;
          const action = String(o.action || '').toLowerCase();
          if (action !== 'buy' && action !== 'sell') continue;
          const qty = Number(o.qty);
          const price = Number(o.price);
          if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price <= 0) continue;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(String(o.date))) continue;
          ops.push({
            date: String(o.date),
            symbol: String(o.symbol).toUpperCase().trim(),
            action,
            qty,
            price,
          });
        }
        return { ops, model };
      } catch (e) {
        lastErr = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 300) : String(e).slice(0, 300);
        if (/404/.test(lastErr)) break; // 模型名不存在，换下一个
        if (!RETRYABLE.test(lastErr)) throw new Error(lastErr);
        await sleep(2000 * attempt);
      }
    }
  }
  throw new Error(lastErr || 'unknown');
}

const PROMPT = `You are extracting stock trade history from a brokerage app screenshot (e.g. Webull History tab).
The screenshot shows date section headers (like "June 18, 2026") followed by transaction rows.
Each row has: ticker symbol, action (Buy/Sell), Qty, Price.

Extract EVERY Buy/Sell transaction. For each output:
- date: the section header date in YYYY-MM-DD
- symbol: ticker like SPCX, NVDA (uppercase)
- action: "buy" or "sell" (lowercase)
- qty: share count as number
- price: execution price as number

SKIP these (not trades):
- "Journal" rows (internal share transfers between accounts)
- "MoneyLink Transfer" / "Tfr" rows (money movement, not stock trades)
- Any row without both Qty and Price

Output JSON only, no other text:
{"operations":[{"date":"2026-06-18","symbol":"SPCX","action":"buy","qty":6,"price":179.79}]}

If no trades are found, output {"operations":[]}.`;

interface ScanImage {
  data: string; // base64（不带 data: 前缀）
  mimeType: string;
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_key',
        message:
          '截图识别需要 Gemini 接口钥匙：请站长在 Vercel 环境变量里配 GEMINI_API_KEY 后重新部署。',
      },
      { status: 503 },
    );
  }
  let images: ScanImage[];
  try {
    const body = await req.json();
    images = body.images;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ ok: false, error: 'empty' }, { status: 400 });
  }
  if (images.length > MAX_IMAGES) {
    return NextResponse.json(
      { ok: false, error: 'too_many', message: `一次最多 ${MAX_IMAGES} 张` },
      { status: 400 },
    );
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const operations: Array<{
    date: string;
    symbol: string;
    action: string;
    qty: number;
    price: number;
  }> = [];
  const failed: number[] = [];
  const errors: string[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const { ops } = await scanImage(ai, img);
      operations.push(...ops);
    } catch (e) {
      failed.push(i + 1);
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg.slice(0, 300));
    }
  }

  const overloaded = errors.some((m) => /503|UNAVAILABLE/i.test(m));
  return NextResponse.json({
    ok: true,
    operations,
    failed,
    errors,
    overloaded,
    hint: overloaded
      ? '模型今晚过载（503）， spikes 通常是暂时的：等几分钟再试，或分小批识别。'
      : undefined,
  });
}
