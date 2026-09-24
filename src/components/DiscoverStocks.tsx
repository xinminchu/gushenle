'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Check, Search, ChevronDown, Compass } from 'lucide-react';
import {
  SECTORS,
  STOCK_LIST,
  allThemes,
  filterStocks,
  CODE_CORRECTIONS,
  type StockInfo,
} from '@/lib/stockList';
import { STOCK_PINYIN, ALIAS_PINYIN } from '@/lib/stockPinyin';
import { STOCK_ALIASES } from '@/lib/stockAliases';
import { loadUniverse, searchUniverse, type UniverseEntry } from '@/lib/universe';
import { useWatchlist } from './WatchlistContext';

/** 精选名单代码集合：全市场搜索时排除，精选优先 */
const CURATED_CODES = new Set(STOCK_LIST.map((s) => s.code));

/** 别名按代码分组：小火箭 -> RKLB 这类昵称也能搜到 */
const ALIASES_BY_CODE = new Map<string, string[]>();
for (const [alias, code] of Object.entries(STOCK_ALIASES)) {
  const arr = ALIASES_BY_CODE.get(code) ?? [];
  arr.push(alias);
  ALIASES_BY_CODE.set(code, arr);
}

/**
 * 搜索命中：代码 / 英文名 / 中文名 / 拼音全拼 / 拼音首字母 / 别名(含拼音)。
 * 打错自动纠正：TESLA -> TSLA。
 */
function matchStock(s: StockInfo, qRaw: string): boolean {
  const q = qRaw.trim().toLowerCase().replace(/\s+/g, '');
  if (!q) return true;
  const corrected = CODE_CORRECTIONS[qRaw.trim().toUpperCase()];
  if (corrected && s.code === corrected) return true;
  const hay: string[] = [s.code.toLowerCase(), s.en.toLowerCase(), s.zh.toLowerCase()];
  const py = STOCK_PINYIN[s.code];
  if (py) hay.push(py.full, py.initials);
  for (const alias of ALIASES_BY_CODE.get(s.code) ?? []) {
    hay.push(alias.toLowerCase());
    const apy = ALIAS_PINYIN[alias];
    if (apy) hay.push(apy.full, apy.initials);
  }
  return hay.some((h) => h.includes(q));
}

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
    const r = filterStocks(sector || undefined, theme || undefined);
    if (!q.trim()) return r;
    return r.filter((s) => matchStock(s, q));
  }, [sector, theme, q]);

  /** 精选搜不到时，懒加载全市场库兜底（约 7000 只） */
  const [universe, setUniverse] = useState<UniverseEntry[] | null>(null);
  useEffect(() => {
    if (open && q.trim() && results.length === 0 && universe === null) {
      loadUniverse().then(setUniverse);
    }
  }, [open, q, results.length, universe]);
  const uniResults = useMemo(
    () => (universe && results.length === 0 ? searchUniverse(universe, q, CURATED_CODES, 5) : []),
    [universe, results.length, q],
  );

  /** 打错自动纠正提示，如输入 TESLA 显示"已自动纠正为 TSLA" */
  const correctedHint = useMemo(() => {
    const t = q.trim();
    if (!t) return '';
    const c = CODE_CORRECTIONS[t.toUpperCase()];
    return c ? `已自动纠正为 ${c}` : '';
  }, [q]);

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
              placeholder="搜代码 / 拼音 / 中英文名，如 pg、特斯拉、小火箭"
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          {correctedHint && (
            <div className="text-[10px] text-emerald-400 -mt-1.5">{correctedHint}</div>
          )}
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
              <div className="py-4 space-y-2">
                {uniResults.length > 0 ? (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-500 text-center">
                      精选名单没有，全市场找到这几只：
                    </div>
                    {uniResults.map((u) => {
                      const added = inList.has(u.code);
                      return (
                        <div
                          key={u.code}
                          className="flex items-center justify-between bg-slate-800/60 rounded-lg px-2.5 py-1.5"
                        >
                          <div className="min-w-0">
                            <span className="text-[11px] font-semibold text-slate-100">
                              {u.code}
                            </span>
                            <div className="text-[10px] text-slate-500 truncate">{u.en}</div>
                          </div>
                          {added ? (
                            <span className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 ml-2">
                              <Check className="w-3.5 h-3.5" /> 已在自选
                            </span>
                          ) : (
                            <button
                              onClick={() => addItem(u.code, u.en)}
                              className="flex items-center gap-1 text-[11px] bg-blue-600 hover:bg-blue-500 text-white rounded-full px-2.5 py-1 shrink-0 ml-2"
                            >
                              <Plus className="w-3 h-3" /> 加入
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <div className="text-[11px] text-slate-500">没找到，换个条件试试</div>
                    {/^([A-Za-z]{1,8}|\d{6}\.[A-Za-z]{2})$/.test(q.trim()) &&
                      !inList.has(q.trim().toUpperCase()) && (
                        <button
                          onClick={() => {
                            const r = addItem(q.trim().toUpperCase());
                            if (r === 'ok') setQ('');
                          }}
                          className="text-[11px] text-blue-400 underline underline-offset-2 hover:text-blue-300"
                        >
                          名单里没有，直接添加「{q.trim().toUpperCase()}」到自选
                        </button>
                      )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
