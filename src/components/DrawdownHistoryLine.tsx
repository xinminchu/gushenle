'use client';

import { useEffect, useState } from 'react';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 历史分位一句话：今日大跌（≤-3%）时，诊断卡价格下方显示一行历史对照。
 * "过去 X 年共 N 次单日跌超 4%，之后 20 天中位数 +Y%，Z% 的时候收涨。"
 * 只给 base rate，不预测、不建议。无数据/样本不足自动隐藏。
 */

const SHOW_THRESHOLD = -3; // 今日跌幅触发线（%）

interface Data {
  available: boolean;
  n: number;
  years: string;
  median20: number;
  positivePct: number;
  threshold: number;
  fwdDays: number;
}

export default function DrawdownHistoryLine({
  symbol,
  dayPct,
}: {
  symbol: string;
  dayPct: number | null | undefined;
}) {
  const { lang } = useLanguage();
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    if (dayPct == null || dayPct > SHOW_THRESHOLD) {
      setData(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/drawdown-history?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && j?.available && j.n > 0) setData(j as Data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol, dayPct]);

  if (!data) return null;

  const med = data.median20 >= 0 ? `+${data.median20}%` : `${data.median20}%`;
  return (
    <div className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
      {tx(
        lang,
        `📉 History: ${data.n} single-day drops over ${data.threshold}% in the past ${data.years}y — median ${data.fwdDays}d return ${med}, green ${data.positivePct}% of the time. Base rate, not a forecast.`,
        `📉 历史对照：过去 ${data.years} 年共出现 ${data.n} 次单日跌超 ${Math.abs(data.threshold)}%，之后 ${data.fwdDays} 天中位数 ${med}，${data.positivePct}% 的时候收涨。只是历史分布，不是预测。`,
      )}
    </div>
  );
}
