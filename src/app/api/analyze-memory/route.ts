import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { localParse, todayStr } from '@/lib/memoryParse';
import { extractSymbol } from '@/lib/stockAliases';
import type { Lang } from '@/lib/i18n';
import { toHant, tx } from '@/lib/hant';

/**
 * 意图识别：本地确定性解析优先，Gemini 只做增强。
 * 原因：生产环境经常没有 GEMINI_API_KEY，核心链路不能依赖它。
 *
 * 中文走 memoryParse.localParse（确定性中文解析，不动）。
 * 英文（lang==='en'）走本文件的 localParseEn：同意图、同数据结构，
 * 只是关键词/数字/日期提取按英文口语写。
 */

const MODEL = 'gemini-3.6-flash';
const hasGeminiKey = () => !!process.env.GEMINI_API_KEY;

/* ---------------- 英文本地解析（不碰 memoryParse.ts） ---------------- */

/** 更正信号：wrong / meant / fix / change it to…（优先判断） */
const EN_CORRECT = /\b(wrong|mistake|meant|should be|fix|change (it |the )?to|correct(ed)? it)\b/i;
/** 查重复：duplicate / logged twice / reconcile */
const EN_AUDIT = /\b(duplicates?|duplicated|logged twice|recorded twice|reconcile)\b/i;
/** 咨询信号：recommend / should I / what to buy… */
const EN_ADVICE = /\b(recommend|suggestion|advice|should i|can i|what to buy|what should|worth buying|sell or hold|buy or sell|how about|how's|how is)\b/i;
/** 真实发生的动作：bought / sold（过去时） */
const EN_DONE = /\b(bought|sold)\b/i;
/** 买卖词（陈述句倾向） */
const EN_BUY_WORD = /\b(buy|bought|buying)\b/i;
const EN_SELL_WORD = /\b(sell|sold|selling)\b/i;

function enParseDate(text: string): string | null {
  const lower = text.toLowerCase();
  if (/\bday before yesterday\b/.test(lower)) return todayStr(-2);
  if (/\byesterday\b/.test(lower)) return todayStr(-1);
  if (/\btoday\b/.test(lower)) return todayStr(0);
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** 英文记一笔：价格/数量/日期提取（先抠掉价格片段，避免 "100 shares" 的数字被当单价） */
function enParseRecord(text: string, symbol: string) {
  const isSell = EN_SELL_WORD.test(text) && !EN_BUY_WORD.test(text) ? true
    : EN_BUY_WORD.test(text) && !EN_SELL_WORD.test(text) ? false
    : /sell/i.test(text);
  let price: number | null = null;
  let rest = text;
  let m = rest.match(/@\s*(\d+(?:\.\d+)?)/);
  if (m) { price = parseFloat(m[1]); rest = rest.replace(m[0], ' '); }
  else {
    m = rest.match(/\bat\s+(\d+(?:\.\d+)?)/i);
    if (m) { price = parseFloat(m[1]); rest = rest.replace(m[0], ' '); }
    else {
      m = rest.match(/(\d+(?:\.\d+)?)\s*(bought|sold)/i);
      if (m) { price = parseFloat(m[1]); rest = rest.replace(m[0], ' '); }
    }
  }
  const qtyShares = rest.match(/(\d+)\s*shares?/i);
  let qty: number | null = qtyShares ? parseInt(qtyShares[1], 10) : null;
  if (qty == null) {
    // 英文口语常省略 shares："sold 100 AAPL at 235" 里 100 就是股数
    // 先剔除日期（"2026-09-29" 里的数字不是股数），再取第一个裸数字
    const noDate = rest
      .replace(/\d{4}-\d{2}-\d{2}/g, ' ')
      .replace(/\b(today|yesterday|day before yesterday)\b/gi, ' ');
    const bare = noDate.match(/\b(\d+)\b/);
    if (bare) qty = parseInt(bare[1], 10);
  }
  return {
    intent: 'record' as const,
    symbol,
    action: (isSell ? 'SELL' : 'BUY') as 'BUY' | 'SELL',
    price,
    qty,
    opDate: enParseDate(text),
    thesis: '',
    emotion: 'calm',
  };
}

function enParseCorrect(text: string, symbol: string | null) {
  const lower = text.toLowerCase();
  let field: 'price' | 'qty' | 'date' | 'action' = 'price';
  if (/\b(qty|quantity|shares)\b/.test(lower)) field = 'qty';
  else if (/\bdate\b/.test(lower)) field = 'date';
  else if (/\bdirection\b/.test(lower) || /\bto buy\b|\bto sell\b/.test(lower)) field = 'action';
  let value: number | string | null = null;
  if (field === 'qty') {
    const m = text.match(/(\d+)\s*shares?/i);
    value = m ? parseInt(m[1], 10) : null;
  } else if (field === 'price') {
    const all = text.match(/(\d+(?:\.\d+)?)(?!\s*shares?)(?![0-9.])/g);
    value = all && all.length > 0 ? parseFloat(all[all.length - 1]) : null;
  } else if (field === 'date') {
    value = enParseDate(text);
  } else {
    const sell = EN_SELL_WORD.test(text);
    const buy = EN_BUY_WORD.test(text);
    value = sell && !buy ? 'sell' : buy && !sell ? 'buy' : null;
  }
  return { intent: 'correct' as const, field, value, symbol };
}

type EnIntent =
  | { intent: 'advice'; symbol: string | null; side: 'buy' | 'sell' }
  | { intent: 'record'; data: ReturnType<typeof enParseRecord> }
  | { intent: 'correct'; data: ReturnType<typeof enParseCorrect> }
  | { intent: 'audit' }
  | { intent: 'unknown' };

/** 英文本地意图识别：返回 unknown 表示本地拿不准，再看有没有 Gemini */
function localParseEn(rawText: string): EnIntent {
  const text = rawText.trim();
  if (!text) return { intent: 'unknown' };
  const symbol = extractSymbol(text);
  if (EN_CORRECT.test(text)) {
    return { intent: 'correct', data: enParseCorrect(text, symbol) };
  }
  if (!EN_DONE.test(text) && EN_AUDIT.test(text)) {
    return { intent: 'audit' };
  }
  if (EN_ADVICE.test(text)) {
    const sell = EN_SELL_WORD.test(text);
    const buy = EN_BUY_WORD.test(text);
    return { intent: 'advice', symbol, side: sell && !buy ? 'sell' : 'buy' };
  }
  if (EN_DONE.test(text)) {
    if (!symbol) return { intent: 'unknown' };
    return { intent: 'record', data: enParseRecord(text, symbol) };
  }
  if ((EN_BUY_WORD.test(text) || EN_SELL_WORD.test(text)) && symbol) {
    return { intent: 'record', data: enParseRecord(text, symbol) };
  }
  return { intent: 'unknown' };
}

/* ---------------- Gemini 提示词（中英两版） ---------------- */

async function classifyWithGemini(rawText: string, lang: Lang): Promise<any> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  const prompt = lang === 'en' ? `
    You are an investing assistant. Classify this user message into exactly one of five intents:
    - record: the user is logging a real past buy/sell trade (mentions a buy/sell action and a specific stock).
    - advice: the user is asking for investment advice (what to buy, whether to sell, how a stock looks, recommendation, can I buy, etc.).
    - correct: the user is correcting a previously logged trade (said "wrong/meant/fix/change", wants to change price, qty, date or direction).
    - audit: the user is checking for duplicate records (said "duplicate/logged twice/reconcile"), without mentioning a new trade.
    - chat: anything else — casual chat, feelings, or text unrelated to logging trades or investment advice.

    Output JSON only, nothing else:
    - for record: {"intent":"record","symbol":"ticker like AAPL, UNKNOWN if not mentioned","action":"BUY/SELL","price":trade price as number or null,"qty":share count as number or null,"opDate":"YYYY-MM-DD, use today if the user says today, null if unknown","thesis":"reason for the trade","emotion":"emotion like calm/impulsive/cautious/optimistic"}
    - for advice: {"intent":"advice","symbol":"ticker mentioned or null","side":"buy/sell"}
    - for correct: {"intent":"correct","field":"price/qty/date/action","value":"new value: number for price/qty, YYYY-MM-DD for date, buy/sell for direction, null if unclear","symbol":"ticker named or null (null means fix the most recent trade)"}
    - for audit: {"intent":"audit"}
    - for chat: {"intent":"chat","reply":"one short friendly English reply explaining this can't be logged as a trade, guiding the user to describe a specific trade (e.g. sold 100 AAPL at 235 today) or ask what to buy"}

    User message:
    "${rawText}"
  ` : `
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

const CHAT_FALLBACK_ZH =
  '这句话记不了一笔。说一笔操作（例如：今天235卖了100股AAPL），或直接问我现在买什么好。';
const CHAT_FALLBACK_EN =
  "That doesn't read as a trade. Log a trade (e.g. sold 100 AAPL at 235 today), or ask me what to buy now.";

function chatFallback(lang: Lang): string {
  if (lang === 'en') return CHAT_FALLBACK_EN;
  if (lang === 'hant') return toHant(CHAT_FALLBACK_ZH);
  return CHAT_FALLBACK_ZH;
}

export async function POST(req: NextRequest) {
  let rawText = '';
  let lang: Lang = 'zh';
  try {
    const body = await req.json();
    rawText = String(body.rawText || '');
    lang = body.lang === 'en' ? 'en' : body.lang === 'hant' ? 'hant' : 'zh';
    if (!rawText.trim()) {
      return NextResponse.json(
        { error: tx(lang, 'No text received', '未接收到文本内容') },
        { status: 400 },
      );
    }

    const isEn = lang === 'en';

    // ① 本地先判（中文走原 deterministic 解析，不动；英文走 localParseEn）
    const local = isEn ? localParseEn(rawText) : localParse(rawText);
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
        const parsed = await classifyWithGemini(rawText, lang);
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
          return NextResponse.json({ success: true, intent: 'chat', reply: parsed.reply || chatFallback(lang) });
        }
      } catch (e: any) {
        console.error('gemini 分类失败，走本地兜底:', e?.message || e);
      }
    }

    // ③ 都不行：给一句引导，不报错
    return NextResponse.json({ success: true, intent: 'chat', reply: chatFallback(lang) });
  } catch (error: any) {
    console.error('analyze-memory 失败:', error?.message || error);
    return NextResponse.json(
      { error: tx(lang, "I couldn't understand that — try rephrasing", 'AI 没能理解这句话，换个说法试试') },
      { status: 500 },
    );
  }
}
