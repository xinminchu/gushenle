'use client';

import type { InfoSection } from './modals/SiteInfoModal';

/** 站点页脚：简介 / 用法 / 版权法律 / 时间轴入口 + 版权行 */
export default function SiteFooter({ onOpen }: { onOpen: (s: InfoSection) => void }) {
  const links: [InfoSection, string][] = [
    ['about', '简介'],
    ['guide', '用法'],
    ['legal', '版权与法律'],
    ['timeline', '时间轴'],
  ];
  return (
    <footer className="max-w-md mx-auto px-4 pt-6 pb-2">
      <div className="border-t border-slate-800/80 pt-4 flex items-center justify-center gap-4 flex-wrap">
        {links.map(([id, label]) => (
          <button
            key={id}
            onClick={() => onOpen(id)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-center text-[10px] text-slate-600 mt-2 leading-relaxed">
        © 2026 股神乐 gushenle.com · 投资有风险，内容仅供参考
      </p>
    </footer>
  );
}
