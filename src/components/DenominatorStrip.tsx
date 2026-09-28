// 资讯页顶部「分母」条：30Y / 10Y 美债收益率（/api/macro，FRED）
// 无 key 或取数失败时静默隐藏，不打扰页面
'use client';

import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/context/LanguageContext';

interface MacroData {
  ok: boolean;
  y30?: number;
  y10?: number | null;
  dateCN?: string;
  dateEn?: string;
  note?: string;
  noteEn?: string;
}

export default function DenominatorStrip() {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [data, setData] = useState<MacroData | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/macro')
      .then((r) => r.json())
      .then((j: MacroData) => {
        if (alive && j.ok) setData(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!data || !data.ok || data.y30 == null) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
      <div className="flex items-baseline gap-2">
        <span className="text-[11px] text-slate-500 shrink-0">{en ? '📐 Denominator · cost of money' : '📐 分母 · 钱的成本'}</span>
        <span className="text-xs text-slate-300">
          {en ? '30-yr Treasury' : '30年国债'} <span className="font-bold text-slate-100">{data.y30.toFixed(2)}%</span>
          {data.y10 != null && (
            <span className="text-slate-400"> · {en ? '10-yr' : '10年国债'} {data.y10.toFixed(2)}%</span>
          )}
        </span>
        {data.dateCN && (
          <span className="text-[10px] text-slate-600 ml-auto shrink-0">{en ? `as of ${data.dateEn ?? data.dateCN}` : `截至${data.dateCN}`}</span>
        )}
      </div>
      {data.note && (
        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{en ? (data.noteEn ?? data.note) : data.note}</p>
      )}
    </div>
  );
}
