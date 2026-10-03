/**
 * 财经快讯抓取（华尔街见闻 7x24），服务端 5 分钟缓存。
 * /api/news 和 /api/company-deep（AI 深挖"最近动态"）共用。
 */

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

export async function getNewsItems(market: 'us' | 'cn' = 'us', keep = 20): Promise<NewsItem[]> {
  const key = market === 'cn' ? 'cn' : 'us';
  const cacheKey = `${key}:${keep}`;
  const hit = caches.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL) return hit.items;
  try {
    const fetchLimit = Math.min(100, Math.max(30, keep + 20));
    const r = await fetch(
      `https://api-one-wscn.awtmt.com/apiv1/content/lives?channel=${CHANNELS[key]}&client=pc&limit=${fetchLimit}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' } },
    );
    if (!r.ok) throw new Error(`wscn ${r.status}`);
    const j = await r.json();
    const seen = new Set<string>();
    const items: NewsItem[] = [];
    for (const it of j?.data?.items || []) {
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
      if (items.length >= keep) break;
    }
    caches.set(cacheKey, { at: Date.now(), items });
    return items;
  } catch (e) {
    console.error('getNewsItems 失败:', e instanceof Error ? e.message : e);
    return hit?.items || [];
  }
}
