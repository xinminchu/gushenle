'use client';

import React, { useState, useMemo } from 'react';
import { X, Plus, RotateCcw } from 'lucide-react';
import { useWatchlist } from '../WatchlistContext';
import DiscoverStocks from '../DiscoverStocks';
import { useLanguage } from '@/context/LanguageContext';
import { STOCK_NAMES } from '@/lib/stockAliases';
import {
  CODE_CORRECTIONS,
  STOCK_LIST,
  findStock,
  suggestStocks,
  displayStockName,
  type StockInfo,
} from '@/lib/stockList';
import { loadUniverse, findInUniverse, type UniverseEntry } from '@/lib/universe';
import { tx } from '@/lib/hant';

/**
 * 自选列表弹窗：点今日页「自选列表」标题进入。
 * 全部感兴趣的股票都在这里：点一行直接看走势，× 删除，
 * 下面手动添加 + 发现股票（按板块/主题）。
 */
export default function WatchlistModal({
  onClose,
  onViewSymbol,
}: {
  onClose: () => void;
  onViewSymbol: (s: string) => void;
}) {
  const { lang } = useLanguage();
  const { items: watchlist, isDefault, addItem, removeItem, resetToDefault } = useWatchlist();

  const [confirmingReset, setConfirmingReset] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  // 中文输入法组词中：此时不做大写转换，不写回输入框，避免拼音串被截断提交
  const [imeComposing, setImeComposing] = useState(false);
  /** 名称是否被用户手动改过：没改过才跟随代码自动更新 */
  const [nameEdited, setNameEdited] = useState(false);
  /** 未知代码时的联想建议 */
  const [suggestions, setSuggestions] = useState<StockInfo[]>([]);
  /** 全市场库命中的条目（精选名单里没有，但真实存在） */
  const [universeHit, setUniverseHit] = useState<UniverseEntry | null>(null);
  const [universeSearching, setUniverseSearching] = useState(false);
  /** 名单里没有也坚持添加（二次确认后） */
  const [forceAdd, setForceAdd] = useState(false);
  /** 成功提示（如自动纠正），绿色显示 */
  const [addNote, setAddNote] = useState('');

  const curatedCodes = useMemo(() => new Set(STOCK_LIST.map((s) => s.code)), []);

  const resetAddTips = () => {
    setAddError('');
    setSuggestions([]);
    setUniverseHit(null);
    setForceAdd(false);
    setAddNote('');
  };

  const handleAdd = async (force = false) => {
    const raw = newSymbol.trim().toUpperCase();
    if (!raw) {
      setAddError(tx(lang, 'Enter a code first, e.g. AAPL', '先输入代码，例如 AAPL'));
      return;
    }
    // 常见输错自动纠正：TESLA->TSLA / APPLE->AAPL / INTEL->INTC
    const sym = CODE_CORRECTIONS[raw] || raw;
    const known = findStock(sym);
    if (!known && !(forceAdd || force)) {
      const inputRaw = newSymbol.trim();
      // 先走本地联想：中文名/拼音/英文名都认，代码框里输中文也能找到
      const sug = suggestStocks(inputRaw);
      if (sug.length > 0) {
        setUniverseHit(null);
        setSuggestions(sug);
        setAddError(tx(lang, `${sug.length} related — tap one to fill`, `找到 ${sug.length} 个相关的，点一个填入`));
        return;
      }
      if (/[\u4e00-\u9fff]/.test(inputRaw)) {
        // 中文但精选名单没有：全市场库只有英文名，搜了也白搜
        setUniverseHit(null);
        setSuggestions([]);
        setAddError(tx(lang, `No match for “${inputRaw}” — try another name, or add anyway`, `没找到「${inputRaw}」，换个名字或拼音试试，也可坚持添加`));
        return;
      }
      // 精选名单没有 → 去全市场库（约 7000 只）找，第一次搜才加载
      setUniverseSearching(true);
      const all = await loadUniverse();
      setUniverseSearching(false);
      const hit = findInUniverse(all, sym, curatedCodes);
      if (hit) {
        setUniverseHit(hit);
        setAddError('');
        setSuggestions([]);
        return;
      }
      setSuggestions([]);
      setAddError(tx(lang, `Not found market-wide either — check spelling, or add anyway`, `全市场也没找到 ${sym}，检查下拼写，或坚持添加`));
      return;
    }
    const r = addItem(sym, newName || known?.zh);
    if (r === 'ok') {
      setNewSymbol('');
      setNewName('');
      setNameEdited(false);
      setSuggestions([]);
      setUniverseHit(null);
      setForceAdd(false);
      setAddNote(CODE_CORRECTIONS[raw] ? (tx(lang, `Auto-corrected to ${sym}`, `已自动纠正为 ${sym}`)) : '');
      setAddError('');
    } else if (r === 'exists') {
      setAddError(tx(lang, 'Already in watchlist', '这只已在自选里'));
    } else {
      setAddError(tx(lang, 'Invalid code format, e.g. AAPL or 000660.KS', '代码格式不对，例如 AAPL 或 000660.KS'));
    }
  };

  /** 全市场命中的条目一键添加：用英文名做备注名 */
  const handleAddUniverseHit = () => {
    if (!universeHit) return;
    const r = addItem(universeHit.code, universeHit.en);
    if (r === 'ok') {
      setNewSymbol('');
      setNewName('');
      setNameEdited(false);
      setSuggestions([]);
      setUniverseHit(null);
      setForceAdd(false);
      setAddNote('');
      setAddError('');
    } else if (r === 'exists') {
      setAddError(tx(lang, 'Already in watchlist', '这只已在自选里'));
    } else {
      setAddError(tx(lang, 'Invalid code format, e.g. AAPL or 000660.KS', '代码格式不对，例如 AAPL 或 000660.KS'));
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-100 text-base">{tx(lang, 'Watchlist', '自选列表')}</h3>
            {isDefault && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {tx(lang, 'Default picks', '默认推荐')}
              </span>
            )}
            <span className="text-[10px] text-slate-600">{tx(lang, 'Tap a row to view', '点一行直接看走势')}</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-3">
          {/* 全部列表：一行两个，点行直接看走势 */}
          <div className="grid grid-cols-2 gap-1.5">
            {watchlist.map((item) => (
              <div
                key={item.symbol}
                onClick={() => {
                  onClose();
                  onViewSymbol(item.symbol);
                }}
                className="flex items-center justify-between bg-slate-800/60 rounded-lg pl-2.5 pr-1 py-1.5 min-w-0 cursor-pointer hover:bg-slate-800"
              >
                <div className="min-w-0 truncate">
                  <span className="text-xs font-semibold text-slate-100">{item.symbol}</span>
                  <span className="ml-1.5 text-[10px] text-slate-400">{displayStockName(item.symbol, lang, item.name)}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeItem(item.symbol);
                  }}
                  disabled={watchlist.length <= 1}
                  className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1 shrink-0"
                  aria-label={tx(lang, `Remove ${item.symbol}`, `删除 ${item.symbol}`)}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* 手动添加 */}
          <div className="flex gap-2">
            <input
              value={newSymbol}
              onCompositionStart={() => setImeComposing(true)}
              onCompositionEnd={(e) => {
                setImeComposing(false);
                const sym = e.currentTarget.value.toUpperCase();
                setNewSymbol(sym);
                resetAddTips();
                // 名称没被手动改过就跟随代码自动更新
                if (!nameEdited) setNewName(displayStockName(sym, lang, STOCK_NAMES[sym] || ''));
              }}
              onChange={(e) => {
                const rawVal = e.target.value;
                // 组词过程中不碰输入内容，组词结束才转大写
                const sym = imeComposing ? rawVal : rawVal.toUpperCase();
                setNewSymbol(sym);
                resetAddTips();
                // 名称没被手动改过就跟随代码自动更新
                if (!nameEdited) setNewName(displayStockName(sym.toUpperCase(), lang, STOCK_NAMES[sym.toUpperCase()] || ''));
              }}
              placeholder={tx(lang, 'Code, e.g. COIN', '代码 如 COIN')}
              className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                setNameEdited(true);
              }}
              placeholder={tx(lang, 'Name (optional)', '名称（选填）')}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={() => handleAdd()}
              className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> {tx(lang, 'Add', '添加')}
            </button>
          </div>
          {addError && <div className="text-[11px] text-rose-400">{addError}</div>}
          {addNote && <div className="text-[11px] text-emerald-400">{addNote}</div>}
          {universeSearching && (
            <div className="text-[11px] text-slate-500">{tx(lang, 'Searching all markets…', '正在全市场查找…')}</div>
          )}
          {universeHit && (
            <div className="flex items-center gap-2 bg-slate-800/70 border border-slate-700 rounded-lg px-2.5 py-2">
              <div className="min-w-0 flex-1">
                <span className="text-[11px] text-slate-400">{tx(lang, 'Found market-wide ', '全市场找到 ')}</span>
                <span className="text-[11px] font-semibold text-slate-100">
                  {universeHit.code}
                </span>
                <div className="text-[10px] text-slate-500 truncate">{universeHit.en}</div>
              </div>
              <button
                onClick={handleAddUniverseHit}
                className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-2.5 py-1.5 text-[11px] font-medium"
              >
                {tx(lang, 'Add directly', '直接添加')}
              </button>
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button
                  key={s.code}
                  onClick={() => {
                    setNewSymbol(s.code);
                    setNewName(displayStockName(s.code, lang, s.zh));
                    setNameEdited(false);
                    setSuggestions([]);
                    setAddError('');
                  }}
                  className="text-[11px] bg-slate-800 border border-slate-600 rounded-full px-2.5 py-1 text-slate-200 hover:border-blue-500"
                >
                  {s.code} {displayStockName(s.code, lang, s.zh)}
                </button>
              ))}
              <button
                onClick={() => {
                  setSuggestions([]);
                  setAddError('');
                  handleAdd(true);
                }}
                className="text-[11px] text-slate-500 underline underline-offset-2 hover:text-slate-300 px-1 py-1"
              >
                {tx(lang, 'Add anyway', '仍要添加')}
              </button>
            </div>
          )}
          {!isDefault && !confirmingReset && (
            <button
              onClick={() => setConfirmingReset(true)}
              className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> {tx(lang, 'Restore defaults', '恢复默认推荐')}
            </button>
          )}
          {!isDefault && confirmingReset && (
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-amber-400">{tx(lang, 'This will clear your custom watchlist. Sure?', '将清空你的自定义自选，确定吗？')}</span>
              <button
                onClick={() => {
                  resetToDefault();
                  setConfirmingReset(false);
                }}
                className="text-red-400 underline underline-offset-2"
              >
                {tx(lang, 'Confirm', '确认恢复')}
              </button>
              <button
                onClick={() => setConfirmingReset(false)}
                className="text-slate-400 underline underline-offset-2"
              >
                {tx(lang, 'Cancel', '取消')}
              </button>
            </div>
          )}

          {/* 发现股票：按板块 / 主题筛选加入自选 */}
          <DiscoverStocks />
        </div>
      </div>
    </div>
  );
}
