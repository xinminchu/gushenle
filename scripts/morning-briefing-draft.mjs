#!/usr/bin/env node
/* 盘前早报每日草稿生成器：每天 ~07:17 CT 由 cron 运行，输出到
   scripts/morning-briefing-drafts/YYYY-MM-DD.md（本地草稿，gitignored，不自动发布）。
   人工审核门：Mas 当日上午核实来源后，才把确认的内容写入
   src/lib/morningBriefing.ts 并推送；无合格内容整期跳过，不凑数。

   数据纪律：
   - 行情数字只用站内生产 API（/api/rhythm、/api/macro），与线上同源；
   - 新闻条目只给"待核实线索"占位，不编造标题、不编造来源；
   - 任何数字都标注口径与抓取时间（ET），不写预测性措辞。 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'scripts', 'morning-briefing-drafts');
const SITE = 'https://gushenle.com';

/** 美东今天 YYYY-MM-DD */
function etToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}
function etNow() {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}

/* 站内财经日历的最小镜像（固定日程部分；完整版见 src/lib/financeCalendar.ts，
   每年初随 financeCalendar 一起更新）。 */
const FOMC = [
  { date: '2026-10-28', title: '美联储议息决议', note: '美东14:00公布' },
  { date: '2026-12-09', title: '美联储议息决议', note: '美东14:00公布·含点阵图' },
];
const CPI = [
  { date: '2026-11-10', title: '美国 CPI 公布（10月）', note: '美东8:30' },
  { date: '2026-12-10', title: '美国 CPI 公布（11月）', note: '美东8:30' },
];
function firstFriday(year, month) {
  const d = new Date(Date.UTC(year, month - 1, 1));
  d.setUTCDate(1 + ((5 - d.getUTCDay() + 7) % 7));
  return d.toISOString().slice(0, 10);
}

async function getJSON(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 25000);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'gushenle-briefing-draft/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

const ma = (closes, period) => {
  if (closes.length < period) return null;
  const tail = closes.slice(-period);
  return tail.reduce((a, b) => a + b, 0) / period;
};
const fmtPct = (x) => (x == null || Number.isNaN(x) ? 'n/a' : `${x >= 0 ? '+' : ''}${Number(x).toFixed(2)}%`);
const fmtNum = (x, d = 2) => (x == null || Number.isNaN(x) ? 'n/a' : Number(x).toLocaleString('en-US', { maximumFractionDigits: d }));

async function main() {
  const today = etToday();
  const nowET = etNow();

  let qqqLine = 'QQQ 快照获取失败（/api/rhythm 超时）——手工填';
  let maLine = '50/200 日均线位置：__待查__';
  try {
    const q = await getJSON(`${SITE}/api/rhythm?symbol=QQQ&range=1Y&lang=zh`);
    const closes = (q.series || []).map((p) => p.close);
    const last = closes[closes.length - 1];
    const prev = closes[closes.length - 2];
    const chg = ((last - prev) / prev) * 100;
    const lastDate = q.series[q.series.length - 1].date;
    const ma50 = ma(closes, 50);
    const ma200 = ma(closes, 200);
    qqqLine = `QQQ 上一交易日（${lastDate}）收 ${fmtNum(last)}（${fmtPct(chg)}）`;
    const pos = [];
    if (ma50 != null) pos.push(`站上 50 日线（${fmtNum(ma50)}）${last >= ma50 ? '之上' : '之下'}`);
    if (ma200 != null) pos.push(`200 日线（${fmtNum(ma200)}）${last >= ma200 ? '之上' : '之下'}`);
    if (pos.length) maLine = `相对均线：${pos.join('，')}`;
  } catch (e) {
    qqqLine += `：${e.message}`;
  }

  let vixLine = 'VIX 上一交易日收盘：__待查__（/api/macro 未返回）';
  try {
    const m = await getJSON(`${SITE}/api/macro?kind=sentiment`);
    if (m?.sentiment?.vix != null) {
      vixLine = `VIX 上一交易日收盘 ${fmtNum(m.sentiment.vix, 1)}（口径：FRED VIXCLS，数据日期 ${m.sentiment.vixDate || '见接口'}）`;
    }
  } catch { /* 保持待查 */ }

  const calEvents = [...FOMC, ...CPI].filter((e) => e.date === today);
  const [y, mo] = today.split('-').map(Number);
  if (firstFriday(y, mo) === today) calEvents.push({ date: today, title: '美国非农就业报告', note: '美东8:30' });
  const calLines = calEvents.length
    ? calEvents.map((e) => `- [ ] ${e.title}（${e.note}，即美中 ${e.note.replace('美东', '美中').replace(/(\d+):(\d+)/, (_, h, m) => `${Number(h) - 1}:${m}`)}）`)
    : ['- [ ] 今日无站内固定日程事件 → 查 BLS/美联储官网确认后填，或整栏写"今日无重要宏观数据公布"'];

  const md = `# 盘前早报草稿 ${today}

> 生成时间：${nowET} ET ｜ 行情口径：站内生产 API（/api/rhythm、/api/macro），与线上同源 ｜
> 人工审核门：Mas 核实每条来源后才写入 src/lib/morningBriefing.ts；无合格内容整期跳过。
> 红线：一句话一条、只摆事实；禁预测、禁买卖建议；固定免责声明「公开资讯整理 · 不构成投资建议」。

## 快照（供"情绪市况"/"盘前异动"栏引用）

- ${qqqLine}
- ${maLine}
- ${vixLine}
- 期货盘前（ES/NQ/YM）：__待查__（站内暂无期货源；用可展示授权源核实后填，或整句写"期货方向待核实"）
- 50/200 日均线连续站上/跌破天数：__用站内日线数一下再填__

## 一、隔夜要闻（每条：一句话 主体+事实+数字，注明来源）

- [ ] __待填__（来源：__）——线索：Marketaux 免费档 / 美联储 RSS / SEC RSS / 站内 /api/news（华尔街见闻快讯）
- [ ] __待填__（来源：__）
- [ ] __待填__（来源：__）

## 二、盘前异动（只摆数字）

- [ ] 期货方向：ES __ / NQ __ / YM __（${nowET} ET 快照，注明延迟）
- [ ] 自选/持仓盘前涨跌最大的 2-3 只：__（站内 Nasdaq 管线盘前价，注明延迟）

## 三、今日日历（时间 ET/CT 双标）

${calLines.join('\n')}
- [ ] 自选/持仓股今日财报：__（查 /api/earnings 或 Alpha Vantage Earnings Calendar）

## 四、情绪市况（只写状态事实，不打分、不预测）

- [ ] ${vixLine.replace('VIX 上一交易日收盘：__待查__（/api/macro 未返回）', '上一交易日 VIX 收盘 __（FRED VIXCLS 口径）')}
- [ ] ${qqqLine}；${maLine}

## 核对清单

- [ ] 每条有来源；原因无一手证据写"原因未确认"
- [ ] 无预测性措辞、无买卖建议
- [ ] 免责声明已挂
- [ ] 写入 src/lib/morningBriefing.ts（BATCH_${today.replace(/-/g, '_')}，只增不改）后 build 通过再推
`;

  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${today}.md`);
  writeFileSync(out, md);
  console.log(`draft written: ${out}`);
}

main().catch((e) => {
  console.error('draft failed:', e?.message || e);
  process.exit(1);
});
