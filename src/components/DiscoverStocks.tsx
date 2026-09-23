'use client';

import { useMemo, useState } from 'react';
import { Plus, Check, Search, ChevronDown, Compass } from 'lucide-react';
import { SECTORS, allThemes, filterStocks } from '@/lib/stockList';
import { useWatchlist } from './WatchlistContext';

/**
 * 发现股票：按板块 / 主题筛选，一键加入自选。
 * 放在今日页「管理自选」里。不做按时间/涨跌排序（实时扫数据太重）。
 */
export default function DiscoverStocks() {
  const { items: watchlist, addItem } = useWatchlist();
  const [open, setOpen] = useState(false);
  const [sector, setSector] = useState('');
  const [theme, setTheme] = useState('');
  const [q, setQ] = useState('');

  const themes = useMemo(() => allThemes(), []);
  const inList = useMemo(() => new Set(watchlist.map((w) => w.symbol)), [watchlist]);

  const results = useMemo(() => {
    let r = filterStocks(sector || undefined, theme || undefined);
    const query = q.trim().toLowerCase();
    if (query) {
      const rawQ = q.trim();
      r = r.filter(
        (s) =>
          s.code.toLowerCase().includes(query) ||
          s.en.toLowerCase().includes(query) ||
          s.zh.includes(rawQ),
      );
    }
    return r;
  }, [sector, theme, q]);

  const chip = (active: boolean) =>
    `text-[11px] px-2.5 py-1 rounded-full border whitespace-nowrap ${
      active
        ? 'bg-blue-600 border-blue-500 text-white'
        : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
    }`;

  return (
    <div className="border-t border-slate-800 pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between text-sm text-slate-200"
      >
        <span className="flex items-center gap-1.5 font-medium">
          <Compass className="w-4 h-4 text-blue-400" /> 发现股票
          <span className="text-[10px] text-slate-500 font-normal">按板块 · 按主题</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-3 space-y-2.5">
          {/* 搜索 */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜代码 / 英文名 / 中文名，如 特斯拉"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          {/* 板块 */}
          <div>
            <div className="text-[10px] text-slate-500 mb-1">板块</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setSector('')} className={chip(!sector)}>全部</button>
              {SECTORS.map((s) => (
                <button key={s} onClick={() => setSector(sector === s ? '' : s)} className={chip(sector === s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          {/* 主题 */}
          <div>
            <div className="text-[10px] text-slate-500 mb-1">主题</div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setTheme('')} className={chip(!theme)}>全部</button>
              {themes.map((t) => (
                <button key={t} onClick={() => setTheme(theme === t ? '' : t)} className={chip(theme === t)}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {/* 结果 */}
          <div className="text-[10px] text-slate-500">共 {results.length} 只</div>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-0.5">
            {results.map((s) => {
              const added = inList.has(s.code);
              return (
                <div
                  key={s.code}
                  className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-100">
                      {s.code} <span className="font-normal text-slate-300">{s.zh}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate">
                      {s.en} · {s.sector}
                      {s.themes.length > 0 && ` · ${s.themes.join(' ')}`}
                    </div>
                  </div>
                  {added ? (
                    <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 ml-2">
                      <Check className="w-3.5 h-3.5" /> 已在自选
                    </span>
                  ) : (
                    <button
                      onClick={() => addItem(s.code, s.zh)}
                      className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-full px-2.5 py-1 shrink-0 ml-2"
                    >
                      <Plus className="w-3 h-3" /> 加入
                    </button>
                  )}
                </div>
              );
            })}
            {results.length === 0 && (
              <div className="text-[11px] text-slate-500 text-center py-4">没找到，换个条件试试</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
