'use client';

import { useEffect, useState } from 'react';
import { loadPositions } from '@/lib/positions';
import { getRhythm, dayChangePct } from '@/lib/market';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';
import DrawdownHistory from './DrawdownHistory';

/**
 * 大跌体检卡：只在 QQQ 单日跌超阈值时出现。
 * 组合今日回撤 vs QQQ + 按当日盈亏贡献排序，让用户一眼看清"亏多少、谁拖的"。
 * 只摆事实，不预测、不给操作建议。
 */

const TRIGGER_PCT = -1.5; // QQQ 日跌幅触发线（%）

interface Row {
  symbol: string;
  pct: number | null;
  pnl: number;
}

interface ShowState {
  kind: 'show';
  qqq: number;
  rows: Row[];
  portPct: number | null;
  totalPnl: number;
}

type State = { kind: 'loading' } | { kind: 'hidden' } | ShowState;

const fmtPct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const fmtMoney = (v: number) =>
  `${v < 0 ? '-' : ''}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;

export default function DrawdownCheckup() {
  const { lang } = useLanguage();
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const positions = loadPositions();
      if (!positions.length) {
        if (!cancelled) setState({ kind: 'hidden' });
        return;
      }
      // 先看大盘做门控：没大跌就不打扰
      let qqq: number | null = null;
      try {
        qqq = dayChangePct(await getRhythm('QQQ', '1m', { lang: 'zh' }));
      } catch {
        qqq = null;
      }
      if (qqq == null || qqq > TRIGGER_PCT) {
        if (!cancelled) setState({ kind: 'hidden' });
        return;
      }
      const rows: Row[] = await Promise.all(
        positions.map(async (p) => {
          try {
            const r = await getRhythm(p.symbol, '1m', { lang: 'zh' });
            const pct = dayChangePct(r);
            const price = r.price || r.prevClose || 0;
            const value = price * p.shares;
            const pnl = pct != null && price > 0 ? (value * pct) / (100 + pct) : 0;
            return { symbol: p.symbol, pct, pnl };
          } catch {
            return { symbol: p.symbol, pct: null, pnl: 0 };
          }
        }),
      );
      rows.sort((a, b) => a.pnl - b.pnl);
      const totalPnl = rows.reduce((s, r) => s + r.pnl, 0);
      // 组合当日涨跌幅：按昨收市值加权（prev 由 pnl 与 pct 反推）
      let prevTotal = 0;
      let curTotal = 0;
      for (const r of rows) {
        if (r.pct == null) continue;
        // pnl = cur - prev, pct = (cur-prev)/prev*100 → prev = pnl/(pct/100)
        const prev = r.pct !== 0 ? r.pnl / (r.pct / 100) : 0;
        prevTotal += prev;
        curTotal += prev + r.pnl;
      }
      const portPct = prevTotal !== 0 ? ((curTotal - prevTotal) / prevTotal) * 100 : null;
      if (!cancelled) setState({ kind: 'show', qqq, rows, portPct, totalPnl });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind !== 'show') return null;

  const diff = state.portPct != null ? state.portPct - state.qqq : null;
  const verdict =
    diff == null
      ? null
      : Math.abs(diff) <= 0.5
        ? tx(
            lang,
            'Moving with the market — this is systematic, not your stock-picking.',
            '和大盘一起跌——这是系统性下跌，不是你选股的问题。',
          )
        : diff < 0
          ? tx(
              lang,
              `Trailing QQQ by ${Math.abs(diff).toFixed(1)} pts, mainly dragged by ${state.rows[0]?.symbol ?? '—'}.`,
              `比 QQQ 多跌 ${Math.abs(diff).toFixed(1)} 个百分点，主要拖累：${state.rows[0]?.symbol ?? '—'}。`,
            )
          : tx(
              lang,
              `Outperforming QQQ by ${diff.toFixed(1)} pts today — more resilient than the market.`,
              `今天比 QQQ 抗跌 ${diff.toFixed(1)} 个百分点——比大盘扛得住。`,
            );

  return (
    <section className="rounded-2xl border border-slate-500/30 bg-slate-900/40 p-4">
      <h2 className="text-sm font-semibold text-slate-200">
        {tx(lang, '🩺 Drawdown checkup', '🩺 大跌体检')}
      </h2>

      <div className="mt-2.5 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] text-slate-400">
            {tx(lang, 'Portfolio today', '组合今日')}
          </p>
          <p className="text-2xl font-bold text-rose-400">
            {state.portPct != null ? fmtPct(state.portPct) : '—'}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            {tx(lang, 'approx.', '约')} {fmtMoney(state.totalPnl)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-slate-400">QQQ</p>
          <p className="text-lg font-semibold text-slate-200">{fmtPct(state.qqq)}</p>
        </div>
      </div>

      {verdict && (
        <p className="mt-2.5 rounded-xl border border-teal-500/25 bg-teal-950/20 px-3 py-2 text-[13px] leading-relaxed text-teal-200/90">
          {verdict}
        </p>
      )}

      <DrawdownHistory dropPct={state.qqq} />

      <ul className="mt-2.5 space-y-1.5">
        {state.rows.map((r) => (
          <li
            key={r.symbol}
            className="flex items-center justify-between text-[13px] rounded-lg bg-slate-800/40 px-2.5 py-1.5"
          >
            <span className="font-mono font-semibold text-slate-200">{r.symbol}</span>
            <span className="flex items-center gap-2.5">
              <span className={r.pct != null && r.pct < 0 ? 'text-rose-400' : 'text-slate-300'}>
                {r.pct != null ? fmtPct(r.pct) : '—'}
              </span>
              <span className="text-slate-400 tabular-nums">{fmtMoney(r.pnl)}</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-[11px] leading-relaxed text-slate-500">
        {tx(
          lang,
          'Numbers first, decisions later. Your plan is in the advisor section of each card.',
          '先看清数字，再做决定。每只卡片的参谋区里有你的计划。',
        )}
      </p>
    </section>
  );
}
