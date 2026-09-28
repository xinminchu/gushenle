'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import type { InfoSection } from './modals/SiteInfoModal';

type Stats = { visitors: number | null; today: number | null; users: number | null };

/** 页脚统计行：首次打开打点并读数，之后只读数；没数据时不渲染 */
function SiteStatsLine() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tracked = sessionStorage.getItem('gsl_tracked');
        const res = await fetch('/api/stats', { method: tracked ? 'GET' : 'POST' });
        const j = await res.json();
        if (alive && j?.ok) {
          if (!tracked) sessionStorage.setItem('gsl_tracked', '1');
          setStats({ visitors: j.visitors, today: j.today, users: j.users });
        }
      } catch {
        /* 统计失败不打扰页面 */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (!stats || stats.visitors == null) return null;
  return (
    <p className="text-center text-[10px] text-slate-600 mt-1">
      {en ? (
        <>
          {stats.visitors}{' '}visitors{stats.today != null ? ` · ${stats.today} today` : ''}
          {stats.users != null ? ` · ${stats.users} registered` : ''}
        </>
      ) : (
        <>
          已有 {stats.visitors} 位访客{stats.today != null ? ` · 今日 ${stats.today} 位` : ''}
          {stats.users != null ? ` · ${stats.users} 位用户注册` : ''}
        </>
      )}
    </p>
  );
}

/** 站点页脚：简介 / 用法 / 版权法律 / 时间轴入口 + 版权行 */
export default function SiteFooter({ onOpen }: { onOpen: (s: InfoSection) => void }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const links: [InfoSection, string][] = [
    ['about', en ? 'About' : '简介'],
    ['guide', en ? 'Guide' : '用法'],
    ['legal', en ? 'Legal' : '版权与法律'],
    ['timeline', en ? 'Timeline' : '时间轴'],
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
        {en
          ? '© 2026 Gushenle gushenle.com · Investing involves risk; content is for reference only'
          : '© 2026 股神乐 gushenle.com · 投资有风险，内容仅供参考'}
      </p>
      <SiteStatsLine />
    </footer>
  );
}
