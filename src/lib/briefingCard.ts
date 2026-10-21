/* 盘前早报分享长图：把当期早报渲染成竖版长图（纯客户端 canvas，无服务端依赖）。
   选择客户端 canvas 而非服务端渲染的原因（2026-10-21）：
   - 真机"一键保存/转发"：canvas.toBlob + a[download] / navigator.share，原生可用；
   - 零新增依赖、零字体授权问题（用设备系统字体）；
   - 浅色底（省墨/打印友好，站内统一规范）。
   验收：文字不溢出（逐行实测宽度，超宽换行）、日期正确、浅底。 */

import {
  BRIEFING_SECTION_META,
  BRIEFING_DISCLAIMER,
  briefingSections,
  type MorningBriefing,
} from './morningBriefing';

const CARD_W = 750;
const PAD = 44;
const FONT_STACK = `-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", sans-serif`;

const SECTION_COLORS = ['#1d4ed8', '#0e7490', '#7c3aed', '#b45309'];

/** 逐字符换行（中英混排通用）：按 ctx 实测宽度切行，绝不溢出。 */
export function wrapLines(
  measure: (s: string) => number,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    const next = cur + ch;
    if (measure(next) > maxWidth && cur.length > 0) {
      lines.push(cur);
      cur = ch === ' ' ? '' : ch;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

interface CardLine {
  text: string;
  size: number;
  weight: string;
  color: string;
  gapAfter: number;
}

/** 先排版、后绘制：排版结果可单元测试（测高度/行数），绘制只是执行。 */
export function layoutBriefingCard(b: MorningBriefing): { lines: CardLine[]; height: number } {
  const maxW = CARD_W - PAD * 2;
  // 排版期用近似字宽（中文 1em / ASCII 0.55em），绘制期用真实 measureText 重排。
  const approx = (size: number) => (s: string) =>
    [...s].reduce((w, ch) => w + (ch.charCodeAt(0) > 0xff ? size : size * 0.55), 0);
  const lines: CardLine[] = [];
  const push = (text: string, size: number, weight: string, color: string, gapAfter = 0) => {
    for (const ln of wrapLines(approx(size), text, maxW)) {
      lines.push({ text: ln, size, weight, color, gapAfter: 0 });
    }
    if (lines.length > 0) lines[lines.length - 1].gapAfter = gapAfter;
  };

  push('股神乐 · 盘前早报', 40, '700', '#111827', 6);
  push(b.date, 24, '400', '#6b7280', 18);
  push('', 20, '400', '#111827', 10);

  briefingSections(b).forEach(({ id, items }, si) => {
    const meta = BRIEFING_SECTION_META[id];
    push(`${meta.num}、${meta.zh}`, 28, '700', SECTION_COLORS[si % SECTION_COLORS.length], 8);
    items.forEach((it) => {
      push(`· ${it.text}`, 22, '400', '#1f2937', 2);
      push(`来源：${it.source}`, 18, '400', '#9ca3af', 10);
    });
    push('', 20, '400', '#111827', 8);
  });

  push(BRIEFING_DISCLAIMER.zh, 20, '400', '#6b7280', 6);
  push('gushenle.com', 20, '400', '#9ca3af', 0);

  const height =
    PAD * 2 + lines.reduce((h, l) => h + l.size * 1.5 + l.gapAfter, 0);
  return { lines, height };
}

/** 在浏览器里绘制并返回 PNG blob；非浏览器环境返回 null。 */
export async function renderBriefingCard(b: MorningBriefing): Promise<Blob | null> {
  if (typeof document === 'undefined') return null;
  const { lines, height } = layoutBriefingCard(b);
  const canvas = document.createElement('canvas');
  const dpr = Math.min(2, (window.devicePixelRatio || 1));
  canvas.width = CARD_W * dpr;
  canvas.height = Math.ceil(height) * dpr;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(dpr, dpr);

  // 浅底
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CARD_W, Math.ceil(height));

  const maxW = CARD_W - PAD * 2;
  let y = PAD;
  for (const ln of lines) {
    if (!ln.text) {
      y += ln.size * 1.5 + ln.gapAfter;
      continue;
    }
    ctx.font = `${ln.weight} ${ln.size}px ${FONT_STACK}`;
    ctx.fillStyle = ln.color;
    ctx.textBaseline = 'top';
    // 绘制期用真实宽度重排，防止近似排版偏差导致溢出
    const rows = wrapLines((s) => ctx.measureText(s).width, ln.text, maxW);
    for (const row of rows) {
      ctx.fillText(row, PAD, y);
      y += ln.size * 1.5;
    }
    y += ln.gapAfter;
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** 一键保存；支持 Web Share 时走系统分享（微信转发友好）。 */
export async function shareBriefingCard(b: MorningBriefing): Promise<'shared' | 'saved' | 'failed'> {
  const blob = await renderBriefingCard(b);
  if (!blob) return 'failed';
  const file = new File([blob], `gushenle-briefing-${b.date}.png`, { type: 'image/png' });
  try {
    if (typeof navigator !== 'undefined' && 'share' in navigator && navigator.canShare?.(file ? { files: [file] } : {})) {
      await (navigator as Navigator & { share: (d: { files: File[]; title: string }) => Promise<void> }).share({
        files: [file],
        title: `股神乐盘前早报 ${b.date}`,
      });
      return 'shared';
    }
  } catch {
    // 用户取消分享 -> 回退到下载
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return 'saved';
  } catch {
    return 'failed';
  }
}
