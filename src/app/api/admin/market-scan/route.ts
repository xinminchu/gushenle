// src/app/api/admin/market-scan/route.ts
// 分片扫描：一次只扫 offset..offset+limit 只股票，算好直接写入 market_scan。
// 调度器（cron worker）在本机循环调用，把整个池子扫完；站长也可从工具箱手动触发。
// 鉴权二选一：站长 JWT（requireAdmin）或 x-cron-secret（CRON_SECRET，Vercel 环境变量）。
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { scanSymbols, scanChunk, upsertScanRows } from '@/lib/marketScan';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') || '';
  const cronOk =
    !!process.env.CRON_SECRET && secret !== '' && secret === process.env.CRON_SECRET;
  let authed = cronOk;
  if (!authed) {
    const user = await requireAdmin(req);
    authed = !!user;
  }
  if (!authed) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  let body: { offset?: number; limit?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* 空 body 用默认 */
  }
  const offset = Math.max(0, Math.floor(body.offset ?? 0));
  const limit = Math.min(12, Math.max(1, Math.floor(body.limit ?? 8)));
  const symbols = scanSymbols();
  const chunk = symbols.slice(offset, offset + limit);

  const rows = await scanChunk(chunk);
  const saved = await upsertScanRows(rows);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
  }
  const done = offset + limit >= symbols.length;
  return NextResponse.json({
    ok: true,
    total: symbols.length,
    offset,
    limit,
    scanned: rows.length,
    done,
  });
}
