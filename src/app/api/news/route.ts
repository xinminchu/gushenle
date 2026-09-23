// GET /api/news?market=us|cn —— 财经快讯代理（华尔街见闻 7x24），服务端按频道缓存 5 分钟
// us = 美股频道，cn = A股/国内频道
import { NextRequest, NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  time: number; // ms
  title: string;
  content: string;
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
      `https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=${channel}&client=pc&limit=20`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } },
    );
    if (!r.ok) throw new Error(`wscn ${r.status}`);
    const j = await r.json();
    const items: NewsItem[] = (j?.data?.items || [])
      .map((it: any) => ({
        id: String(it.id ?? ''),
        time: typeof it.display_time === 'number' ? it.display_time * 1000 : Date.now(),
        title: String(it.title || '').trim(),
        content: String(it.content_text || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 220),
      }))
      .filter((it: NewsItem) => it.title || it.content);
    caches.set(key, { at: Date.now(), items });
    return NextResponse.json({ items, market: key, cached: false });
  } catch (e) {
    console.error('[api/news]', e);
    if (hit) return NextResponse.json({ items: hit.items, market: key, cached: true, stale: true });
    return NextResponse.json({ items: [], market: key, error: '快讯暂时拿不到' }, { status: 200 });
  }
}
