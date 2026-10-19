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

/* ---------- 板块回填：Nasdaq 有 ~10% 的条目 sector 为空（优先股/权证/单位/部分 SPAC） ---------- */
function parentCode(sym) {
  if (sym.includes('^')) return sym.split('^')[0];
  if (/[WUR]$/.test(sym)) return sym.slice(0, -1);
  return null;
}
let overrides = {};
try {
  overrides = JSON.parse(readFileSync(join(ROOT, 'scripts', 'universe-sector-overrides.json'), 'utf8'));
} catch { /* 无覆盖文件则跳过 */ }
const bySym = new Map(out.map((r) => [r[0], r]));
let filled = 0;
// 先用父公司继承：优先股/权证/单位/配股继承同一公司普通股的板块
for (const r of out) {
  if (r[2]) continue;
  const p = parentCode(r[0]);
  const pr = p && bySym.get(p);
  if (pr && pr[2]) { r[2] = pr[2]; filled++; }
}
// 再用手写覆盖表；最后把名字里带 Acquisition/SPAC 的空壳归为 Finance
for (const r of out) {
  if (r[2]) continue;
  if (overrides[r[0]]) { r[2] = overrides[r[0]]; filled++; }
  else if (/acquisition|spac/i.test(r[1])) { r[2] = 'Finance'; filled++; }
}
console.log(`sector backfill: ${filled} symbols`);

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
