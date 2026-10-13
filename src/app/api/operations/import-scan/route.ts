// src/app/api/operations/import-scan/route.ts
// 券商交易历史截图识别：把各券商 App 的 History 截图转成操作记录。
// 流程：前端压缩图片 -> 本接口逐张调 Gemini vision 识别 -> 返回结构化操作数组 -> 前端预览勾选 -> 批量记入。
// 只做识别，不写库；去重和记入在前端做（localStorage 操作记录）。
//
// v2 (2026-10-13):
// - 先分类截图类型：history（交易记录）/ positions（持仓页）/ order（下单界面）/ other。
//   非 history 不报错，而是返回可操作指引（告诉用户去哪截正确的图）。
// - 多券商：Schwab / Fidelity / Robinhood / Webull / IBKR / moomoo / 老虎等，版式各异，按通用模式提取。
// - 防御性解析 Gemini 返回（空回包、markdown 代码围栏、多余文字）。
// - 永不向客户端泄露原生错误文本。
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const maxDuration = 60;

const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite'];
const MAX_IMAGES = 4;

const RETRYABLE = /503|429|500|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/i;
// Gemini 结构化输出校验偶发失败（"The string did not match the expected pattern"），换模型重试
const SCHEMA_ERR = /expected pattern|did not match/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Op {
  date: string;
  symbol: string;
  action: string;
  qty: number;
  price: number;
}

interface ScanImage {
  data: string; // base64（不带 data: 前缀）
  mimeType: string;
}

const KINDS = new Set(['history', 'positions', 'order', 'other']);

function extractJson(text: string): any | null {
  const t = (text || '').trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    /* fall through */
  }
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      /* fall through */
    }
  }
  const s = t.indexOf('{');
  const e = t.lastIndexOf('}');
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(t.slice(s, e + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

function sanitizeOps(raw: any): Op[] {
  const ops: Op[] = [];
  for (const o of Array.isArray(raw) ? raw : []) {
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
  return ops;
}

const GENERIC_GUIDANCE =
  'Please screenshot your broker app\'s trade History page — the list grouped by date with Buy/Sell, Qty and Price — then import that. / 请截取券商 App 的 History / 交易记录页面（按日期分组、带 Buy/Sell、Qty、Price 的列表）后再导入。';

async function scanImage(
  ai: GoogleGenAI,
  img: ScanImage,
): Promise<{ kind: string; broker: string; guidance: string; ops: Op[]; model: string }> {
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
        const j = extractJson(response.text || '');
        if (!j) throw new Error('empty_or_unparseable');
        const kind = KINDS.has(String(j.kind)) ? String(j.kind) : j.operations?.length ? 'history' : 'other';
        const broker = String(j.broker || '').slice(0, 40);
        const guidance = String(j.guidance || '').slice(0, 500) || (kind === 'history' ? '' : GENERIC_GUIDANCE);
        const ops = kind === 'history' ? sanitizeOps(j.operations) : [];
        return { kind, broker, guidance, ops, model };
      } catch (e) {
        lastErr = e instanceof Error ? `${e.name}: ${e.message}`.slice(0, 200) : String(e).slice(0, 200);
        if (/404/.test(lastErr)) break; // 模型名不存在，换下一个
        if (!RETRYABLE.test(lastErr) && !SCHEMA_ERR.test(lastErr) && lastErr !== 'Error: empty_or_unparseable')
          throw new Error(lastErr);
        if (lastErr === 'Error: empty_or_unparseable' && attempt === 2) break; // 空回包不值得换模型重试太多次
        await sleep(2000 * attempt);
      }
    }
  }
  throw new Error(lastErr || 'unknown');
}

const PROMPT = `You are extracting stock trade history from a brokerage app screenshot.

STEP 1 — CLASSIFY the screenshot. Look at the whole screen:
- kind "history": a trade/transaction history list — date section headers (e.g. "September 29, 2026") followed by rows with ticker + Buy/Sell + Qty + Price.
- kind "positions": an account holdings page (current shares, market value, day gain/loss — no Buy/Sell rows).
- kind "order": an order ticket / trading screen (buy/sell buttons, quantity input, order type selector, bid/ask prices).
- kind "other": anything else (charts, news, home screen, login...).
Also note the broker name if recognizable (Schwab, Fidelity, Vanguard, Robinhood, Webull, IBKR, E*TRADE, moomoo, Tiger Brokers...).

STEP 2 — If kind is NOT "history", output ONLY this JSON (guidance in the screenshot's language, telling the user exactly where to tap to find the trade history):
{"kind":"<kind>","broker":"<name or empty>","guidance":"<1-2 sentences>","operations":[]}
Guidance examples — adapt to the detected broker:
- Schwab: "Open the Schwab app → Accounts → History tab, screenshot the transaction list, then import. / 打开 Schwab App → Accounts → History，截取交易列表后再导入。"
- Fidelity: "Fidelity app → Accounts → Activity, screenshot it, then import."
- Robinhood: "Robinhood app → Account tab → History, screenshot it, then import."
- Webull: "Webull app → Menu → History (clock icon), screenshot it, then import."
- IBKR: "IBKR app → Portfolio → Activity, screenshot it, then import."
- moomoo: "moomoo → 账户 → 历史订单/交割单，截图后导入。"
- Tiger: "老虎证券 → 订单 → 历史订单，截图后导入。"
- Unknown: "${GENERIC_GUIDANCE}"

STEP 3 — If kind IS "history", extract EVERY Buy/Sell transaction row. Layouts differ by broker — adapt, but every row has the same ingredients:
- date: the section header date above the row, as YYYY-MM-DD ("September 29, 2026" → "2026-09-29")
- symbol: ticker, uppercase (SPCX, RKLB, INTC)
- action: "buy" or "sell" (lowercase)
- qty: share count, number
- price: execution price, number
SKIP (not trades): "Journal" rows, money transfers ("MoneyLink Transfer", "Tfr", 资金划转), dividends, interest, fees — anything without BOTH Qty and Price.

Output JSON only, no other text:
{"kind":"history","broker":"Schwab","operations":[{"date":"2026-09-29","symbol":"SPCX","action":"buy","qty":2,"price":145.8}]}
If the history page shows no trades: {"kind":"history","broker":"...","operations":[]}.`;

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
  const operations: Op[] = [];
  const notices: string[] = [];
  const failed: number[] = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    try {
      const { kind, broker, guidance, ops } = await scanImage(ai, img);
      if (kind !== 'history') {
        const who = broker ? `（${broker}）` : '';
        notices.push(`第 ${i + 1} 张${who}：${guidance}`);
      }
      operations.push(...ops);
    } catch {
      // 永不向客户端泄露原生错误文本；失败只记序号，前端给统一友好提示
      failed.push(i + 1);
    }
  }

  return NextResponse.json({
    ok: true,
    operations,
    notices,
    failed,
  });
}
