// scripts/account-truth-fixture.mjs
// 账户真相 fixture 核对：用 Sam 2026-11-19 Schwab 截图的真实数字，
// 逐项核对快照解析、缓冲计算、缓冲薄判定、账实核对。
// 来源：2026-11-19 晚 Sam 发的 Schwab 截图（尾号 7455）：
//   Margin Balance −$2,191.64、Cash & Sweep Vehicle $0.00、Cash Balance $0.00、
//   Long Stock Value $4,794.70、Margin Equity $2,603.06、
//   Maintenance Requirement $2,605.77；Buying Power −$20.41（同屏数字，
//   作 Available Funds For Trading 的 fixture 值）。
// 账面现金 +$374.22 是股神乐当时的账面数（2026-11-13 现金重建口径）。
// 用法：node scripts/account-truth-fixture.mjs（退出码 0 = 全过）
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const dir = mkdtempSync(join(tmpdir(), 'acct-truth-'));
try {
  execSync(
    `npx tsc src/lib/accountSnapshot.ts --outDir ${dir} --module commonjs --target es2022 --skipLibCheck --moduleResolution node`,
    { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' },
  );
} catch (e) {
  console.error('tsc 编译失败：', e.stdout?.toString() || e.message);
  process.exit(2);
}
const lib = require(join(dir, 'accountSnapshot.js'));

let pass = 0;
let fail = 0;
function check(name, actual, expected) {
  const ok = Object.is(actual, expected);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: 实际 ${JSON.stringify(actual)}，期望 ${JSON.stringify(expected)}`);
  ok ? pass++ : fail++;
}

// ---- 1. 快照解析：Gemini 输出形态（数字）逐项核对 ----
const geminiOut = {
  date: '2026-11-19',
  broker: 'Schwab',
  marginBalance: -2191.64,
  cashSweep: 0,
  cashBalance: 0,
  longStockValue: 4794.7,
  marginEquity: 2603.06,
  maintenanceRequirement: 2605.77,
  availableFunds: -20.41,
};
const snap = lib.sanitizeSnapshot(geminiOut);
check('sanitize 不为空', snap !== null, true);
if (snap) {
  check('date', snap.date, '2026-11-19');
  check('marginBalance 借款', snap.marginBalance, -2191.64);
  check('cashSweep', snap.cashSweep, 0);
  check('cashBalance 现金', snap.cashBalance, 0);
  check('longStockValue 持仓', snap.longStockValue, 4794.7);
  check('marginEquity 净值', snap.marginEquity, 2603.06);
  check('maintenanceRequirement 维持要求', snap.maintenanceRequirement, 2605.77);
  check('availableFunds 可用资金', snap.availableFunds, -20.41);
}

// ---- 2. 字符串形态（截图 OCR 常带 $、逗号、括号负数）----
const strSnap = lib.sanitizeSnapshot({
  date: '2026-11-19',
  marginBalance: '($2,191.64)',
  cashSweep: '$0.00',
  cashBalance: '$0.00',
  longStockValue: '$4,794.70',
  marginEquity: '$2,603.06',
  maintenanceRequirement: '$2,605.77',
  availableFunds: '-$20.41',
});
check('括号负数解析', strSnap?.marginBalance, -2191.64);
check('带 $ 逗号解析', strSnap?.longStockValue, 4794.7);
check('空字段不算 0', lib.parseMoney('--'), null);
check('缺失字段 null', lib.parseMoney(undefined), null);
check('认不出余额页返回 null', lib.sanitizeSnapshot({ date: '2026-11-19', marginBalance: null }), null);

// ---- 3. 缓冲与借款 ----
check('marginBuffer 净值−维持要求', lib.marginBuffer(snap), -2.71);
check('borrowedAmount 借款额', lib.borrowedAmount(snap), 2191.64);
check('isThinBuffer（剩 −$2.71 < $200）', lib.isThinBuffer(snap), true);
check('缓冲不薄的反例', lib.isThinBuffer({ ...snap, marginEquity: 10000, maintenanceRequirement: 2000 }), false);

// ---- 4. 账实核对：账面现金 +374.22 vs 快照 ----
const recon = lib.reconcileBookVsSnapshot({
  bookCash: 374.22,
  bookLongValue: 4794.7,
  snapshot: { ...snap, id: 'x', source: 'screenshot', createdAt: 0 },
});
check('reconcile 有差额', recon.hasDiff, true);
check('reconcile 不报无快照', recon.noSnapshot, false);
const cashLine = recon.lines.find((l) => l.kind === 'cash');
check('现金差额行被标出', cashLine?.flagged, true);
check('现金差额行含 +374.22', cashLine?.zh.includes('差 $374.22'), true);
const marginLine = recon.lines.find((l) => l.kind === 'margin');
check('借款行被标出', marginLine?.flagged, true);
check('借款行含 $2,191.64', marginLine?.zh.includes('$2,191.64'), true);
check('持仓市值一致不标出', recon.lines.some((l) => l.kind === 'holdings'), false);

// ---- 5. 一致时报 ok，不误报 ----
const reconOk = lib.reconcileBookVsSnapshot({
  bookCash: 0,
  bookLongValue: 4794.7,
  snapshot: { ...snap, marginBalance: 0, id: 'x', source: 'screenshot', createdAt: 0 },
});
check('一致时无差额', reconOk.hasDiff, false);
check('一致时有 ok 行', reconOk.lines.some((l) => l.kind === 'ok'), true);

rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
