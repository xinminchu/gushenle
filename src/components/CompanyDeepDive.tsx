'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import { tx } from '@/lib/hant';

interface DeepSection {
  title: string;
  body: string;
}
interface DeepData {
  symbol: string;
  name: string;
  asOf: string;
  sections: DeepSection[];
  disclaimer: string;
}

const LS_KEY = 'gushenle:company_deep_v1';
function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function readCache(symbol: string): DeepData | null {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    const e = all[symbol];
    if (e && e.date === todayStr() && e.data) return e.data as DeepData;
  } catch {}
  return null;
}
function writeCache(symbol: string, data: DeepData) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    all[symbol] = { date: todayStr(), data };
    const keys = Object.keys(all);
    if (keys.length > 60) delete all[keys[0]];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * 🔍 AI 深挖：公司基本面事实卡（商业模式/收入来源/主营产品/主要风险）。
 * 只做事实层，不做观点层：不给买卖建议、不给目标价。
 * 折叠懒加载：用户不点开就不调接口；没配 key / 调用失败时静默隐藏。
 */
export default function CompanyDeepDive({ symbol, lang = 'zh' }: { symbol: string; lang?: Lang }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<DeepData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dead, setDead] = useState(false); // 没 key / 失败：当不存在，不打扰

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || data || loading || dead) return;
    const cached = readCache(symbol);
    if (cached) {
      setData(cached);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/company-deep', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, lang }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.sections) && json.sections.length > 0) {
        const d: DeepData = {
          symbol: json.symbol,
          name: json.name,
          asOf: json.asOf,
          sections: json.sections,
          disclaimer: json.disclaimer,
        };
        setData(d);
        writeCache(symbol, d);
      } else {
        setDead(true);
      }
    } catch {
      setDead(true);
    } finally {
      setLoading(false);
    }
  };

  if (dead) return null;

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl px-3 py-2.5">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between text-left"
      >
        <span className="text-[10px] text-slate-500">
          {tx(lang, '🔍 AI deep dive: business, revenue, risks (facts only)', '🔍 AI 深挖：商业模式 / 收入 / 风险（只讲事实）')}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {loading && !data && (
            <p className="text-[11px] text-slate-500">{tx(lang, 'AI is reading public filings…', 'AI 正在翻公开资料…')}</p>
          )}
          {data && (
            <>
              {data.sections.map((s) => (
                <div key={s.title}>
                  <div className="text-[11px] font-semibold text-slate-200 mb-0.5">{s.title}</div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{s.body}</p>
                </div>
              ))}
              <p className="text-[10px] text-slate-600 leading-relaxed border-t border-slate-800 pt-1.5">
                {data.disclaimer}
                <span className="text-slate-700"> · {data.asOf}</span>
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
