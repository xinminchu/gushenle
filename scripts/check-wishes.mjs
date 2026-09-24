#!/usr/bin/env node
/**
 * 许愿池新留言检查（供 cron 每小时调用）。
 * 环境变量：GSL_SUPABASE_URL / GSL_SUPABASE_KEY（publishable key，本来就是公开的）。
 * 查过去 75 分钟的新留言（窗口略大于 1 小时，防 cron 延迟漏报），
 * 用 seen-id 文件去重，保证每条留言只报一次。
 * 有新留言 → 逐条打印；没有 → 打印 NO_NEW_WISHES。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';

const URL = process.env.GSL_SUPABASE_URL;
const KEY = process.env.GSL_SUPABASE_KEY;
const SEEN_FILE =
  process.env.GSL_SEEN_FILE ||
  `${process.env.HOME}/workspace/goals/goal/hidden_files/reported_wish_ids.txt`;
if (!URL || !KEY) {
  console.error('ERR: missing GSL_SUPABASE_URL / GSL_SUPABASE_KEY');
  process.exit(2);
}

const since = new Date(Date.now() - 75 * 60 * 1000).toISOString();
const qs = new URLSearchParams({
  select: 'id,nickname,content,kind,created_at,adopted',
  created_at: `gte.${since}`,
  order: 'created_at.asc',
});
const res = await fetch(`${URL}/rest/v1/game_wishes?${qs}`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
if (!res.ok) {
  console.error(`ERR: HTTP ${res.status} ${await res.text()}`);
  process.exit(1);
}
const rows = await res.json();

let seen = new Set();
try {
  if (existsSync(SEEN_FILE)) {
    seen = new Set(
      readFileSync(SEEN_FILE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean)
    );
  }
} catch {}

const fresh = rows.filter((w) => !seen.has(String(w.id)));
if (!fresh.length) {
  console.log('NO_NEW_WISHES');
  process.exit(0);
}

// 先记 seen，再打印（打印失败也不重复报）
mkdirSync(dirname(SEEN_FILE), { recursive: true });
writeFileSync(
  SEEN_FILE,
  [...seen, ...fresh.map((w) => String(w.id))].join('\n') + '\n'
);

console.log(`NEW_WISHES count=${fresh.length}`);
for (const w of fresh) {
  const nick = w.nickname || '匿名';
  const adopted = w.adopted ? ' [已采纳]' : '';
  console.log(`---\n[${w.created_at}] @${nick}（${w.kind}）${adopted}\n${w.content}`);
}
