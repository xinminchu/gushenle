// GET /api/news —— 财经快讯代理（华尔街见闻 7x24），服务端缓存 5 分钟
import { NextResponse } from 'next/server';

export interface NewsItem {
  id: string;
  time: number; // ms
  title: string;
  content: string;
}

let cache: { at: number; items: NewsItem[] } | null = null;
const TTL = 5 * 60 * 1000;

export async function GET() {
  if (cache && Date.now() - cache.at < TTL) {
    return NextResponse.json({ items: cache.items, cached: true });
  }
  try {
    const r = await fetch(
      'https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=global-channel&client=pc&limit=20',
      { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } },
    );
    if (!r.ok) throw new Error(`wscn ${r.status}`);
    const j = await r.json();
    const items: NewsItem[] = (j?.data?.items || []).map((it: any) => ({
      id: String(it.id ?? ''),
      time: typeof it.display_time === 'number' ? it.display_time * 1000 : Date.now(),
      title: String(it.title || '').trim(),
      content: String(it.content_text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 220),
    })).filter((it: NewsItem) => it.title || it.content);
    cache = { at: Date.now(), items };
    return NextResponse.json({ items, cached: false });
  } catch (e) {
    console.error('[api/news]', e);
    if (cache) return NextResponse.json({ items: cache.items, cached: true, stale: true });
    return NextResponse.json({ items: [], error: '快讯暂时拿不到' }, { status: 200 });
  }
}
