'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, Plus, Check, X } from 'lucide-react';
import { STOCK_LIST, CODE_CORRECTIONS, displayStockName, searchMacro, type StockInfo } from '@/lib/stockList';
import { matchStrength } from './DiscoverStocks';
import { loadUniverse, searchUniverse, type UniverseEntry } from '@/lib/universe';
import { useWatchlist } from './WatchlistContext';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';

/** 精选名单代码集合：全市场搜索时排除，精选优先 */
const CURATED_CODES = new Set(STOCK_LIST.map((s) => s.code));

/**
 * 自选区顶部搜索条：输代码/名称/拼音，匹配上自动切下面走势；
 * 右边 ＋ 一键加入自选。找不到去「自选列表」弹窗的发现股票里找。
 * 自动采用（600ms 停顿/回车/＋键）只认强匹配：精确代码、代码纠正、子串命中；
 * 错一字的模糊命中只出现在下拉候选里，必须手动点选，避免"bull变bill"式误切。
 */
export default function WatchlistSearch({
  symbol,
  onSelect,
}: {
  symbol: string;
  onSelect: (s: string, opts?: { scroll?: boolean }) => void;
}) {
  const { lang } = useLanguage();
  const { items: watchlist, addItem } = useWatchlist();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [imeComposing, setImeComposing] = useState(false);
  const lastSelected = useRef(symbol);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const inList = useMemo(() => new Set(watchlist.map((w) => w.symbol)), [watchlist]);

  // 外面点了 chips/信号牌等切标的：搜索框不是这次选择的来源就清空，避免文不对题
  useEffect(() => {
    if (symbol !== lastSelected.current) {
      lastSelected.current = symbol;
      setQ('');
      setOpen(false);
    }
  }, [symbol]);

  const pick = (s: string, scroll: boolean) => {
    const code = s.toUpperCase();
    lastSelected.current = code;
    setOpen(false);
    onSelect(code, { scroll });
  };

  // 精选名单候选（最多 6 个），附带命中强度：
  // 2=精确/子串命中（可自动采用），1=错一字模糊（只展示，需手动点选）
  const scored = useMemo(() => {
    const t = q.trim();
    if (!t) return [];
    // 按命中强度排序：精确/子串命中在前，错别字模糊命中在后
    return STOCK_LIST.map((st) => ({ st, score: matchStrength(st, t) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  }, [q]);
  const candidates = useMemo(() => scored.map((x) => x.st), [scored]);
  /** 强匹配的首个代码：回车/＋键只自动采用它，模糊匹配不自动切 */
  const strongFirst = useMemo(
    () => scored.find((x) => x.score >= 2)?.st.code ?? null,
    [scored],
  );

  // 精确匹配的代码（纠正打错如 TESLA->TSLA）
  const exactCode = useMemo(() => {
    const t = q.trim().toUpperCase();
    if (!t) return null;
    const fixed = CODE_CORRECTIONS[t] || t;
    return STOCK_LIST.some((s) => s.code === fixed) ? fixed : null;
  }, [q]);

  // 没有强匹配 → 懒加载全市场库兜底（弱匹配/无匹配时都补；
  // 之前是 candidates.length===0，有弱命中时全市场被短路，HPE 这类非精选股永远搜不出）
  const [universe, setUniverse] = useState<UniverseEntry[] | null>(null);
  useEffect(() => {
    if (q.trim() && !strongFirst && universe === null) {
      loadUniverse().then(setUniverse).catch(() => {});
    }
  }, [q, strongFirst, universe]);
  const uniCandidates = useMemo(
    () =>
      universe && q.trim() && !strongFirst
        ? searchUniverse(universe, q.trim(), CURATED_CODES, 5)
        : [],
    [universe, q, strongFirst],
  );
  // 宏观品种（原油/黄金/美元指数/美债收益率/VIX/比特币等）：Yahoo 期货数据
  const macroCandidates = useMemo(() => searchMacro(q).slice(0, 4), [q]);

  // 精确匹配上：停 600ms 自动切走势（组词中/输入法未完成不触发）
  useEffect(() => {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    if (!exactCode || imeComposing || exactCode === lastSelected.current) return;
    autoTimer.current = setTimeout(() => {
      pick(exactCode, false);
    }, 600);
    return () => {
      if (autoTimer.current) clearTimeout(autoTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exactCode, imeComposing]);

  const bestForAdd = exactCode ?? strongFirst ?? macroCandidates[0]?.code ?? uniCandidates[0]?.code ?? null;
  const bestInList = bestForAdd ? inList.has(bestForAdd) : false;

  const handleAdd = () => {
    if (!bestForAdd || bestInList) return;
    const curated = STOCK_LIST.find((s) => s.code === bestForAdd);
    const macro = macroCandidates.find((m) => m.code === bestForAdd);
    const uni = uniCandidates.find((u) => u.code === bestForAdd);
    const name = curated
      ? displayStockName(curated.code, lang, curated.zh)
      : macro
        ? lang === 'en' ? macro.en : macro.zh
        : uni?.en;
    addItem(bestForAdd, name);
  };

  const showDrop = open && q.trim().length > 0;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            value={q}
            onCompositionStart={() => setImeComposing(true)}
            onCompositionEnd={(e) => {
              setImeComposing(false);
              setQ(e.currentTarget.value);
              setOpen(true);
            }}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const first = exactCode ?? strongFirst ?? macroCandidates[0]?.code ?? uniCandidates[0]?.code;
                if (first) pick(first, true);
              }
            }}
            placeholder={tx(lang, 'Search ticker / name / pinyin, e.g. NVDA', '搜代码 / 名称 / 拼音，如 NVDA、英伟达')}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-9 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30"
          />
          {q && (
            <button
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setQ('');
                setOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
              aria-label={tx(lang, 'Clear', '清空')}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={!bestForAdd || bestInList}
          title={bestForAdd ? tx(lang, `Add ${bestForAdd} to watchlist`, `把 ${bestForAdd} 加入自选`) : tx(lang, 'Type a ticker first', '先输入代码')}
          className={`shrink-0 w-12 rounded-xl flex items-center justify-center text-lg font-bold transition active:scale-95 ${
            bestForAdd && !bestInList
              ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
              : 'bg-slate-800 text-slate-600'
          }`}
          aria-label={tx(lang, 'Add to watchlist', '加入自选')}
        >
          {bestInList ? <Check className="w-5 h-5 text-emerald-500" /> : <Plus className="w-5 h-5" />}
        </button>
      </div>

      {/* 候选下拉 */}
      {showDrop && (candidates.length > 0 || uniCandidates.length > 0 || macroCandidates.length > 0) && (
        <div className="absolute left-0 right-14 top-full mt-1.5 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          {candidates.map((c) => (
            <CandidateRow
              key={c.code}
              code={c.code}
              name={displayStockName(c.code, lang, c.zh)}
              inList={inList.has(c.code)}
              active={c.code === symbol}
              onPick={() => pick(c.code, true)}
              onAdd={() => {
                addItem(c.code, displayStockName(c.code, lang, c.zh));
              }}
            />
          ))}
          {macroCandidates.map((m) => (
            <CandidateRow
              key={m.code}
              code={m.code}
              name={lang === 'en' ? m.en : m.zh}
              inList={inList.has(m.code)}
              active={m.code === symbol}
              badge={tx(lang, 'Macro', '宏观')}
              onPick={() => pick(m.code, true)}
              onAdd={() => {
                addItem(m.code, lang === 'en' ? m.en : m.zh);
              }}
            />
          ))}
          {uniCandidates.map((u) => (
            <CandidateRow
              key={u.code}
              code={u.code}
              name={u.en.replace(/\s+(Class\s+[A-Z]\s+)?Common\s+Stock$/i, '').trim()}
              inList={inList.has(u.code)}
              active={u.code === symbol}
              badge={tx(lang, 'All markets', '全市场')}
              onPick={() => pick(u.code, true)}
              onAdd={() => {
                addItem(u.code, u.en);
              }}
            />
          ))}
        </div>
      )}
      {showDrop && candidates.length === 0 && uniCandidates.length === 0 && macroCandidates.length === 0 && universe !== null && (
        <div className="absolute left-0 right-14 top-full mt-1.5 z-40 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl px-3.5 py-3 text-xs text-slate-500">
          {tx(lang, 'No match — try the Discover tab in the watchlist panel.', '没找到，点「自选列表」标题进去，用发现股票按板块找找。')}
        </div>
      )}
    </div>
  );
}

function CandidateRow({
  code,
  name,
  inList,
  active,
  badge,
  onPick,
  onAdd,
}: {
  code: string;
  name: string;
  inList: boolean;
  active: boolean;
  badge?: string;
  onPick: () => void;
  onAdd: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3.5 py-2.5 hover:bg-slate-800 ${active ? 'bg-slate-800/60' : ''}`}
    >
      <button onMouseDown={(e) => e.preventDefault()} onClick={onPick} className="flex-1 min-w-0 text-left">
        <span className="text-sm font-bold text-slate-100">{code}</span>
        {badge && (
          <span className="ml-1.5 text-[9px] px-1 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 align-middle">
            {badge}
          </span>
        )}
        <div className="text-[11px] text-slate-500 truncate">{name}</div>
      </button>
      {inList ? (
        <span className="text-emerald-500 shrink-0" title="已在自选">
          <Check className="w-4 h-4" />
        </span>
      ) : (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={onAdd}
          className="shrink-0 w-7 h-7 rounded-full bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center active:scale-90"
          aria-label={`加入自选 ${code}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
