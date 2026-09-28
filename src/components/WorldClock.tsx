'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 双时钟：纽约 / 北京实时时间，左右分布，每秒跳动。
 * 纯本地计算（Intl 时区换算 + 1 秒定时器），零网络请求，不占流量；
 * 卸载时清掉定时器，不影响稳定性。
 */
/**
 * 双时钟：北京 / 纽约实时时间，居中一行，中间 🤝。
 * 北京用华人格式 2026-09-26 00:00:00，纽约用美式 00:00:00 09-25-2026，
 * 各自按当地时区算日期（两地时差大，日期经常差一天）。
 * 纯本地计算，零网络请求。
 */
const bjDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const bjTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const nyTime = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const nyDate = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
});

export default function WorldClock() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  // null 占位：避免 SSR 与客户端水合不一致，挂载后再走表
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // en-CA 直接输出 2026-09-26；en-US 输出 09/25/2026，转成 09-25-2026
  const bj = now ? `${bjDate.format(now)} ${bjTime.format(now)}` : '----/--/-- --:--:--';
  const ny = now ? `${nyTime.format(now)} ${nyDate.format(now).replace(/\//g, '-')}` : '--:--:-- --/--/----';

  return (
    <div className="flex items-center justify-center gap-1.5 px-4 pt-1.5 text-[11px] tabular-nums select-none whitespace-nowrap">
      <span className="text-slate-500">
        <span className="text-slate-300 font-medium">{bj}</span> {en ? 'Beijing' : '北京'}
      </span>
      <span aria-hidden="true" className="text-[11px]">🤝</span>
      <span className="text-slate-500">
        {en ? 'New York' : '纽约'} <span className="text-slate-300 font-medium">{ny}</span>
      </span>
    </div>
  );
}
