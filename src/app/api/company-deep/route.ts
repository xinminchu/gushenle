import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { findStock } from '@/lib/stockList';
import type { Lang } from '@/lib/i18n';
import { toHantDeep, tx } from '@/lib/hant';

/**
 * AI 公司深挖：只做"事实层"，不做"观点层"。
 *
 * 产品红线（与"华尔街式研报"的区别）：
 * ① 只整理公开事实：商业模式 / 收入来源 / 主营产品 / 主要风险；
 * ② 严禁买卖建议、目标价、评级、涨跌预测 —— 那是荐股红线，也是"不假装预测"；
 * ③ 不知道就写"公开信息不足"，不许编。
 *
 * 成本控制：按 symbol+UTC日期 服务端缓存，一天只烧一次 token；
 * 前端折叠懒加载，用户不点开不调接口；没配 GEMINI_API_KEY 时 503，前端静默隐藏。
 */

const MODEL = 'gemini-3.6-flash';
/** 3.6 过载时的降级模型：更快更便宜，事实整理够用 */
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

async function generateWithFallback(
  ai: GoogleGenAI,
  prompt: string,
): Promise<{ text: string; model: string }> {
  try {
    const r = await ai.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });
    return { text: r.text || '{}', model: MODEL };
  } catch (e: any) {
    const msg = e?.message || '';
    // 只有过载/不可用时才降级，key 无效等配置问题直接抛
    if (/503|UNAVAILABLE|overloaded|high demand/i.test(msg)) {
      const r = await ai.models.generateContent({
        model: FALLBACK_MODEL,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      return { text: r.text || '{}', model: FALLBACK_MODEL };
    }
    throw e;
  }
}

/** symbol+UTC日期 缓存，一天一烧 */
const cache = new Map<string, { data: Record<string, any>; expires: number }>();
function cacheKey(symbol: string): string {
  return `${symbol}:${new Date().toISOString().slice(0, 10)}`;
}

function buildPrompt(symbol: string, name: string, lang: Lang): string {
  const target = lang === 'en'
    ? `the company ${symbol} (${name})`
    : `这家公司：${symbol}（${name}）`;
  const bodyLang = lang === 'en' ? 'Write in English' : '用中文写';
  return `You are a factual company-profile compiler, NOT an analyst. You give NO investment advice.

Using public information only, describe ${target}.
Facts only, no opinions. If public information is insufficient for a section, write "公开信息不足" (or "Insufficient public information" in English) — never invent.

Output JSON only, nothing else:
{"sections":[
  {"title":"${lang === 'en' ? 'Business model' : '商业模式'}","body":"..."},
  {"title":"${lang === 'en' ? 'Revenue sources' : '收入来源'}","body":"..."},
  {"title":"${lang === 'en' ? 'Main products/services' : '主营产品/服务'}","body":"..."},
  {"title":"${lang === 'en' ? 'Key risks' : '主要风险'}","body":"..."}
]}
Each body: at most 120 words/字. ${bodyLang}.

STRICTLY FORBIDDEN anywhere in the output: buy/sell/hold recommendations, target prices, ratings, or any price prediction. Violating this makes the output unusable.`;
}

export async function POST(req: NextRequest) {
  let lang: Lang = 'zh';
  const out = (d: unknown, status?: number) =>
    NextResponse.json(lang === 'hant' ? toHantDeep(d) : d, status ? { status } : undefined);
  try {
    const body = await req.json();
    lang = body.lang === 'en' ? 'en' : body.lang === 'hant' ? 'hant' : 'zh';
    const symbol = String(body.symbol || '').toUpperCase().trim();

    if (!/^[A-Z0-9.\-]{1,12}$/.test(symbol)) {
      return out({ error: tx(lang, 'Invalid ticker', '代码格式不对') }, 400);
    }
    if (!process.env.GEMINI_API_KEY) {
      return out({ error: 'no-key' }, 503);
    }

    const key = cacheKey(symbol);
    const hit = cache.get(key);
    if (hit && hit.expires > Date.now()) {
      return out({ success: true, cached: true, ...hit.data });
    }

    const info = findStock(symbol);
    const name = info ? (lang === 'en' ? info.en : info.zh) : symbol;
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const { text } = await generateWithFallback(ai, buildPrompt(symbol, name, lang === 'hant' ? 'zh' : lang));
    const parsed = JSON.parse(text);
    const sections = Array.isArray(parsed.sections)
      ? parsed.sections
          .filter((s: any) => s && typeof s.title === 'string' && typeof s.body === 'string')
          .slice(0, 6)
          .map((s: any) => ({ title: String(s.title).slice(0, 20), body: String(s.body).slice(0, 600) }))
      : [];
    if (sections.length === 0) {
      return out({ error: tx(lang, 'AI returned nothing usable', 'AI 没返回可用内容') }, 502);
    }

    const data = {
      symbol,
      name,
      asOf: new Date().toISOString().slice(0, 10),
      sections,
      disclaimer: tx(
        lang,
        'Compiled by AI from public information. Reference only — not investment advice.',
        'AI 根据公开信息整理，仅供参考，不构成投资建议。',
      ),
    };
    // 缓存到 UTC 明天 00:10
    const tomorrow = new Date();
    tomorrow.setUTCHours(24, 10, 0, 0);
    cache.set(key, { data, expires: tomorrow.getTime() });
    // 防止 Map 无限增长
    if (cache.size > 500) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    return out({ success: true, cached: false, ...data });
  } catch (error: any) {
    const raw = error?.message || String(error);
    // 抹掉可能混入的 key 再返回，方便定位是 key 问题还是模型问题
    const detail = raw.replace(/key=[A-Za-z0-9_\-]+/gi, 'key=***').slice(0, 300);
    console.error('company-deep 失败:', detail);
    return out({ error: tx(lang, 'AI lookup failed', 'AI 查询失败'), detail }, 500);
  }
}
