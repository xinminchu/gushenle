// 家人页顶部浏览区：今日大事 + 未来7天 + 全年大事记（免登录可看）
'use client';

import React, { useState, useEffect } from 'react';
import { Newspaper, CalendarDays, ChevronDown, RefreshCw, Landmark, ExternalLink } from 'lucide-react';
import {
  getUpcomingEvents,
  getYearEvents,
  kindMeta,
  formatDateCN,
  todayStr,
  type CalEvent,
} from '@/lib/financeCalendar';
import { loadWatchlist } from '@/lib/watchlist';
import type { NewsItem } from '@/app/api/news/route';
import type { EarningsEvent } from '@/app/api/earnings/route';

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const NEWS_MARKET_KEY = 'gushenle:news-market';
type NewsMarket = 'us' | 'cn';

export default function FamilyNews() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsOpen, setNewsOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsErr, setNewsErr] = useState(false);
  const [market, setMarket] = useState<NewsMarket>(() => {
    try {
      return localStorage.getItem(NEWS_MARKET_KEY) === 'cn' ? 'cn' : 'us';
    } catch {
      return 'us';
    }
  });
  const [weekEvents, setWeekEvents] = useState<CalEvent[]>([]);
  const [yearOpen, setYearOpen] = useState(false);

  const loadNews = async (m: NewsMarket) => {
    setNewsLoading(true);
    setNewsErr(false);
    setExpandedId(null);
    try {
      const r = await fetch(`/api/news?market=${m}`);
      const j = await r.json();
      setNews(j.items || []);
      if (!j.items || j.items.length === 0) setNewsErr(true);
    } catch {
      setNewsErr(true);
    } finally {
      setNewsLoading(false);
    }
  };

  const switchMarket = (m: NewsMarket) => {
    if (m === market) return;
    setMarket(m);
    setNewsOpen(false);
    try {
      localStorage.setItem(NEWS_MARKET_KEY, m);
    } catch {}
    loadNews(m);
  };

  useEffect(() => {
    loadNews(market);
    // 未来7天：固定日程 + 自选股财报
    const run = async () => {
      const today = todayStr();
      const staticEvts = getUpcomingEvents(today, 7);
      let earningEvts: CalEvent[] = [];
      try {
        const symbols = loadWatchlist().items.map((i) => i.symbol).join(',');
        if (symbols) {
          const r = await fetch(
            `/api/earnings?start=${today}&days=7&symbols=${encodeURIComponent(symbols)}`,
          );
          const j = await r.json();
          earningEvts = ((j.events || []) as EarningsEvent[]).map((e) => ({
            date: e.date,
            title: '发布财报',
            kind: 'earnings' as const,
            symbol: e.symbol,
            note: e.session,
          }));
        }
      } catch {
        /* 财报拿不到不影响日程 */
      }
      const merged = [...staticEvts, ...earningEvts].sort((a, b) =>
        a.date.localeCompare(b.date),
      );
      setWeekEvents(merged);
    };
    run();
  }, []);

  const shownNews = newsOpen ? news : news.slice(0, 6);
  const today = todayStr();
  const year = Number(today.slice(0, 4));
  const yearEvents = getYearEvents(year);
  const monthGroups = new Map<string, CalEvent[]>();
  for (const e of yearEvents) {
    const m = e.date.slice(5, 7);
    if (!monthGroups.has(m)) monthGroups.set(m, []);
    monthGroups.get(m)!.push(e);
  }

  // 按日期分组未来7天
  const dayGroups = new Map<string, CalEvent[]>();
  for (const e of weekEvents) {
    if (!dayGroups.has(e.date)) dayGroups.set(e.date, []);
    dayGroups.get(e.date)!.push(e);
  }

  return (
    <div className="space-y-4">
      {/* 今日大事 */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Newspaper className="w-3.5 h-3.5 text-sky-400" /> 今日大事
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-slate-800 rounded-full p-0.5 text-[10px]">
              {(['us', 'cn'] as NewsMarket[]).map((m) => (
                <button
                  key={m}
                  onClick={() => switchMarket(m)}
                  className={`px-2.5 py-1 rounded-full transition-colors ${
                    market === m
                      ? 'bg-sky-500/20 text-sky-300 font-semibold'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {m === 'us' ? '🇺🇸 美股' : '🇨🇳 国内'}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadNews(market)}
              className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[10px]"
            >
              <RefreshCw className={`w-3 h-3 ${newsLoading ? 'animate-spin' : ''}`} /> 刷新
            </button>
          </div>
        </div>
        {newsLoading ? (
          <p className="text-[11px] text-slate-500 py-2">快讯加载中…</p>
        ) : newsErr ? (
          <p className="text-[11px] text-slate-500 py-2">快讯暂时拿不到，稍后再来。</p>
        ) : (
          <>
            <div className="space-y-2.5">
              {shownNews.map((n) => {
                const expanded = expandedId === n.id;
                const hasTitle = n.title.length > 0;
                // 列表只露标题（无标题则露正文前 64 字），点开展开看全文
                const headline = hasTitle
                  ? n.title
                  : n.content.slice(0, 64) + (n.content.length > 64 ? '…' : '');
                const expandable = hasTitle
                  ? n.content.length > 0 && n.content !== n.title
                  : n.content.length > 64;
                return (
                  <div key={n.id} className="flex gap-2.5">
                    <span className="text-[10px] text-slate-500 shrink-0 pt-0.5 w-9">{fmtTime(n.time)}</span>
                    <div className="min-w-0 flex-1">
                      {expandable ? (
                        <button
                          onClick={() => setExpandedId(expanded ? null : n.id)}
                          className="w-full text-left"
                        >
                          <p className="text-[11px] font-semibold text-slate-200 leading-snug">
                            {headline}
                            <ChevronDown
                              className={`inline w-3 h-3 ml-1 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            />
                          </p>
                        </button>
                      ) : (
                        <p className="text-[11px] font-semibold text-slate-200 leading-snug">{headline}</p>
                      )}
                      {expanded && expandable && (
                        <div className="mt-1 space-y-1.5">
                          <p className="text-[11px] text-slate-400 leading-relaxed">{n.content}</p>
                          {n.uri && (
                            <a
                              href={n.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-0.5 text-[10px] text-sky-400 hover:text-sky-300"
                            >
                              查看原文 <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {news.length > 6 && (
              <button
                onClick={() => setNewsOpen(!newsOpen)}
                className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 py-1"
              >
                {newsOpen ? '收起' : `展开更多（${news.length - 6}条）`}
                <ChevronDown className={`w-3 h-3 transition-transform ${newsOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </>
        )}
      </section>

      {/* 未来7天 */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <CalendarDays className="w-3.5 h-3.5 text-amber-400" /> 未来7天
          <span className="text-[10px] text-slate-500 font-normal">大事发生前，心里先有数</span>
        </div>
        {dayGroups.size === 0 ? (
          <p className="text-[11px] text-slate-500 py-1">未来7天没有重要日程，可以安心看律动。</p>
        ) : (
          <div className="space-y-2.5">
            {[...dayGroups.entries()].map(([date, evts]) => (
              <div key={date} className="flex gap-2.5">
                <div className="shrink-0 w-20 pt-0.5">
                  <p className={`text-[11px] font-semibold ${date === today ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {date === today ? '今天' : formatDateCN(date)}
                  </p>
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  {evts.map((e, i) => {
                    const meta = kindMeta(e.kind);
                    return (
                      <div key={i} className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.chip}`}>
                          {meta.icon} {meta.label}
                        </span>
                        <span className="text-[11px] text-slate-300">
                          {e.symbol && <span className="font-bold text-slate-100">{e.symbol} </span>}
                          {e.title}
                        </span>
                        {e.note && <span className="text-[10px] text-slate-500">{e.note}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        {/* 全年大事记 */}
        <div className="pt-1 border-t border-slate-800">
          <button
            onClick={() => setYearOpen(!yearOpen)}
            className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 py-1.5"
          >
            <Landmark className="w-3 h-3" /> {year}年大事记
            <ChevronDown className={`w-3 h-3 transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
          </button>
          {yearOpen && (
            <div className="space-y-3 pt-1 max-h-80 overflow-y-auto">
              {[...monthGroups.entries()].map(([m, evts]) => (
                <div key={m}>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">{Number(m)}月</p>
                  <div className="space-y-1">
                    {evts.map((e, i) => {
                      const meta = kindMeta(e.kind);
                      const past = e.date < today;
                      return (
                        <div key={i} className={`flex items-center gap-1.5 text-[11px] ${past ? 'opacity-40' : ''}`}>
                          <span className="text-slate-500 w-14 shrink-0">{e.date.slice(5).replace('-', '/')}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.chip}`}>{meta.label}</span>
                          <span className="text-slate-300 truncate">{e.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-600 pt-1">FOMC 与 CPI 日期来自美联储/BLS 官方日程，每年更新一次。</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
