// src/components/portfolio/HoldingAnalysis.tsx
// 持仓深入分析：点持仓行展开，真金白银值得更全面的解读。
//  - 律动深读：分数 + 状态 + 近10天迷你折线 + 三因子 + 一句话建议
//  - 仓位与盈亏：市值 / 占总资金比 / 板块 / 持有天数 / 浮动盈亏
//  - 持仓历史：从操作记忆里筛出这只的所有买卖记录（时间倒序）

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import { getRhythm } from '@/lib/market';
import { statusLabel, type RhythmResponse } from '@/lib/rhythm';
import { holdingDays, sectorOf, type Position } from '@/lib/positions';
import { type AccountInfo } from '@/lib/account';
import { loadOperations, type OperationRecord } from '@/lib/operations';
import { sectorLabel } from '@/lib/stockList';
import { fmtMoney } from '@/lib/currency';
import { useColorScheme, upText, downText } from '@/lib/colorScheme';
import ScoreSparkline from '@/components/ScoreSparkline';

function actionLabel(a: 'buy' | 'sell', lang: Parameters<typeof tx>[0]): string {
  return a === 'buy' ? tx(lang, 'Buy', '买入') : tx(lang, 'Sell', '卖出');
}

export default function HoldingAnalysis({
  position,
  quote,
  account,
  pnl,
  pnlPct,
  price,
  advice,
  onGoMemory,
  onViewSymbol,
}: {
  position: Position;
  quote: RhythmResponse | null;
  account: AccountInfo | null;
  pnl: number | null;
  pnlPct: number | null;
  price: number | null;
  /** 持仓诊断一句话（PortfolioTab 的 positionAdvice，已结合盈亏） */
  advice: string | null;
  onGoMemory: (symbol: string) => void;
  onViewSymbol: (symbol: string) => void;
}) {
  const { lang } = useLanguage();
  const { scheme } = useColorScheme();
  const [closes, setCloses] = useState<number[] | null>(null);

  // 迷你折线要 3M 日线：行里的 quote 是 1M 的，展开时再拉（走市场共享缓存）
  useEffect(() => {
    let cancelled = false;
    getRhythm(position.symbol, '3M')
      .then((r) => {
        if (!cancelled) setCloses(r ? r.series.map((p) => p.close) : []);
      })
      .catch(() => {
        if (!cancelled) setCloses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [position.symbol]);

  const history = useMemo<OperationRecord[]>(() => {
    try {
      return loadOperations()
        .filter((o) => o.symbol.toUpperCase() === position.symbol.toUpperCase())
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    } catch {
      return [];
    }
  }, [position.symbol]);

  const marketValue = price != null ? position.shares * price : null;
  const weightPct =
    marketValue != null && account && account.capital > 0
      ? (marketValue / account.capital) * 100
      : null;
  const days = holdingDays(position.since);
  const j = quote?.judgment;

  return (
    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
      {/* 律动深读 */}
      {j && (
        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11px] text-slate-500">{tx(lang, 'Rhythm deep read', '律动深读')}</div>
              <div className="mt-0.5 text-sm">
                <span className="font-extrabold text-slate-100 text-lg">{j.score}</span>
                <span className="text-slate-400 text-xs"> {tx(lang, 'pts', '分')} · </span>
                <span className="text-slate-200 text-xs font-medium">
                  {j.statusKey ? statusLabel(j.statusKey, lang) : j.status}
                </span>
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {tx(lang, `Position ${j.pos} · Trend ${j.trend} · Speed ${j.vel}`, `位置 ${j.pos} · 趋势 ${j.trend} · 速度 ${j.vel}`)}
              </div>
            </div>
            {closes && closes.length > 0 && (
              <div className="shrink-0 pt-1" title={tx(lang, 'Score trend, last 10 days', '近10天分数走势')}>
                <ScoreSparkline closes={closes} hot={j.thresholds.hot} cold={j.thresholds.cold} />
              </div>
            )}
          </div>
          {advice && <div className="mt-2 text-[11px] text-amber-300/90">💡 {advice}</div>}
          <button
            onClick={() => onViewSymbol(position.symbol)}
            className="mt-2 text-[11px] text-blue-400/90 hover:text-blue-300 underline underline-offset-2"
          >
            {tx(lang, 'See full diagnosis in the Today tab →', '去今日页看完整诊断 →')}
          </button>
        </div>
      )}

      {/* 仓位与盈亏 */}
      <div className="bg-slate-800/40 rounded-lg p-3">
        <div className="text-[11px] text-slate-500 mb-2">{tx(lang, 'Position & P&L', '仓位与盈亏')}</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          <div className="flex justify-between">
            <span className="text-slate-500">{tx(lang, 'Market value', '市值')}</span>
            <span className="text-slate-200 font-semibold">
              {marketValue != null ? fmtMoney(position.symbol, marketValue) : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{tx(lang, 'Weight', '仓位占比')}</span>
            <span className="text-slate-200 font-semibold">
              {weightPct != null ? `${weightPct.toFixed(1)}%` : tx(lang, 'set capital first', '先设置总资金')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{tx(lang, 'Floating P&L', '浮动盈亏')}</span>
            <span className={`font-semibold ${pnl != null ? (pnl >= 0 ? upText(scheme) : downText(scheme)) : 'text-slate-500'}`}>
              {pnl != null && pnlPct != null
                ? `${pnl >= 0 ? '+' : ''}${fmtMoney(position.symbol, Math.abs(pnl))} (${pnl >= 0 ? '+' : ''}${pnlPct.toFixed(2)}%)`
                : '—'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{tx(lang, 'Held', '持有')}</span>
            <span className="text-slate-200">{days != null ? tx(lang, `${days} days`, `${days} 天`) : '—'}</span>
          </div>
          <div className="flex justify-between col-span-2">
            <span className="text-slate-500">{tx(lang, 'Sector', '板块')}</span>
            <span className="text-slate-300">{sectorLabel(sectorOf(position.symbol), lang)}</span>
          </div>
        </div>
      </div>

      {/* 持仓历史：这只的操作记忆 */}
      <div className="bg-slate-800/40 rounded-lg p-3">
        <div className="text-[11px] text-slate-500 mb-2">{tx(lang, 'Holding history', '持仓历史')}</div>
        {history.length > 0 ? (
          <div className="space-y-1.5">
            {history.map((o) => (
              <div key={o.id} className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{o.date}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    o.action === 'buy' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'
                  }`}
                >
                  {actionLabel(o.action, lang)}
                  {o.qty != null ? ` ${o.qty}${tx(lang, ' sh', '股')}` : ''}
                </span>
                <span className="text-slate-300">
                  {o.price > 0 ? `@ ${fmtMoney(position.symbol, o.price)}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-600">{tx(lang, 'No operation records for this stock yet.', '这只还没有操作记录。')}</p>
        )}
        <button
          onClick={() => onGoMemory(position.symbol)}
          className="mt-2 text-[11px] text-blue-400/90 hover:text-blue-300 underline underline-offset-2"
        >
          {tx(lang, 'Log an operation in Memory →', '去记忆页补记一笔 →')}
        </button>
      </div>
    </div>
  );
}
