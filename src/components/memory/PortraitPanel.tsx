// src/components/memory/PortraitPanel.tsx
// 我的投资画像：卖飞率 + 买高率 + 提炼层（指纹/盈亏归因/耐心/追涨杀跌），只给自己看，数据只在手机本地。
'use client';

import React, { useMemo } from 'react';
import { computePortrait, portraitSummary, PORTRAIT_MIN_SAMPLE, type PortraitSide } from '@/lib/portrait';
import { computePortrait2, fingerprintAxes, type Portrait2 } from '@/lib/portrait2';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';
import type { OperationRecord } from '@/lib/operations';

interface Review { r5: number | null; r20: number | null; b3?: number | null }

function fmtDate(d: string, lang: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  if (lang === 'en') return `${parseInt(m[2], 10)}/${parseInt(m[3], 10)}`;
  return `${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
}

function fmtUSD(v: number): string {
  const sign = v < 0 ? '-$' : '+$';
  return sign + Math.abs(Math.round(v)).toLocaleString('en-US');
}

function fmtPct(v: number, digits = 1): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

function SideCard({
  title,
  emoji,
  side,
  badWord,
  worstWord,
  accent,
}: {
  title: string;
  emoji: string;
  side: PortraitSide;
  badWord: string;
  worstWord: string;
  accent: string;
}) {
  const { lang } = useLanguage();
  if (side.rate == null) {
    const need = Math.max(0, PORTRAIT_MIN_SAMPLE - side.total);
    return (
      <div className="bg-slate-800/60 rounded-lg p-3 text-center">
        <div className="text-xs text-slate-400 mb-1">
          {emoji} {title}
        </div>
        <div className="text-sm font-bold text-slate-500">{tx(lang, 'Growing…', '养成中')}</div>
        <div className="text-[10px] text-slate-500 mt-1">
          {tx(
            lang,
            side.total === 0
              ? `unlocks after ${PORTRAIT_MIN_SAMPLE} recorded trades`
              : `unlocks in ${need} more settled results`,
            side.total === 0 ? `记 ${PORTRAIT_MIN_SAMPLE} 笔后解锁` : `再有 ${need} 笔结果就解锁`
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-slate-800/60 rounded-lg p-3">
      <div className="text-xs text-slate-400 mb-1">
        {emoji} {title}
      </div>
      <div className={`text-2xl font-bold ${accent}`}>{Math.round(side.rate * 100)}%</div>
      <div className="text-[10px] text-slate-500 mt-0.5">
        {tx(lang, `${side.total} settled · ${side.bad} ${badWord}`, `${side.total} 笔有结果 · ${side.bad} 笔${badWord}`)}
      </div>
      {side.worst && (
        <div className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
          {tx(
            lang,
            `${worstWord}: ${fmtDate(side.worst.op.date, lang)} ${side.worst.op.action === 'sell' ? 'sold' : 'bought'} ${side.worst.op.symbol}, ${side.worst.pct > 0 ? '+' : ''}${side.worst.pct.toFixed(1)}%`,
            `${worstWord}：${fmtDate(side.worst.op.date, lang)} ${side.worst.op.action === 'sell' ? '卖出' : '买入'} ${side.worst.op.symbol}，${side.worst.pct > 0 ? '+' : ''}${side.worst.pct.toFixed(1)}%`
          )}
        </div>
      )}
    </div>
  );
}

/** 指纹六维雷达：形状就是这个人的交易指纹。数值口径见 portrait2.fingerprintAxes。 */
function Fingerprint({ p2, sellRate, buyRate }: { p2: Portrait2; sellRate: number | null; buyRate: number | null }) {
  const { lang } = useLanguage();
  const axes = fingerprintAxes(p2, sellRate, buyRate);
  const known = axes.filter((a) => a.value != null).length;
  if (known < 4) return null;
  const labels: Record<string, [string, string]> = {
    sellFly: ['Sell-early', '卖飞'],
    buyHigh: ['Buy-high', '买高'],
    patience: ['Patience', '耐心'],
    winRate: ['Win rate', '胜率'],
    concentration: ['Focus', '集中度'],
    chase: ['Chasing', '追涨'],
  };
  const cx = 140;
  const cy = 112;
  const R = 76;
  const pt = (i: number, v: number): [number, number] => {
    const ang = ((-90 + i * 60) * Math.PI) / 180;
    return [cx + R * (v / 100) * Math.cos(ang), cy + R * (v / 100) * Math.sin(ang)];
  };
  const ring = (f: number) =>
    axes.map((_, i) => pt(i, f * 100).join(',')).join(' ');
  const shape = axes.map((a, i) => pt(i, a.value ?? 0).join(',')).join(' ');
  const details: string[] = [];
  if (p2.medianHoldDays != null)
    details.push(tx(lang, `median hold ${p2.medianHoldDays}d`, `中位持有 ${p2.medianHoldDays} 天`));
  if (p2.concentration != null)
    details.push(tx(lang, `top 3 symbols = ${Math.round(p2.concentration * 100)}% of volume`, `成交额前三只占 ${Math.round(p2.concentration * 100)}%`));
  if (p2.winRate != null)
    details.push(tx(lang, `win rate ${Math.round(p2.winRate * 100)}% over ${p2.pairs.length} closed trades`, `${p2.pairs.length} 笔平仓胜率 ${Math.round(p2.winRate * 100)}%`));
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 mt-2">
      <div className="text-xs text-slate-400 mb-1">
        {tx(lang, '🧬 Your trading fingerprint', '🧬 交易指纹')}
      </div>
      <svg viewBox="0 0 280 224" className="w-full max-w-[320px] mx-auto block" role="img">
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon key={f} points={ring(f)} fill="none" stroke="#334155" strokeWidth="0.7" />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 100);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#334155" strokeWidth="0.7" />;
        })}
        <polygon points={shape} fill="rgba(56,189,248,0.20)" stroke="#38bdf8" strokeWidth="1.5" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, a.value ?? 0);
          return <circle key={a.id} cx={x} cy={y} r="2.6" fill="#38bdf8" />;
        })}
        {axes.map((a, i) => {
          const [lx, ly] = pt(i, 122);
          const anchor = lx < cx - 12 ? 'end' : lx > cx + 12 ? 'start' : 'middle';
          const [en, zh] = labels[a.id];
          return (
            <g key={a.id}>
              <text x={lx} y={ly} textAnchor={anchor} fontSize="10" fill="#cbd5e1">
                {tx(lang, en, zh)}
              </text>
              <text x={lx} y={ly + 11} textAnchor={anchor} fontSize="9" fill="#64748b">
                {a.value == null ? '…' : `${a.value}%`}
              </text>
            </g>
          );
        })}
      </svg>
      {details.length > 0 && (
        <div className="text-[10px] text-slate-500 text-center leading-relaxed">{details.join(' · ')}</div>
      )}
    </div>
  );
}

/** 盈亏归因：钱从哪几只赚的、哪几只亏的（FIFO 已实现）。 */
function Attribution({ p2 }: { p2: Portrait2 }) {
  const { lang } = useLanguage();
  if (p2.pairs.length === 0) return null;
  const rows = p2.bySymbol.slice(0, 10);
  const maxAbs = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 mt-2">
      <div className="flex items-baseline justify-between mb-2">
        <div className="text-xs text-slate-400">
          {tx(lang, '💰 Where the money came from (realized)', '💰 钱的来路（已实现盈亏）')}
        </div>
        <div className={`text-sm font-bold ${p2.totalRealized >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {fmtUSD(p2.totalRealized)}
        </div>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.symbol} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-300 w-14 shrink-0 font-medium">{r.symbol}</span>
            <div className="flex-1 h-3.5 bg-slate-700/40 rounded overflow-hidden">
              <div
                className={`h-full rounded ${r.pnl >= 0 ? 'bg-emerald-500/70' : 'bg-rose-500/70'}`}
                style={{ width: `${Math.max(3, (Math.abs(r.pnl) / maxAbs) * 100)}%` }}
              />
            </div>
            <span className={`text-[11px] w-[74px] text-right shrink-0 ${r.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {fmtUSD(r.pnl)}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-slate-500 mt-1.5">
        {tx(lang, `${p2.pairs.length} closed trades matched buy→sell (FIFO)`, `按先进先出配对 ${p2.pairs.length} 笔平仓`)}
      </div>
    </div>
  );
}

/** 耐心指纹：按持有期分组的胜率与平均收益。 */
function Patience({ p2 }: { p2: Portrait2 }) {
  const { lang } = useLanguage();
  if (p2.pairs.length === 0) return null;
  const names: Record<string, [string, string]> = {
    fast: ['Quick flips (<7d)', '快进快出（<7 天）'],
    mid: ['Swings (7–30d)', '波段（7–30 天）'],
    slow: ['Long holds (>30d)', '长拿（>30 天）'],
  };
  return (
    <div className="bg-slate-800/60 rounded-lg p-3 mt-2">
      <div className="text-xs text-slate-400 mb-2">{tx(lang, '⏳ Patience fingerprint — results by holding period', '⏳ 耐心指纹——按持有期看结果')}</div>
      <div className="space-y-1.5">
        {p2.patience.map((b) => {
          const [en, zh] = names[b.id];
          return (
            <div key={b.id} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-300 w-[118px] shrink-0">{tx(lang, en, zh)}</span>
              <div className="flex-1 h-3.5 bg-slate-700/40 rounded overflow-hidden">
                {b.winRate != null && (
                  <div className="h-full bg-sky-500/70 rounded" style={{ width: `${Math.round(b.winRate * 100)}%` }} />
                )}
              </div>
              <span className="text-[11px] text-slate-400 w-[118px] text-right shrink-0">
                {b.count === 0
                  ? tx(lang, 'no trades', '暂无')
                  : b.winRate == null
                    ? tx(lang, `${b.count} trades · growing`, `${b.count} 笔 · 养成中`)
                    : tx(lang, `${b.count} · win ${Math.round(b.winRate * 100)}% · avg ${b.avgPnlPct != null ? fmtPct(b.avgPnlPct) : '—'}`, `${b.count} 笔 · 胜率 ${Math.round(b.winRate * 100)}% · 平均 ${b.avgPnlPct != null ? fmtPct(b.avgPnlPct) : '—'}`)}
              </span>
            </div>
          );
        })}
      </div>
      {p2.bigTrade && p2.smallTrade && p2.bigTrade.winRate != null && p2.smallTrade.winRate != null && (
        <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
          {tx(
            lang,
            `Big bets (≥2× your usual size, ${p2.bigTrade.count} trades): win ${Math.round(p2.bigTrade.winRate * 100)}% · Regular size (${p2.smallTrade.count}): win ${Math.round(p2.smallTrade.winRate * 100)}%`,
            `重仓单（≥平时单笔 2 倍，${p2.bigTrade.count} 笔）胜率 ${Math.round(p2.bigTrade.winRate * 100)}%；常规单（${p2.smallTrade.count} 笔）胜率 ${Math.round(p2.smallTrade.winRate * 100)}%`,
          )}
        </div>
      )}
    </div>
  );
}

/** 追涨 / 杀跌痕迹：操作日前 3 个交易日的大涨大跌，与这类操作的事后结果。 */
function ChasePanic({ p2 }: { p2: Portrait2 }) {
  const { lang } = useLanguage();
  const cell = (
    title: string,
    stat: Portrait2['chase'],
    hitWord: [string, string],
  ) => {
    if (stat.share == null) return null;
    return (
      <div className="bg-slate-800/60 rounded-lg p-3 flex-1">
        <div className="text-xs text-slate-400 mb-1">{title}</div>
        <div className="text-2xl font-bold text-slate-100">{Math.round(stat.share * 100)}%</div>
        <div className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
          {tx(lang, `${stat.hit} of ${stat.total} ${hitWord[0]}`, `${stat.total} 笔里 ${stat.hit} 笔${hitWord[1]}`)}
          {stat.avgFwd != null &&
            tx(lang, ` · those moved ${fmtPct(stat.avgFwd)} in the next 20d on avg`, ` · 这类操作 20 天后平均 ${fmtPct(stat.avgFwd)}`)}
        </div>
      </div>
    );
  };
  const chase = cell(tx(lang, '🔥 Chasing heat', '🔥 追涨痕迹'), p2.chase, ['buys came right after a ≥5% 3-day run-up', '是在买入前 3 天已涨 ≥5% 时买的']);
  const panic = cell(tx(lang, '🧊 Panic-selling trace', '🧊 杀跌痕迹'), p2.panic, ['sells came right after a ≥5% 3-day drop', '是在卖出前 3 天已跌 ≥5% 时卖的']);
  if (!chase && !panic) return null;
  return (
    <div className="flex gap-2 mt-2">
      {chase}
      {panic}
    </div>
  );
}

export default function PortraitPanel({
  ops,
  reviews,
}: {
  ops: OperationRecord[];
  reviews: Record<string, Review>;
}) {
  const { lang } = useLanguage();
  const p = computePortrait(ops, reviews);
  const p2 = useMemo(() => computePortrait2(ops, reviews), [ops, reviews]);
  const summary = portraitSummary(p, lang);
  const anyData = p.sell.total > 0 || p.buy.total > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
          {tx(lang, '🪞 My investing portrait', '🪞 我的投资画像')}
        </div>
        <span className="text-[10px] text-slate-500">{tx(lang, 'Stays on your phone, never uploaded', '只在你手机里，不上传')}</span>
      </div>

      {!anyData ? (
        <div className="text-xs text-slate-400 leading-relaxed">
          {tx(lang, 'Log a few more trades and your portrait will grow: do you always sell too early, always buy too high? The data decides.', '多记几笔买卖，画像会自动长出来：你是不是总卖早、是不是总买高，数据说了算。')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SideCard
              title={tx(lang, 'Sell-too-early rate', '卖飞率')}
              emoji="🕊️"
              side={p.sell}
              badWord={tx(lang, 'sold too early', '卖飞')}
              worstWord={tx(lang, 'biggest miss', '最可惜')}
              accent="text-amber-400"
            />
            <SideCard
              title={tx(lang, 'Bought-too-high rate', '买高率')}
              emoji="🏔️"
              side={p.buy}
              badWord={tx(lang, 'bought too high', '买高')}
              worstWord={tx(lang, 'most painful one', '最惨')}
              accent="text-rose-400"
            />
          </div>
          {summary && (
            <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">{summary}</div>
          )}
          <Fingerprint p2={p2} sellRate={p.sell.rate} buyRate={p.buy.rate} />
          <Attribution p2={p2} />
          <Patience p2={p2} />
          <ChasePanic p2={p2} />
          <div className="text-[10px] text-slate-600 mt-1.5">
            {tx(lang, 'Method: price move 20 days after each sell/buy (5 days when fewer than 20 have passed); realized P&L matched FIFO; chasing/panic use the 3 trading days before each trade. Facts only — no judgment on you.', '口径：卖出/买入后 20 天（不足 20 天用 5 天）涨跌；已实现盈亏按先进先出配对；追涨/杀跌看操作日前 3 个交易日涨跌。只陈述事实，不下人格判断。')}
          </div>
        </>
      )}
    </div>
  );
}
