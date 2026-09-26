/**
 * iOS 15 兼容补丁（postinstall 运行）。
 *
 * 背景：Next.js 16 官方只支持 Safari 16.4+，它的预编译产物里用了
 * ES2022 的 class static 初始化块 `static { ... }`，iOS 15 的 Safari
 * 解析到 `static{` 直接报 `SyntaxError: Unexpected token '{'`，
 * 整个 App 的 JS 一句都跑不起来（iPhone 6s Plus 最高只到 iOS 15.8）。
 *
 * 修法：把框架里仅有的几处单赋值 static 块，等价改写成
 * public static 字段（iOS 14.1+ 即支持，语义完全一致）。
 * 若未来升级 Next 后 patterns 对不上，脚本会大声失败，
 * 避免静默留下不兼容的产物。
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules', 'next', 'dist', 'client', 'components');

const PATCHES = [
  {
    file: join(nm, 'error-boundary.js'),
    from: `    static{\n        this.contextType = _approutercontextsharedruntime.AppRouterContext;\n    }`,
    to: `    static contextType = _approutercontextsharedruntime.AppRouterContext;`,
  },
  {
    file: join(nm, 'catch-error.js'),
    from: `    static{\n        this.contextType = _approutercontextsharedruntime.AppRouterContext;\n    }\n    static{\n        // \`catchError()\` is parsed as an HOC-style name and displays as\n        // a label (<name> [catchError]) in DevTools.\n        this.displayName = 'catchError(Next.CatchError)';\n    }`,
    to: `    static contextType = _approutercontextsharedruntime.AppRouterContext;\n    // \`catchError()\` is parsed as an HOC-style name and displays as\n    // a label (<name> [catchError]) in DevTools.\n    static displayName = 'catchError(Next.CatchError)';`,
  },
];

let failed = false;
for (const p of PATCHES) {
  let code;
  try {
    code = readFileSync(p.file, 'utf8');
  } catch (e) {
    console.error(`[ios15-patch] 找不到文件，跳过: ${p.file}`);
    failed = true;
    continue;
  }
  if (code.includes(p.to)) {
    console.log(`[ios15-patch] 已打过补丁，跳过: ${p.file}`);
  } else if (!code.includes(p.from)) {
    console.error(`[ios15-patch] 特征串对不上（Next 可能升级了），请人工检查: ${p.file}`);
    failed = true;
    continue;
  } else {
    writeFileSync(p.file, code.replace(p.from, p.to));
    console.log(`[ios15-patch] 已修补: ${p.file}`);
  }
  const after = readFileSync(p.file, 'utf8');
  if (/static\s*\{/.test(after)) {
    console.error(`[ios15-patch] 修补后仍有 static 块残留: ${p.file}`);
    failed = true;
  }
}
if (failed) {
  console.error('[ios15-patch] 补丁失败，构建继续但 iOS 15 可能仍无法解析');
  process.exit(1);
}
console.log('[ios15-patch] OK：next/dist 已无 class static 块');
