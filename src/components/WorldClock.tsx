'use client';

import { useEffect, useState } from 'react';

/**
 * 双时钟：纽约 / 北京实时时间，左右分布，每秒跳动。
 * 纯本地计算（Intl 时区换算 + 1 秒定时器），零网络请求，不占流量；
 * 卸载时清掉定时器，不影响稳定性。
 */
const fmtNY = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'America/New_York',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});
const fmtBJ = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export default function WorldClock() {
  // null 占位：避免 SSR 与客户端水合不一致，挂载后再走表
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ny = now ? fmtNY.format(now) : '--:--:--';
  const bj = now ? fmtBJ.format(now) : '--:--:--';

  return (
    <div className="flex items-center justify-between px-4 pt-1.5 text-[10px] tabular-nums select-none">
      <span className="text-slate-500">
        纽约 <span className="text-slate-300 font-medium">{ny}</span>
      </span>
      <span className="text-slate-500">
        <span className="text-slate-300 font-medium">{bj}</span> 北京
      </span>
    </div>
  );
}
