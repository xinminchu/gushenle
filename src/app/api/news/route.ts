// GET /api/news?market=us|cn —— 财经快讯代理（华尔街见闻 7x24），服务端按频道缓存 5 分钟
// us = 美股频道，cn = A股/国内频道；抓取逻辑在 @/lib/news（与 company-deep 共用）
import { NextRequest, NextResponse } from 'next/server';
import { getNewsItems } from '@/lib/news';

export type { NewsItem } from '@/lib/news';

export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market');
  const key = market === 'cn' ? 'cn' : 'us';
  const items = await getNewsItems(key);
  return NextResponse.json({ items, market: key });
}
