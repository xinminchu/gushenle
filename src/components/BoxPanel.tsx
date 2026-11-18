// src/components/BoxPanel.tsx
// 箱体律动面板：系统提议横盘箱、用户自定箱（本机存储），图上画边线，
// 面板给箱内位置 / 触边史 / 出箱史——全部是这只股自己的历史事实，不下买卖结论。
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  loadBoxes,
  saveBox,
  deleteBox,
  replaceBox,
  boxPosition,
  boxState,
  touchStats,
  touchPoints,
  boxAgeDays,
  type BoxDef,
  type SeriesPoint,
  type BreakoutHistory,
} from '@/lib/box';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

interface BoxApiData {
  points: SeriesPoint[];
  suggested: BoxDef[];
  history: BreakoutHistory;
}

function fmtP(v: number): string {
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
function fmtPct(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}
function fmtDateShort(d: string, lang: string): string {
  if (lang === 'en') return d.slice(2);
  return `${d.slice(2).replace('-', '年').replace('-', '月')}日`;
}


/** 箱体图：矩形就是箱子（形成段起、延伸到今天），价格线穿过它，触边点打在边上。 */
function BoxChart({ points, box }: { points: SeriesPoint[]; box: BoxDef }) {
  const W = 340;
  const H = 190;
  const PAD_R = 46;
  const PAD_B = 14;
  const startIdx = points.findIndex((p) => p.date >= box.startDate);
  if (startIdx < 0) return null;
  const from = Math.max(0, startIdx - 10);
  const slice = points.slice(from);
  if (slice.length < 5) return null;
  const closes = slice.map((p) => p.close);
  const lo = Math.min(box.bottom, ...closes);
  const hi = Math.max(box.top, ...closes);
  const padY = (hi - lo) * 0.06 || 1;
  const x = (gi: number) => ((gi - from) / (slice.length - 1)) * (W - PAD_R - 4) + 2;
  const y = (v: number) => H - PAD_B - 4 - ((v - (lo - padY)) / (hi - lo + 2 * padY)) * (H - PAD_B - 10);
  const line = slice.map((p, i) => `${x(from + i)},${y(p.close)}`).join(' ');
  const touches = touchPoints(points, box).filter((t) => t.index >= from);
  const lastClose = closes[closes.length - 1];
  const fmt = (v: number) => `$${v.toFixed(2)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full block mt-2">
      {/* 箱体矩形：形成段起始 → 今天 */}
      <rect
        x={x(startIdx)}
        y={y(box.top)}
        width={x(points.length - 1) - x(startIdx)}
        height={Math.max(2, y(box.bottom) - y(box.top))}
        fill="rgba(245, 158, 11, 0.13)"
      />
      <line x1={x(startIdx)} y1={y(box.top)} x2={x(points.length - 1)} y2={y(box.top)} stroke="#d97706" strokeWidth="1.4" />
      <line x1={x(startIdx)} y1={y(box.bottom)} x2={x(points.length - 1)} y2={y(box.bottom)} stroke="#d97706" strokeWidth="1.4" />
      <line x1={x(startIdx)} y1={y(box.top)} x2={x(startIdx)} y2={y(box.bottom)} stroke="#d97706" strokeWidth="1" strokeDasharray="3 3" />
      {/* 价格线 */}
      <polyline points={line} fill="none" stroke="#0284c7" strokeWidth="1.6" />
      {/* 触边点 */}
      {touches.map((t, i) => (
        <circle
          key={i}
          cx={x(t.index)}
          cy={y(points[t.index].close)}
          r="3"
          fill={t.edge === 'top' ? '#d97706' : '#0284c7'}
          stroke="#fff"
          strokeWidth="0.8"
        />
      ))}
      {/* 现价虚线 + 末点 */}
      <line x1={2} y1={y(lastClose)} x2={x(points.length - 1)} y2={y(lastClose)} stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="2 3" />
      <circle cx={x(points.length - 1)} cy={y(lastClose)} r="3.2" fill="#0f172a" stroke="#fff" strokeWidth="1" />
      {/* 右侧价签 */}
      <text x={W - PAD_R + 4} y={y(box.top) + 3} fontSize="8.5" fill="#d97706">{fmt(box.top)}</text>
      <text x={W - PAD_R + 4} y={Math.max(y(box.bottom), y(box.top) + 11) + 3} fontSize="8.5" fill="#d97706">{fmt(box.bottom)}</text>
      {Math.abs(y(lastClose) - y(box.top)) > 9 && Math.abs(y(lastClose) - y(box.bottom)) > 9 && (
        <text x={W - PAD_R + 4} y={y(lastClose) + 3} fontSize="8.5" fill="#475569">{fmt(lastClose)}</text>
      )}
      <text x={x(startIdx)} y={H - 2} fontSize="8" fill="#94a3b8">{box.startDate}</text>
      <text x={x(points.length - 1)} y={H - 2} fontSize="8" fill="#94a3b8" textAnchor="end">{points[points.length - 1].date}</text>
    </svg>
  );
}

export default function BoxPanel({
  symbol,
  price,
  onActiveBoxChange,
}: {
  symbol: string;
  price: number | null;
  onActiveBoxChange?: (b: { top: number; bottom: number } | null) => void;
}) {
  const { lang } = useLanguage();
  const [data, setData] = useState<BoxApiData | null>(null);
  const [failed, setFailed] = useState(false);
  const [boxes, setBoxes] = useState<BoxDef[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    setBoxes(loadBoxes(symbol));
    fetch(`/api/box?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('bad'))))
      .then((j) => {
        if (cancelled) return;
        setData(j);
        const pts: SeriesPoint[] = j.points ?? [];
        if (pts.length > 0) {
          setFormEnd(pts[pts.length - 1].date);
          setFormStart(pts[Math.max(0, pts.length - 61)]?.date ?? pts[0].date);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const active = useMemo(() => {
    if (boxes.length === 0) return null;
    return boxes.find((b) => b.id === activeId) ?? boxes[boxes.length - 1];
  }, [boxes, activeId]);

  useEffect(() => {
    onActiveBoxChange?.(active ? { top: active.top, bottom: active.bottom } : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.top, active?.bottom]);

  const touches = useMemo(
    () => (data && active ? touchStats(data.points, active) : null),
    [data, active],
  );
  const pos = active && price != null ? boxPosition(active, price) : null;
  const state = active && price != null ? boxState(active, price) : null;
  const age = data && active ? boxAgeDays(data.points, active) : null;
  const heightPct =
    active && active.bottom > 0 ? ((active.top - active.bottom) / active.bottom) * 100 : null;

  const adopt = (b: BoxDef) => {
    const nb: BoxDef = { ...b, id: `box-${Date.now()}`, createdAt: Date.now() };
    setBoxes(saveBox(symbol, nb));
    setActiveId(nb.id);
  };

  const createFromForm = () => {
    if (!data || !formStart || !formEnd || formStart >= formEnd) return;
    const span = data.points.filter((p) => p.date >= formStart && p.date <= formEnd);
    if (span.length < 5) return;
    const hi = Math.max(...span.map((p) => p.close));
    const lo = Math.min(...span.map((p) => p.close));
    const nb: BoxDef = {
      id: `box-${Date.now()}`,
      startDate: span[0].date,
      endDate: span[span.length - 1].date,
      top: Math.round(hi * 100) / 100,
      bottom: Math.round(lo * 100) / 100,
      source: 'user',
      createdAt: Date.now(),
    };
    setBoxes(saveBox(symbol, nb));
    setActiveId(nb.id);
  };

  const nudge = (which: 'top' | 'bottom', dir: 1 | -1) => {
    if (!active) return;
    const delta = active[which] * 0.005 * dir;
    const next = {
      ...active,
      [which]: Math.round((active[which] + delta) * 100) / 100,
    } as BoxDef;
    if (next.top <= next.bottom) return;
    setBoxes(replaceBox(symbol, next));
  };

  const remove = () => {
    if (!active) return;
    const list = deleteBox(symbol, active.id);
    setBoxes(list);
    setActiveId(list.length > 0 ? list[list.length - 1].id : null);
  };

  const stateText = (): string => {
    if (!active || price == null || state == null || pos == null) return '';
    switch (state) {
      case 'above':
        return tx(lang, `Price has broken above the box top by ${(((price - active.top) / active.top) * 100).toFixed(1)}%`, `现价已冲出箱顶 ${(((price - active.top) / active.top) * 100).toFixed(1)}%`);
      case 'below':
        return tx(lang, `Price has dropped below the box bottom by ${(((active.bottom - price) / active.bottom) * 100).toFixed(1)}%`, `现价已跌破箱底 ${(((active.bottom - price) / active.bottom) * 100).toFixed(1)}%`);
      case 'nearTop':
        return tx(lang, `Price is hugging the box top — position ${Math.round(pos)}%`, `现价贴着箱顶，位置 ${Math.round(pos)}%`);
      case 'nearBottom':
        return tx(lang, `Price is hugging the box bottom — position ${Math.round(pos)}%`, `现价贴着箱底，位置 ${Math.round(pos)}%`);
      default:
        return tx(lang, `Price is inside the box — position ${Math.round(pos)}%`, `现价在箱内，位置 ${Math.round(pos)}%`);
    }
  };

  const touchLine = (label: string, stat: { count: number; medianFwd20: number | null; worstFwd20: number | null; bestFwd20: number | null } | undefined) => {
    if (!stat) return null;
    if (stat.count === 0)
      return (
        <div className="text-[11px] text-slate-400">
          {label}：{tx(lang, 'no touches yet', '还没碰到过')}
        </div>
      );
    return (
      <div className="text-[11px] text-slate-400 leading-relaxed">
        {label}：{tx(lang, `${stat.count} touches`, `碰过 ${stat.count} 次`)}
        {stat.medianFwd20 != null &&
          tx(
            lang,
            ` · next 20d median ${fmtPct(stat.medianFwd20)}, worst ${fmtPct(stat.worstFwd20!)}, best ${fmtPct(stat.bestFwd20!)}`,
            ` · 碰后 20 天中位 ${fmtPct(stat.medianFwd20)}，最差 ${fmtPct(stat.worstFwd20!)}，最好 ${fmtPct(stat.bestFwd20!)}`,
          )}
      </div>
    );
  };

  const dateOptions = useMemo(() => (data ? data.points.slice(-250) : []), [data]);

  return (
    <div className="mt-3 bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-200">
          {tx(lang, '📦 Box rhythm — measure this stock against its own box', '📦 箱体律动——拿箱子量这只股自己')}
        </div>
        <span className="text-[10px] text-slate-500">{tx(lang, 'Boxes stay on your phone', '箱子只存本机')}</span>
      </div>

      {failed ? (
        <div className="text-[11px] text-slate-500">{tx(lang, 'Not enough price history to build a box for this one yet.', '这只股的历史数据还不够建箱。')}</div>
      ) : !data ? (
        <div className="text-[11px] text-slate-500">{tx(lang, 'Loading box data…', '正在算箱子…')}</div>
      ) : (
        <>
          {active ? (
            <div className="bg-slate-900/60 border border-amber-600/30 rounded-lg p-3">
              <div className="text-[13px] font-semibold text-amber-600">{stateText()}</div>
              {/* 位置条：0=箱底 100=箱顶 */}
              {pos != null && (
                <div className="relative h-2.5 bg-slate-700/50 rounded-full mt-2.5 mb-1">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-amber-400 border-2 border-slate-900"
                    style={{ left: `${Math.min(100, Math.max(0, pos))}%` }}
                  />
                </div>
              )}
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>{tx(lang, 'Bottom', '箱底')} {fmtP(active.bottom)}</span>
                <span>{tx(lang, 'Top', '箱顶')} {fmtP(active.top)}</span>
              </div>
              <BoxChart points={data.points} box={active} />
              <div className="text-[10px] text-slate-500 mt-1.5 leading-relaxed">
                {tx(
                  lang,
                  `Box height ${heightPct != null ? heightPct.toFixed(1) : '—'}% · formed ${fmtDateShort(active.startDate, lang)} → ${fmtDateShort(active.endDate, lang)}${age != null ? ` · ${age} trading days since` : ''} · ${active.source === 'user' ? 'your box' : 'adopted suggestion'}`,
                  `箱高 ${heightPct != null ? heightPct.toFixed(1) : '—'}% · 形成段 ${fmtDateShort(active.startDate, lang)} → ${fmtDateShort(active.endDate, lang)}${age != null ? ` · 距今 ${age} 个交易日` : ''} · ${active.source === 'user' ? '自定箱' : '采纳的系统提议'}`,
                )}
              </div>
              <div className="mt-2 space-y-1">
                {touchLine(tx(lang, 'Top edge', '箱顶'), touches?.top)}
                {touchLine(tx(lang, 'Bottom edge', '箱底'), touches?.bottom)}
              </div>
              {data.history.breaks > 0 ? (
                <div className="text-[11px] text-slate-400 leading-relaxed mt-1.5">
                  {tx(
                    lang,
                    `Breakout history of this stock: ${data.history.breaks} breaks from detected boxes — ${data.history.followThrough} followed through, ${data.history.falseBreak} were false breaks, ${data.history.neither} went nowhere much.`,
                    `这只股的出箱史：侦测到的箱子共出箱 ${data.history.breaks} 次——延续 ${data.history.followThrough} 次、假突破 ${data.history.falseBreak} 次、其余 ${data.history.neither} 次没走多远。`,
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-500 mt-1.5">
                  {tx(lang, `No completed breakout from the ${data.history.boxesFound} detected boxes yet.`, `侦测到 ${data.history.boxesFound} 个历史箱，暂无已完成的出箱记录。`)}
                </div>
              )}
              {/* 边线微调 + 删除 */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span className="text-[10px] text-slate-500 mr-0.5">{tx(lang, 'Nudge edges:', '微调边线：')}</span>
                {(['top', 'bottom'] as const).map((w) => (
                  <span key={w} className="inline-flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">{w === 'top' ? tx(lang, 'Top', '顶') : tx(lang, 'Bottom', '底')}</span>
                    <button onClick={() => nudge(w, -1)} className="px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-200 text-[11px]">−</button>
                    <button onClick={() => nudge(w, 1)} className="px-1.5 py-0.5 rounded bg-slate-700/70 text-slate-200 text-[11px]">+</button>
                  </span>
                ))}
                <button onClick={remove} className="ml-auto px-2 py-0.5 rounded bg-slate-700/50 text-rose-300 text-[11px]">
                  {tx(lang, 'Delete box', '删掉这个箱')}
                </button>
              </div>
              {boxes.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {boxes.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setActiveId(b.id)}
                      className={`px-2 py-0.5 rounded text-[10px] border ${b.id === active.id ? 'border-amber-500/60 text-amber-300 bg-amber-500/10' : 'border-slate-700 text-slate-400'}`}
                    >
                      {fmtP(b.bottom)}–{fmtP(b.top)} · {b.source === 'user' ? tx(lang, 'yours', '自定') : tx(lang, 'suggested', '提议')}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-[11px] text-slate-400 leading-relaxed">
              {tx(lang, 'No box yet for this stock. Adopt a suggested box below, or build your own from any stretch of history — the box then measures everything that follows.', '这只股还没有箱子。从下面采纳一个系统提议，或者自己选一段历史建箱——建好之后，现价、触边、出箱都拿它来量。')}
            </div>
          )}

          {/* 系统提议 */}
          {data.suggested.length > 0 && (
            <div className="mt-2.5">
              <div className="text-[11px] text-slate-400 mb-1.5">{tx(lang, 'Suggested boxes (sideways stretches the system found)', '系统提议的箱（找到的横盘段）')}</div>
              <div className="space-y-1.5">
                {data.suggested.map((b) => (
                  <div key={b.id} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-2.5 py-1.5">
                    <div className="flex-1 text-[11px] text-slate-300 leading-relaxed">
                      {fmtP(b.bottom)} – {fmtP(b.top)}
                      <span className="text-slate-500"> · {fmtDateShort(b.startDate, lang)} → {fmtDateShort(b.endDate, lang)}</span>
                    </div>
                    <button onClick={() => adopt(b)} className="px-2 py-1 rounded bg-amber-500/15 border border-amber-600/40 text-amber-300 text-[11px] shrink-0">
                      {tx(lang, 'Adopt', '采纳')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 自定建箱 */}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400">{tx(lang, 'Build your own:', '自己建箱：')}</span>
            <select
              value={formStart}
              onChange={(e) => setFormStart(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200 max-w-[118px]"
            >
              {dateOptions.map((p) => (
                <option key={p.date} value={p.date}>{p.date}</option>
              ))}
            </select>
            <span className="text-slate-500 text-[11px]">→</span>
            <select
              value={formEnd}
              onChange={(e) => setFormEnd(e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-slate-200 max-w-[118px]"
            >
              {dateOptions.map((p) => (
                <option key={p.date} value={p.date}>{p.date}</option>
              ))}
            </select>
            <button onClick={createFromForm} className="px-2 py-1 rounded bg-sky-500/15 border border-sky-600/40 text-sky-300 text-[11px]">
              {tx(lang, 'Build box', '用这段建箱')}
            </button>
          </div>

          <div className="text-[10px] text-slate-600 mt-2 leading-relaxed">
            {tx(
              lang,
              'Method: closes only. A suggested box is a stretch of ≥15 trading days ranging ≤20% with at least two touches of each edge. Touch = close within 2% of an edge; breakout = close 1% beyond an edge; follow-through = another half box-height within 20 days. Facts from this stock’s own history — not a buy or sell call.',
              '口径：只用收盘价。系统提议 = ≥15 个交易日、振幅 ≤20%、顶底各至少碰 2 次的横盘段。触边 = 收盘进入边线 2% 内；出箱 = 收盘越边线 1%；延续 = 20 天内再走半个箱高。都是这只股自己的历史事实，不是买卖建议。',
            )}
          </div>
        </>
      )}
    </div>
  );
}
