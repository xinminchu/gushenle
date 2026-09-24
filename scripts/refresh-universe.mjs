#!/usr/bin/env node
/**
 * 全市场股票名单刷新脚本。
 * 数据源：Nasdaq 官方 screener 接口（免费、无 key），nasdaq + nyse + amex 三家合并去重。
 * 输出：public/stock-universe.json —— 紧凑三元组 [代码, 英文名, 板块]，按代码排序。
 * 精选名单（src/lib/stockList.ts，带中文名/主题/别名/拼音）保持不变，展示时优先。
 *
 * 用法：node scripts/refresh-universe.mjs
 * 建议每 1-3 个月跑一次（IPO/退市会变化）。运行时约 10 秒。
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'stock-universe.json');

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'application/json',
};

async function fetchExchange(exchange) {
  const url = `https://api.nasdaq.com/api/screener/stocks?tableonly=true&limit=25&offset=0&exchange=${exchange}&download=true`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`${exchange}: HTTP ${res.status}`);
  const json = await res.json();
  const rows = json?.data?.rows ?? [];
  console.log(`${exchange}: ${rows.length} rows`);
  return rows;
}

function clean(row) {
  const code = String(row.symbol ?? '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9.^$-]+$/.test(code)) return null;
  const en = String(row.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!en) return null;
  const sector = String(row.sector ?? '').trim().slice(0, 32);
  return [code, en, sector];
}

const seen = new Set();
const out = [];
// 优先级 nasdaq > nyse > amex：同一代码只保留第一家
for (const ex of ['nasdaq', 'nyse', 'amex']) {
  const rows = await fetchExchange(ex);
  for (const r of rows) {
    const c = clean(r);
    if (!c || seen.has(c[0])) continue;
    seen.add(c[0]);
    out.push(c);
  }
}
out.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

const payload = {
  v: 1,
  asOf: new Date().toISOString().slice(0, 10),
  count: out.length,
  // [代码, 英文名, 板块]
  stocks: out,
};
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(payload));
const kb = Math.round(Buffer.byteLength(JSON.stringify(payload)) / 1024);
console.log(`wrote ${OUT}: ${out.length} symbols, ${kb} KB`);
