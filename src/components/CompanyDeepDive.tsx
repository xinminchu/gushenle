'use client';

import React, { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import type { Lang } from '@/lib/i18n';
import { tx } from '@/lib/hant';

interface DeepSection {
  title: string;
  body: string;
}
interface NewsHeadline {
  title: string;
  time: number;
  uri: string;
}
interface TrendInfo {
  pct: number;
  from: number;
  to: number;
  high: number;
  low: number;
  lastDate: string;
  days: number;
}
interface DeepData {
  symbol: string;
  name: string;
  asOf: string;
  news: NewsHeadline[];
  trend: TrendInfo | null;
  sections: DeepSection[];
  disclaimer: string;
}

const LS_KEY = 'gushenle:company_deep_v2';
const LS_TTL = 30 * 60 * 1000; // 动态部分 30 分钟新鲜度
function readCache(symbol: string): DeepData | null {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    const e = all[symbol];
    if (e && Date.now() - e.at < LS_TTL && e.data) return e.data as DeepData;
  } catch {}
  return null;
}
function writeCache(symbol: string, data: DeepData) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    all[symbol] = { at: Date.now(), data };
    const keys = Object.keys(all);
    if (keys.length > 60) delete all[keys[0]];
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {}
}

function timeAgo(ms: number, lang: Lang): string {
  const m = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (m < 1) return tx(lang, 'just now', '刚刚');
  if (m < 60) return tx(lang, `${m}m ago`, `${m} 分钟前`);
  const h = Math.floor(m / 60);
  if (h < 24) return tx(lang, `${h}h ago`, `${h} 小时前`);
  const d = Math.floor(h / 24);
  return tx(lang, `${d}d ago`, `${d} 天前`);
}

/**
 * 🔍 AI 深挖：动态（最近快讯 + 近期走势）+ AI 公司档案。
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
          news: Array.isArray(json.news) ? json.news : [],
          trend: json.trend || null,
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

  const trend = data?.trend;
  const trendUp = trend ? trend.pct >= 0 : false;

  return (
    <div className="rounded-xl px-3 py-2.5 bg-amber-500/5 border border-amber-500/25 border-l-2 border-l-amber-400/70">
      <button onClick={toggle} className="w-full flex items-center justify-between text-left gap-2">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12px] font-semibold text-amber-200/90 shrink-0">
            {tx(lang, '🔍 AI Deep Dive', '🔍 AI 深挖')}
          </span>
          <span className="text-[10px] text-slate-500 truncate">
            {tx(lang, 'latest news · price action · company file', '最近动态 · 近期走势 · 公司档案')}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-amber-300/70 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-2.5 space-y-3">
          {loading && !data && (
            <p className="text-[11px] text-slate-500">{tx(lang, 'AI is reading public filings…', 'AI 正在翻公开资料…')}</p>
          )}
          {data && (
            <>
              {/* 📰 最近动态：真实快讯标题 */}
              <div>
                <div className="text-[11px] font-semibold text-slate-200 mb-1">
                  {tx(lang, '📰 Latest', '📰 最近动态')}
                </div>
                {data.news.length > 0 ? (
                  <ul className="space-y-1.5">
                    {data.news.map((n, i) => (
                      <li key={`${n.time}-${i}`}>
                        {n.uri ? (
                          <a
                            href={n.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="group flex items-start gap-1 text-[11px] leading-relaxed text-slate-300 hover:text-amber-200"
                          >
                            <span className="flex-1">
                              <span className="text-slate-500 mr-1">{timeAgo(n.time, lang)}</span>
                              {n.title}
                            </span>
                            <ExternalLink className="w-3 h-3 mt-0.5 shrink-0 text-slate-600 group-hover:text-amber-300" />
                          </a>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-slate-300">
                            <span className="text-slate-500 mr-1">{timeAgo(n.time, lang)}</span>
                            {n.title}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-600">
                    {tx(lang, 'No related headlines in the wire right now.', '资讯源里暂时没有这只的相关快讯。')}
                  </p>
                )}
              </div>

              {/* 📈 近期走势：本地确定性计算 */}
              {trend && (
                <div>
                  <div className="text-[11px] font-semibold text-slate-200 mb-1">
                    {tx(lang, '📈 Recent price action', '📈 近期走势')}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {tx(lang, `Last ${trend.days} sessions`, `近 ${trend.days} 个交易日`)}{' '}
                    <span className={`font-semibold ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {trendUp ? '+' : ''}
                      {trend.pct.toFixed(1)}%
                    </span>
                    <span className="text-slate-500">
                      {' '}
                      · {trend.from.toFixed(2)} → {trend.to.toFixed(2)} ·{' '}
                      {tx(lang, 'range', '区间')} {trend.low.toFixed(2)}–{trend.high.toFixed(2)}
                    </span>
                  </p>
                </div>
              )}

              {/* AI 公司档案 */}
              <div className="border-t border-slate-800 pt-2 space-y-2">
                <div className="text-[11px] font-semibold text-slate-200">
                  {tx(lang, '🏢 Company file', '🏢 公司档案')}
                </div>
                {data.sections.map((s) => (
                  <div key={s.title}>
                    <div className="text-[11px] font-medium text-slate-300 mb-0.5">{s.title}</div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{s.body}</p>
                  </div>
                ))}
              </div>

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
