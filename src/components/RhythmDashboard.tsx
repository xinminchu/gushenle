// src/components/RhythmDashboard.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Flame, ShieldAlert, Settings2, X, Plus, RotateCcw } from 'lucide-react';
import RhythmChart from './RhythmChart';
import type { RhythmResponse } from '@/lib/rhythm';
import { statusForScore, scoreGradient } from '@/lib/rhythm';
import { getRhythm, invalidateRhythm } from '@/lib/market';
import { useMarketAutoRefresh } from '@/hooks/useMarketAutoRefresh';
import { useWatchlist } from './WatchlistContext';

const RANGES = ['1W', '1M', '3M', '1Y'];
const RANGE_UNIT: Record<string, string> = { '1W': '周', '1M': '月', '3M': '季', '1Y': '年' };
const RANGE_LABEL: Record<string, string> = {
  '1W': '近 1 周',
  '1M': '近 1 月',
  '3M': '近 3 月',
  '1Y': '近 1 年',
};

export default function RhythmDashboard() {
  const {
    items: watchlist,
    isDefault,
    addItem,
    removeItem,
    resetToDefault,
    nameOf,
    focusSymbol,
    setFocusSymbol,
  } = useWatchlist();

  const [symbol, setSymbol] = useState('AAPL');
  const [range, setRange] = useState('1M');
  const [data, setData] = useState<RhythmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [showZenModal, setShowZenModal] = useState(false);
  const [managing, setManaging] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');

  // 从持仓页跳过来的标的
  useEffect(() => {
    if (focusSymbol) {
      setSymbol(focusSymbol);
      setFocusSymbol(null);
    }
  }, [focusSymbol, setFocusSymbol]);

  // 自选变化后，当前标的若被删则回到第一只
  useEffect(() => {
    if (watchlist.length > 0 && !watchlist.some((i) => i.symbol === symbol)) {
      setSymbol(watchlist[0].symbol);
    }
  }, [watchlist, symbol]);

  // 收盘后自动刷新：页面开着过夜，第二天自动拉取最新收盘价
  const autoTick = useMarketAutoRefresh(
    data && data.series.length > 0 ? data.series[data.series.length - 1].date : undefined,
  );
  const prevTick = useRef(autoTick);

  // 经全 app 共享缓存拉数据：今日 / 持仓同源，同一 symbol+range 只发一次请求
  useEffect(() => {
    let cancelled = false;
    if (autoTick !== prevTick.current) {
      invalidateRhythm(symbol);
      prevTick.current = autoTick;
    }
    setLoading(true);
    getRhythm(symbol, range)
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        console.error('获取律动数据失败:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range, autoTick]);

  const overHeat = !!data && data.rhythmPos >= 80;

  const handleAdd = () => {
    const r = addItem(newSymbol, newName);
    if (r === 'ok') {
      setNewSymbol('');
      setNewName('');
      setAddError('');
    } else if (r === 'exists') {
      setAddError('这只已在自选里');
    } else {
      setAddError('代码格式不对，例如 AAPL');
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* 标题 + 自选管理 + 标的选择 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 whitespace-nowrap">
            今日看板 · 谷峰律动
          </h1>
          <button
            onClick={() => setManaging((v) => !v)}
            className="text-xs text-slate-400 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-800"
          >
            <Settings2 className="w-3.5 h-3.5" />
            {managing ? '收起' : '管理自选'}
          </button>
        </div>

        {managing && (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-200">自选列表</span>
              {isDefault && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  默认推荐
                </span>
              )}
            </div>
            <div className="space-y-2">
              {watchlist.map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2"
                >
                  <div>
                    <span className="text-sm font-semibold text-slate-100">{item.symbol}</span>
                    <span className="ml-2 text-xs text-slate-400">{item.name}</span>
                  </div>
                  <button
                    onClick={() => removeItem(item.symbol)}
                    disabled={watchlist.length <= 1}
                    className="text-slate-500 hover:text-rose-400 disabled:opacity-30 p-1"
                    aria-label={`删除 ${item.symbol}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newSymbol}
                onChange={(e) => {
                  setNewSymbol(e.target.value.toUpperCase());
                  setAddError('');
                }}
                placeholder="代码 如 COIN"
                className="w-28 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="名称（选填）"
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleAdd}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> 添加
              </button>
            </div>
            {addError && <div className="text-[11px] text-rose-400">{addError}</div>}
            {!isDefault && (
              <button
                onClick={resetToDefault}
                className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> 恢复默认推荐
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {watchlist.map((item) => (
            <button
              key={item.symbol}
              onClick={() => setSymbol(item.symbol)}
              className={`py-2 rounded-xl text-sm transition-all ${
                symbol === item.symbol
                  ? 'bg-blue-600 text-white font-medium shadow-lg'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {item.symbol}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="h-44 animate-pulse bg-slate-900 border border-slate-800 rounded-xl" />
          <div className="h-72 animate-pulse bg-slate-900 border border-slate-800 rounded-xl" />
        </div>
      ) : data ? (
        <>
          {/* ① 律动诊断（先看到的核心信号） */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-base font-semibold mb-3 text-slate-200 flex items-center">
              律动诊断
              <span className="ml-2 text-[10px] font-normal px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                按{RANGE_LABEL[range] ?? range}计算
              </span>
            </h2>
            <div
              className={`p-4 bg-slate-800/50 rounded-xl border border-slate-700/50 ${
                overHeat ? 'cursor-pointer hover:border-amber-500/40' : ''
              }`}
              onClick={() => {
                if (overHeat) setShowZenModal(true);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-100 text-lg">{symbol}</span>
                  <span className="text-xs text-slate-400">{nameOf(symbol)}</span>
                  {overHeat && (
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> 过热
                    </span>
                  )}
                  {data.source === 'simulated' && (
                    <span className="text-[10px] text-slate-500">演示数据</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div
                    className={`text-4xl font-extrabold ${
                      overHeat ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {data.rhythmPos}
                  </div>
                  <div className="text-[10px] text-slate-400">{statusForScore(data.rhythmPos)}</div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-200 shrink-0">
                  ${data.price.toFixed(2)}
                </span>
                <span
                  className={`text-xs shrink-0 ${
                    data.changePct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {data.changePct >= 0 ? '+' : ''}
                  {data.changePct}%/{RANGE_UNIT[range] ?? range}
                </span>
                <div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${scoreGradient(
                      data.rhythmPos,
                    )} transition-all duration-700`}
                    style={{ width: `${data.rhythmPos}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 text-xs text-slate-400 leading-relaxed">
                {data.rhythmPos < 20 && '价格贴近区间谷底，情绪偏冷，适合回顾买入逻辑。'}
                {data.rhythmPos >= 20 &&
                  data.rhythmPos <= 80 &&
                  '价格在谷峰之间律动，按既定节奏持有即可。'}
                {data.rhythmPos > 80 && '价格逼近区间峰顶，情绪偏热，警惕追高冲动。'}
              </div>
              {overHeat && (
                <div className="mt-2 text-[10px] text-amber-400/70">点击卡片查看冷静清单</div>
              )}
            </div>
          </div>

          {/* ② 价格走势图 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-200">价格走势</h2>
              <div className="flex bg-slate-800 rounded-lg p-1 text-xs">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      range === r ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            <RhythmChart series={data.series} height={240} />

            {/* 谷峰位置条：当前价在波谷-波峰区间中的位置 */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                <span>
                  谷底 <strong className="text-emerald-400">${data.valley.price}</strong>
                  <span className="text-slate-500"> {data.valley.date}</span>
                </span>
                <span>
                  峰顶 <strong className="text-rose-400">${data.peak.price}</strong>
                  <span className="text-slate-500"> {data.peak.date}</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-gradient-to-r from-emerald-500 via-sky-500 to-rose-500">
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-slate-900 shadow"
                  style={{ left: `calc(${Math.min(100, Math.max(0, data.rhythmPos))}% - 8px)` }}
                />
              </div>
              <div className="mt-1.5 text-right text-[10px] text-slate-600">
                更新数据点: {data.series.length} 天 · 数据更新于{' '}
                {new Date(data.updatedAt).toLocaleTimeString('zh-CN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="h-64 flex items-center justify-center bg-slate-900 border border-slate-800 rounded-xl text-slate-400">
          数据加载失败，请稍后重试
        </div>
      )}

      {/* 沉思乐：过热时点击诊断卡弹出的冷静拦截 */}
      {showZenModal && data && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">过热风险提示</h3>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-amber-400">{symbol}</span>{' '}
              律动得分达到 <span className="font-bold">{data.rhythmPos}</span>
              ，市场情绪处于高位。
            </p>
            <div className="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-400 text-left space-y-1">
              <p className="font-medium text-slate-300">反例检查清单：</p>
              <p>• 是否因为害怕错过（FOMO）而想追加仓位？</p>
              <p>• 是否符合最初设定的买入逻辑？</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowZenModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-xl text-xs font-medium"
              >
                深呼吸，保持冷静
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
