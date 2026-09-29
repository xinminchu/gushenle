// 资讯页顶部浏览区：今日大事 + 未来7天 + 全年大事记（免登录可看）
'use client';

import React, { useState, useEffect } from 'react';
import { Newspaper, CalendarDays, ChevronDown, RefreshCw, Landmark, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import {
  getUpcomingEvents,
  getYearEvents,
  kindMeta,
  formatDateCN,
  todayStr,
  calEventTitle,
  calEventNote,
  MONTHS_EN_LIST,
  type CalEvent,
  sessionLabel,
} from '@/lib/financeCalendar';
import { loadWatchlist } from '@/lib/watchlist';
import type { NewsItem } from '@/app/api/news/route';
import type { EarningsEvent, SymbolReactions } from '@/app/api/earnings/route';
import { tx } from '@/lib/hant';

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const NEWS_MARKET_KEY = 'gushenle:news-market';
type NewsMarket = 'us' | 'cn';

export default function FamilyNews() {
  const { lang } = useLanguage();
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
  // 财报后反应实测（GoMoon 式"事件后市场走了多远"的日线版）
  const [reactions, setReactions] = useState<Record<string, SymbolReactions>>({});
  const [reactOpenKey, setReactOpenKey] = useState<string | null>(null);

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
            // note 存财报时段的规范 key（pre/after/during/tbd），渲染时按语言映射
            note: e.session ?? '',
          }));
        }
      } catch {
        /* 财报拿不到不影响日程 */
      }
      // 有财报的股票，一次性拉"财报后反应实测"
      try {
        const syms = [...new Set(earningEvts.map((e) => e.symbol).filter(Boolean))] as string[];
        if (syms.length > 0) {
          const rr = await fetch(`/api/earnings?mode=reactions&symbols=${encodeURIComponent(syms.join(','))}`);
          const jj = await rr.json();
          if (jj.reactions) setReactions(jj.reactions);
        }
      } catch {
        /* 往绩拿不到不影响日程 */
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
      {/* 最新快讯（newsfun-7：原名"今日大事"只覆盖很短的滚动窗口，改个诚实的名字） */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Newspaper className="w-3.5 h-3.5 text-sky-400" /> {tx(lang, 'Latest news', '最新快讯')}
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
                  {m === 'us' ? tx(lang, '🇺🇸 US', '🇺🇸 美股') : tx(lang, '🇨🇳 China', '🇨🇳 国内')}
                </button>
              ))}
            </div>
            <button
              onClick={() => loadNews(market)}
              className="text-slate-500 hover:text-slate-300 flex items-center gap-1 text-[10px]"
            >
              <RefreshCw className={`w-3 h-3 ${newsLoading ? 'animate-spin' : ''}`} /> {tx(lang, 'Refresh', '刷新')}
            </button>
          </div>
        </div>
        {newsLoading ? (
          <p className="text-[11px] text-slate-500 py-2">{tx(lang, 'Loading news…', '快讯加载中…')}</p>
        ) : newsErr ? (
          <p className="text-[11px] text-slate-500 py-2">{tx(lang, "Couldn't load the news — try again later.", '快讯暂时拿不到，稍后再来。')}</p>
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
                      {/* newsfun-7：每条标注来源；"查看原文"外露，不用点开才看得见 */}
                      <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-600">
                        <span>{tx(lang, 'Source: Wall Street CN', '来源：华尔街见闻')}</span>
                        {n.uri && (
                          <a
                            href={n.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300"
                          >
                            {tx(lang, 'View source', '查看原文')} <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      {expanded && expandable && (
                        <div className="mt-1 space-y-1.5">
                          <p className="text-[11px] text-slate-400 leading-relaxed">{n.content}</p>
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
                {newsOpen
                  ? tx(lang, 'Collapse', '收起')
                  : tx(lang, `Show more (${news.length - 6})`, `展开更多（${news.length - 6}条）`)}
                <ChevronDown className={`w-3 h-3 transition-transform ${newsOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </>
        )}
      </section>

      {/* 未来7天 */}
      <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
          <CalendarDays className="w-3.5 h-3.5 text-amber-400" /> {tx(lang, 'Next 7 days', '未来7天')}
          <span className="text-[10px] text-slate-500 font-normal">{tx(lang, "Know what's coming, before it happens", '大事发生前，心里先有数')}</span>
        </div>
        {dayGroups.size === 0 ? (
          <p className="text-[11px] text-slate-500 py-1">{tx(lang, 'Nothing major in the next 7 days — just follow the rhythm.', '未来7天没有重要日程，可以安心看律动。')}</p>
        ) : (          <div className="space-y-2.5">
            {[...dayGroups.entries()].map(([date, evts]) => (
              <div key={date} className="flex gap-2.5">
                <div className="shrink-0 w-20 pt-0.5">
                  <p className={`text-[11px] font-semibold ${date === today ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {date === today ? tx(lang, 'Today', '今天') : formatDateCN(date, lang)}
                  </p>
                </div>
                <div className="space-y-1.5 min-w-0 flex-1">
                  {evts.map((e, i) => {
                    const meta = kindMeta(e.kind, lang);
                    const rKey = `${e.date}-${e.symbol ?? ''}`;
                    const r = e.kind === 'earnings' && e.symbol ? reactions[e.symbol] : undefined;
                    const showR = r && r.past.length > 0;
                    const mixed = showR && r.up > 0 && r.down > 0;
                    const open = reactOpenKey === rKey;
                    return (
                      <React.Fragment key={i}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.chip}`}>
                            {meta.icon} {meta.label}
                          </span>
                          <span className="text-[11px] text-slate-300">
                            {e.symbol && <span className="font-bold text-slate-100">{e.symbol} </span>}
                            {calEventTitle(e, lang)}
                          </span>
                          {e.note && (
                            <span className="text-[10px] text-slate-500">
                              {e.kind === 'earnings' ? sessionLabel(e.note, lang) : calEventNote(e, lang)}
                            </span>
                          )}
                        </div>
                        {showR && (
                          <div className="pl-0.5 -mt-0.5">
                            <button
                              onClick={() => setReactOpenKey(open ? null : rKey)}
                              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 text-left"
                            >
                              <span>
                                📜 {tx(lang, 'Track record', '往绩')} ·{' '}
                                {tx(lang, `last ${r.past.length} earnings, next-day: `, `近${r.past.length}次财报后次日：`)}
                                <span
                                  className={
                                    r.avg != null && r.avg > 0
                                      ? 'text-emerald-400'
                                      : r.avg != null && r.avg < 0
                                        ? 'text-rose-400'
                                        : 'text-slate-400'
                                  }
                                >
                                  {r.up}
                                  {tx(lang, ' up ', '涨')}
                                  {r.down}
                                  {tx(lang, ' down', '跌')}
                                  {r.avg != null &&
                                    `, ${tx(lang, 'avg ', '平均')}${r.avg > 0 ? '+' : ''}${r.avg}%`}
                                </span>
                                {mixed && (
                                  <span className="text-slate-500">
                                    {tx(lang, ' · mixed — go easy before earnings', ' · 涨跌参半，财报前下手要慎')}
                                  </span>
                                )}
                              </span>
                              <ChevronDown
                                className={`w-3 h-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                              />
                            </button>
                            {open && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {r.past.map((p) => (
                                  <span
                                    key={p.date}
                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                      p.nextDayPct > 0
                                        ? 'bg-emerald-500/10 text-emerald-300/90 border-emerald-500/25'
                                        : p.nextDayPct < 0
                                          ? 'bg-rose-500/10 text-rose-300/90 border-rose-500/25'
                                          : 'bg-slate-500/10 text-slate-400 border-slate-600/40'
                                    }`}
                                  >
                                    {p.date.slice(5).replace('-', '/')}{' '}
                                    {p.nextDayPct > 0 ? '+' : ''}
                                    {p.nextDayPct}%
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-slate-600 pt-1">
          📊 {tx(lang, "Earnings days for your watchlist: manage your watchlist on the 'Today' tab and earnings days will show up here.", '自选股财报日：在「今日」页管理自选后，有财报的日子会自动列在这里。')}
        </p>
        {/* 全年大事记 */}
        <div className="pt-1 border-t border-slate-800">
          <button
            onClick={() => setYearOpen(!yearOpen)}
            className="w-full flex items-center justify-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 py-1.5"
          >
            <Landmark className="w-3 h-3" /> {tx(lang, `${year} key events`, `${year}年大事记`)}
            <ChevronDown className={`w-3 h-3 transition-transform ${yearOpen ? 'rotate-180' : ''}`} />
          </button>
          {yearOpen && (
            <div className="space-y-3 pt-1">
              {[...monthGroups.entries()].map(([m, evts]) => (
                <div key={m}>
                  <p className="text-[10px] font-semibold text-slate-500 mb-1">{lang === 'en' ? MONTHS_EN_LIST[Number(m) - 1] : `${Number(m)}月`}</p>
                  <div className="space-y-1">
                    {evts.map((e, i) => {
                      const meta = kindMeta(e.kind, lang);
                      const past = e.date < today;
                      return (
                        <div key={i} className={`flex items-center gap-1.5 text-[11px] ${past ? 'opacity-40' : ''}`}>
                          <span className="text-slate-500 w-14 shrink-0">{e.date.slice(5).replace('-', '/')}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.chip}`}>{meta.label}</span>
                          <span className="text-slate-300 truncate">{calEventTitle(e, lang)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <p className="text-[10px] text-slate-600 pt-1">{tx(lang, 'FOMC and CPI dates come from the Fed/BLS official schedules, updated yearly.', 'FOMC 与 CPI 日期来自美联储/BLS 官方日程，每年更新一次。')}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
