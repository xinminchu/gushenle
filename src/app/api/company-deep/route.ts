import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { findStock } from '@/lib/stockList';
import { getFullSeries } from '@/lib/marketData';
import { getNewsItems } from '@/lib/news';
import type { Lang } from '@/lib/i18n';
import { toHantDeep, tx } from '@/lib/hant';

/**
 * AI 公司深挖：只做"事实层"，不做"观点层"。
 *
 * 版块：
 * ① 📰 最近动态 —— 真实快讯标题（华尔街见闻 7x24，按代码/中英文名过滤），可点原文，零 AI 编造；
 * ② 📈 近期走势 —— 本地确定性计算（近20个交易日涨跌/区间），零 token、零幻觉；
 * ③ AI 档案 —— 商业模式 / 收入来源 / 主营产品 / 主要风险（Gemini 整理，一天一烧）。
 *
 * 产品红线：严禁买卖建议、目标价、评级、涨跌预测。
 * 没配 GEMINI_API_KEY 时 503，前端静默隐藏。
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

/** symbol+UTC日期 缓存（只缓存 AI 档案部分，一天一烧）；动态部分每次新鲜算 */
const cache = new Map<string, { data: Record<string, any>; expires: number }>();
function cacheKey(symbol: string): string {
  return `${symbol}:${new Date().toISOString().slice(0, 10)}`;
}

/** 最近动态：从快讯里按代码/中英文名过滤，取最新 4 条 */
async function getRecentNews(symbol: string, names: string[]) {
  try {
    const items = await getNewsItems('us');
    const matchers = [symbol, ...names].filter(Boolean).map((n) => n.trim()).filter((n) => n.length >= 1);
    const matched = items.filter((it) => {
      const text = `${it.title} ${it.content}`;
      return matchers.some((m) =>
        /[\u4e00-\u9fff]/.test(m)
          ? text.includes(m) // 中文名：包含即命中
          : new RegExp(`\\b${m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text),
      );
    });
    return matched.slice(0, 4).map((it) => ({ title: it.title || it.content.slice(0, 60), time: it.time, uri: it.uri }));
  } catch {
    return [];
  }
}

/** 近期走势：近20个交易日涨跌幅 + 区间，本地确定性计算 */
async function getTrend(symbol: string) {
  try {
    const { series, source } = await getFullSeries(symbol);
    if (!series || series.length < 2 || source === 'simulated') return null;
    const closes = series.slice(-21);
    if (closes.length < 2) return null;
    const first = closes[0].close;
    const last = closes[closes.length - 1].close;
    const window = closes.slice(-20);
    const high = Math.max(...window.map((p) => p.high ?? p.close));
    const low = Math.min(...window.map((p) => p.low ?? p.close));
    return {
      pct: first > 0 ? ((last - first) / first) * 100 : 0,
      from: first,
      to: last,
      high,
      low,
      lastDate: closes[closes.length - 1].date,
      days: closes.length - 1,
    };
  } catch {
    return null;
  }
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
    const info = findStock(symbol);
    const names = info ? [info.zh, info.en].filter(Boolean) : [];
    const name = info ? (lang === 'en' ? info.en : info.zh) : symbol;

    // 动态部分每次新鲜算（快讯 5 分钟缓存、日线 60 秒缓存，开销很小）
    const [news, trend] = await Promise.all([getRecentNews(symbol, names), getTrend(symbol)]);

    let facts = cache.get(key);
    let factsCached = true;
    if (!facts || facts.expires <= Date.now()) {
      factsCached = false;
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
      // 缓存到 UTC 明天 00:10
      const tomorrow = new Date();
      tomorrow.setUTCHours(24, 10, 0, 0);
      facts = { data: { sections }, expires: tomorrow.getTime() };
      cache.set(key, facts);
      // 防止 Map 无限增长
      if (cache.size > 500) {
        const first = cache.keys().next().value;
        if (first) cache.delete(first);
      }
    }

    const data = {
      symbol,
      name,
      asOf: new Date().toISOString().slice(0, 10),
      news,
      trend,
      sections: facts.data.sections,
      disclaimer: tx(
        lang,
        'Facts compiled by AI from public information; news headlines from market wires. Reference only — not investment advice.',
        '档案由 AI 根据公开信息整理，快讯来自市场资讯源，仅供参考，不构成投资建议。',
      ),
    };
    return out({ success: true, cached: factsCached, ...data });
  } catch (error: any) {
    const raw = error?.message || String(error);
    // 抹掉可能混入的 key 再返回，方便定位是 key 问题还是模型问题
    const detail = raw.replace(/key=[A-Za-z0-9_\-]+/gi, 'key=***').slice(0, 300);
    console.error('company-deep 失败:', detail);
    return out({ error: tx(lang, 'AI lookup failed', 'AI 查询失败'), detail }, 500);
  }
}
