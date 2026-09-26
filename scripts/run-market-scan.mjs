#!/usr/bin/env node
/**
 * 市场扫描 worker（供 cron 每天收盘后调用）。
 * 循环 POST /api/admin/market-scan 分片扫描整个精选池，结果由服务端直接写入 market_scan 表。
 * 环境变量：GSL_CRON_SECRET（与 Vercel 的 CRON_SECRET 一致）。
 * 成功打印 SCAN_DONE <scanned>/<total>；失败打印 SCAN_FAIL 并 exit 1。
 */
const SECRET = process.env.GSL_CRON_SECRET;
const BASE = process.env.GSL_SITE || 'https://www.gushenle.com';
if (!SECRET) {
  console.error('ERR: missing GSL_CRON_SECRET');
  process.exit(2);
}

const LIMIT = 8;
let offset = 0;
let total = 0;
let scanned = 0;
let failedChunks = 0;

async function postChunk(off, attempt = 1) {
  const res = await fetch(`${BASE}/api/admin/market-scan`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cron-secret': SECRET },
    body: JSON.stringify({ offset: off, limit: LIMIT }),
  });
  if (res.status === 401) {
    throw new Error('401 未授权：Vercel 还没配 CRON_SECRET 或值不一致');
  }
  if (!res.ok) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 5000));
      return postChunk(off, attempt + 1);
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
}

try {
  while (true) {
    let j;
    try {
      j = await postChunk(offset);
    } catch (e) {
      failedChunks++;
      console.error(`chunk offset=${offset} 失败: ${e.message}`);
      offset += LIMIT;
      if (total > 0 && offset >= total) break;
      if (total === 0 && offset >= 400) break; // 兜底：total 未知时别死循环
      continue;
    }
    total = j.total;
    scanned += j.scanned;
    offset += LIMIT;
    if (j.done) break;
    // 片间小歇，别把 Nasdaq 惹毛
    await new Promise((r) => setTimeout(r, 1500));
  }
  if (failedChunks > 0) {
    console.log(`SCAN_PARTIAL scanned=${scanned}/${total} failedChunks=${failedChunks}`);
    process.exit(1);
  }
  console.log(`SCAN_DONE scanned=${scanned}/${total}`);
} catch (e) {
  console.error(`SCAN_FAIL: ${e.message}`);
  process.exit(1);
}
