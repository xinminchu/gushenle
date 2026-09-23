// GET /api/news?market=us|cn —— 财经快讯代理（华尔街见闻 7x24），服务端按频道缓存 5 分钟
// us = 美股频道，cn = A股/国内频道；源接口偶发重复条目，服务端按标题指纹去重
import { NextRequest, NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  time: number; // ms
  title: string;
  content: string;
  uri: string; // 原文链接
}

const CHANNELS: Record<string, string> = {
  us: 'us-stock-channel',
  cn: 'a-stock-channel',
};

const caches = new Map<string, { at: number; items: NewsItem[] }>();
const TTL = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market');
  const key = market === 'cn' ? 'cn' : 'us';
  const channel = CHANNELS[key];

  const hit = caches.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ items: hit.items, market: key, cached: true });
  }
  try {
    const r = await fetch(
      `https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=${channel}&client=pc&limit=30`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } },
    );
    if (!r.ok) throw new Error(`wscn ${r.status}`);
    const j = await r.json();
    const seen = new Set<string>();
    const items: NewsItem[] = [];
    for (const it of (j?.data?.items || [])) {
      const title = String(it.title || '').trim();
      const content = String(it.content_text || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!title && !content) continue;
      // 去重：同标题（无标题则取正文前 80 字）只保留第一条
      const fingerprint = (title || content.slice(0, 80)).replace(/[\s\p{P}]/gu, '');
      if (!fingerprint || seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      items.push({
        id: String(it.id ?? ''),
        time: typeof it.display_time === 'number' ? it.display_time * 1000 : Date.now(),
        title,
        content: content.slice(0, 800),
        uri: String(it.uri || ''),
      });
      if (items.length >= 20) break;
    }
    caches.set(key, { at: Date.now(), items });
    return NextResponse.json({ items, market: key, cached: false });
  } catch (e) {
    console.error('[api/news]', e);
    if (hit) return NextResponse.json({ items: hit.items, market: key, cached: true, stale: true });
    return NextResponse.json({ items: [], market: key, error: '快讯暂时拿不到' }, { status: 200 });
  }
}
