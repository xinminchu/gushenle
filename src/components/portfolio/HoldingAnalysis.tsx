// src/components/portfolio/HoldingAnalysis.tsx
// 持仓深入分析：点持仓行展开，真金白银值得更全面的解读。
//  - 律动深读：分数 + 状态 + 近10天迷你折线 + 三因子 + 一句话建议
//  - 仓位与盈亏：市值 / 占总资金比 / 板块 / 持有天数 / 浮动盈亏
//  - 持仓历史：从操作记忆里筛出这只的所有买卖记录（时间倒序）

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { tx } from '@/lib/hant';
import { getRhythm } from '@/lib/market';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchPosts, splitSymbols, relativeTime, type FamilyPost } from '@/lib/family';
import {
  statusLabel,
  scoreAt,
  volatilityAt,
  thresholdsFor,
  judgeFromScore,
  type RhythmResponse,
} from '@/lib/rhythm';
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
  const { user } = useAuth();
  const [closes, setCloses] = useState<number[] | null>(null);
  // 资讯足迹：我在朋友圈发过的关于这只的帖子（只看自己的）
  const [myPosts, setMyPosts] = useState<FamilyPost[]>([]);
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setMyPosts([]);
      return;
    }
    let cancelled = false;
    const sym = position.symbol.toUpperCase();
    fetchPosts(user.id)
      .then((all) => {
        if (!cancelled)
          setMyPosts(all.filter((p) => p.user_id === user.id && splitSymbols(p.symbol).includes(sym)).slice(0, 3));
      })
      .catch(() => {
        if (!cancelled) setMyPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user, position.symbol]);

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

  // 你的行为画像：这只股票的操作统计（来自操作记忆）
  // 买入均价：有持仓时以持仓成本为准（用户可能手动修正过成本，持仓是最新真相）；
  // 无持仓（已清仓）时回退到操作记录的均价。
  const portrait = useMemo(() => {
    const buys = history.filter((o) => o.action === 'buy');
    const sells = history.filter((o) => o.action === 'sell');
    const buyPrices = buys.map((o) => o.price).filter((p) => p > 0);
    const opsAvg = buyPrices.length > 0 ? buyPrices.reduce((a, b) => a + b, 0) / buyPrices.length : null;
    const avgBuy = position.avgCost > 0 ? position.avgCost : opsAvg;
    const emotions: string[] = [];
    for (const o of history) {
      const e = (o.emotion || '').trim();
      if (e && !emotions.includes(e) && emotions.length < 3) emotions.push(e);
    }
    const latestAdvice = history.find((o) => o.adviceSnapshot)?.adviceSnapshot ?? null;
    return { buys: buys.length, sells: sells.length, avgBuy, emotions, latestAdvice };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history, position.avgCost]);

  // 律动足迹：近 30 天每天的状态分布（客户端无未来函数回算，口径与诊断一致）
  const trail = useMemo(() => {
    if (!closes || closes.length < 32) return null;
    const buckets = [
      { key: 'high', label: tx(lang, 'Near highs', '高位'), n: 0, cls: 'bg-amber-400/70' },
      { key: 'accel', label: tx(lang, 'Accelerating', '加速'), n: 0, cls: 'bg-emerald-400/70' },
      { key: 'flat', label: tx(lang, 'Sideways', '震荡'), n: 0, cls: 'bg-slate-500/70' },
      { key: 'weak', label: tx(lang, 'Weak', '弱势'), n: 0, cls: 'bg-sky-400/70' },
    ];
    const start = Math.max(32, closes.length - 30);
    let total = 0;
    for (let i = start; i < closes.length; i++) {
      const s = scoreAt(closes, i);
      if (!s) continue;
      const th = thresholdsFor(volatilityAt(closes, i), 'zh');
      const { statusKey } = judgeFromScore(s.score, s.trend, s.vel, th, 'zh');
      total++;
      if (statusKey === 'overheated' || statusKey === 'hotStrong') buckets[0].n++;
      else if (statusKey === 'risingAccel') buckets[1].n++;
      else if (statusKey === 'sideways') buckets[2].n++;
      else buckets[3].n++;
    }
    return total > 0 ? { buckets, total } : null;
  }, [closes, lang]);

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

      {/* 你的行为画像：这只股票的操作统计 */}
      <div className="bg-slate-800/40 rounded-lg p-3">
        <div className="text-[11px] text-slate-500 mb-2">{tx(lang, 'Your behavior profile', '你的行为画像')}</div>
        {history.length > 0 ? (
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">{tx(lang, 'Trades', '操作')}</span>
              <span className="text-slate-200">
                {tx(lang, `${portrait.buys} buys · ${portrait.sells} sells`, `买入 ${portrait.buys} 次 · 卖出 ${portrait.sells} 次`)}
              </span>
            </div>
            {portrait.avgBuy != null && (
              <div className="flex justify-between">
                <span className="text-slate-500">{tx(lang, 'Avg buy price', '买入均价')}</span>
                <span className="text-slate-200 font-semibold">{fmtMoney(position.symbol, portrait.avgBuy)}</span>
              </div>
            )}
            {portrait.emotions.length > 0 && (
              <div className="flex justify-between items-start gap-2">
                <span className="text-slate-500 shrink-0">{tx(lang, 'Moods', '当时情绪')}</span>
                <span className="flex flex-wrap gap-1 justify-end">
                  {portrait.emotions.map((e) => (
                    <span key={e} className="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300/90 text-[10px]">
                      {e}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {portrait.latestAdvice && (
              <div className="text-[10px] text-slate-500 leading-relaxed pt-0.5">
                {tx(lang, 'Advice back then: ', '当时建议：')}{portrait.latestAdvice}
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-slate-600">
            {tx(lang, 'No trades logged for this stock yet — your profile builds as you log.', '这只还没有操作记录，记一笔后画像就有了。')}
          </p>
        )}
      </div>

      {/* 资讯足迹：我在朋友圈发过的关于这只的帖子 */}
      {myPosts.length > 0 && (
        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">{tx(lang, 'Your community trail', '资讯足迹')}</div>
          <div className="space-y-2">
            {myPosts.map((p) => (
              <div key={p.id} className="text-[11px] leading-relaxed">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <span>{p.post_type === 'thesis' ? '💡' : p.post_type === 'sell' ? '📤' : '⚠️'}</span>
                  <span>{p.post_type === 'thesis' ? tx(lang, 'Buy logic', '买入逻辑') : p.post_type === 'sell' ? tx(lang, 'Sell logic', '卖出逻辑') : tx(lang, 'Lesson', '避坑经验')}</span>
                  <span>·</span>
                  <span>{relativeTime(p.created_at, lang)}</span>
                </div>
                <p className="text-slate-400 mt-0.5">
                  {p.content.length > 80 ? `${p.content.slice(0, 80)}…` : p.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 律动足迹：近 30 天状态分布 */}
      {trail && (
        <div className="bg-slate-800/40 rounded-lg p-3">
          <div className="text-[11px] text-slate-500 mb-2">
            {tx(lang, `Rhythm trail (last ${trail.total} days)`, `律动足迹（近 ${trail.total} 天）`)}
          </div>
          <div className="flex h-2 rounded-full overflow-hidden bg-slate-700/40">
            {trail.buckets.map((b) =>
              b.n > 0 ? (
                <div key={b.key} className={b.cls} style={{ width: `${(b.n / trail.total) * 100}%` }} />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[10px] text-slate-500">
            {trail.buckets.map((b) => (
              <span key={b.key}>
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${b.cls}`} />
                {b.label} {b.n}{tx(lang, 'd', '天')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 持仓历史：这只的操作记忆 */}
      <div className="bg-slate-800/40 rounded-lg p-3">
        <div className="text-[11px] text-slate-500 mb-2">{tx(lang, 'Holding history', '持仓历史')}</div>
        {history.length > 0 ? (
          <div className="space-y-1.5">
            {history.map((o) => (
              <div key={o.id} className="text-[11px] space-y-1 py-1 border-b border-slate-800/50 last:border-0">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">
                    {o.date}
                    {o.source === 'community' && (
                      <span className="ml-1.5 px-1 py-px rounded bg-violet-500/15 text-violet-300/80 text-[9px]">
                        {tx(lang, 'from post', '来自分享')}
                      </span>
                    )}
                  </span>
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
                {(o.thesis || o.emotion) && (
                  <div className="text-[10px] text-slate-500 leading-relaxed">
                    {o.emotion && (
                      <span className="mr-1.5 px-1.5 py-px rounded bg-violet-500/15 text-violet-300/90">
                        {o.emotion}
                      </span>
                    )}
                    {o.thesis}
                  </div>
                )}
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
