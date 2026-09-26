'use client';

import { useEffect, useMemo, useState } from 'react';
import { getRhythm } from '@/lib/market';
import { useWatchlist } from './WatchlistContext';
import { getUpcomingEvents, type CalEvent } from '@/lib/financeCalendar';
import type { EarningsEvent } from '@/app/api/earnings/route';
import {
  etBriefTime,
  buildPreBrief,
  buildPostBrief,
  zhStatus,
  type BriefStock,
  type BriefTime,
  type PreBrief,
  type PostBrief,
  type SignalChange,
  type MarketScanSummary,
  type ScanMini,
} from '@/lib/dailyBrief';
import { fmtCompactMoney } from '@/lib/currency';

const SNAP_KEY = 'gushenle:brief-snapshot:v1';

interface SnapRec {
  date: string;
  signals: Record<string, { score: number; statusKey: string }>;
}

function loadSnap(): SnapRec | null {
  try {
    const raw = localStorage.getItem(SNAP_KEY);
    return raw ? (JSON.parse(raw) as SnapRec) : null;
  } catch {
    return null;
  }
}

/**
 * 每日两报：盘前瞻 + 盘后总结，纯确定性拼装（无 AI、无新数据源）。
 * 放在资讯页最顶部，按美东时间决定高亮哪张。
 */
export default function DailyBrief() {
  const { items } = useWatchlist();
  const [bt] = useState<BriefTime>(() => etBriefTime());
  const [stocks, setStocks] = useState<BriefStock[] | null>(null);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [changes, setChanges] = useState<SignalChange[]>([]);
  const [market, setMarket] = useState<MarketScanSummary | null>(null);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      // 今日事件：固定日程 + 自选股财报（只取今天）
      const staticEvts = getUpcomingEvents(bt.dateStr, 1).filter((e) => e.date === bt.dateStr);
      let earningEvts: CalEvent[] = [];
      try {
        const symbols = items.map((i) => i.symbol).join(',');
        if (symbols) {
          const r = await fetch(
            `/api/earnings?start=${bt.dateStr}&days=1&symbols=${encodeURIComponent(symbols)}`,
          );
          const j = await r.json();
          earningEvts = ((j.events || []) as EarningsEvent[])
            .filter((e) => e.date === bt.dateStr)
            .map((e) => ({
              date: e.date,
              title: '发布财报',
              kind: 'earnings' as const,
              symbol: e.symbol,
              note: e.session,
            }));
        }
      } catch {
        /* 财报拿不到不影响 */
      }
      if (alive) setEvents([...staticEvts, ...earningEvts]);

      // 全市场扫描：大盘 + 全市场信号统计 + 昨日资金异动（读批处理表，不实时算）
      try {
        const mr = await fetch('/api/market-scan');
        const mj = await mr.json();
        if (mj.ok && !mj.empty && alive) {
          const mini = (x: unknown): ScanMini | null =>
            x
              ? {
                  symbol: (x as ScanMini).symbol,
                  name: (x as ScanMini).name,
                  score: (x as ScanMini).score,
                  statusKey: (x as ScanMini).statusKey || '',
                  changePct: (x as ScanMini).changePct,
                  inflowEst: (x as ScanMini).inflowEst,
                }
              : null;
          setMarket({
            scanDate: mj.scanDate,
            total: mj.total,
            hotCount: mj.counts?.overheated ?? 0,
            coldCount: mj.counts?.oversoldBottom ?? 0,
            qqq: mini(mj.qqq),
            spy: mini(mj.spy),
            inflowTop: (mj.inflowTop || []).map(mini).filter(Boolean) as ScanMini[],
            outflowTop: (mj.outflowTop || []).map(mini).filter(Boolean) as ScanMini[],
          });
        }
      } catch {
        /* 扫描表没数据就不显示全市场行 */
      }

      // 每只自选：最近交易日涨跌 + 律动信号（走共享缓存）
      const list: BriefStock[] = [];
      await Promise.all(
        items.map(async (w) => {
          try {
            const d = await getRhythm(w.symbol, '3M');
            const s = d.series;
            const n = s.length;
            let changePct: number | null = null;
            let barDate = '';
            if (n >= 2) {
              const prev = s[n - 2].close;
              changePct = prev > 0 ? Number((((s[n - 1].close - prev) / prev) * 100).toFixed(2)) : null;
              const md = s[n - 1].date.slice(5).split('-');
              barDate = `${Number(md[0])}/${Number(md[1])}`;
            }
            list.push({
              symbol: w.symbol,
              name: w.name || w.symbol,
              changePct,
              barDate,
              score: d.judgment.score,
              statusKey: d.judgment.statusKey || '',
            });
          } catch {
            /* 单只失败不影响整张报 */
          }
        }),
      );
      if (!alive) return;

      // 信号变化：与上次看报时的快照对比（同一天内不重复报）
      const snap = loadSnap();
      const prev = snap && snap.date < bt.dateStr ? snap.signals : null;
      const ch: SignalChange[] = [];
      if (prev) {
        for (const s of list) {
          const p = prev[s.symbol];
          if (p && p.statusKey !== s.statusKey) {
            ch.push({
              symbol: s.symbol,
              name: s.name,
              from: zhStatus((p.statusKey as BriefStock['statusKey']) || ''),
              to: zhStatus(s.statusKey),
              toKey: s.statusKey,
            });
          }
        }
      }
      setChanges(ch);
      try {
        const signals: SnapRec['signals'] = {};
        for (const s of list) signals[s.symbol] = { score: s.score, statusKey: s.statusKey };
        localStorage.setItem(SNAP_KEY, JSON.stringify({ date: bt.dateStr, signals }));
      } catch {
        /* 存不下不影响看 */
      }
      setStocks(list);
    };
    run();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pre: PreBrief | null = useMemo(
    () => (stocks ? buildPreBrief(stocks, events, market) : null),
    [stocks, events, market],
  );
  const post: PostBrief | null = useMemo(
    () => (stocks ? buildPostBrief(stocks, changes, market) : null),
    [stocks, changes, market],
  );
  const barDate = useMemo(() => {
    if (!stocks || stocks.length === 0) return '';
    return stocks.map((s) => s.barDate).filter(Boolean).sort().pop() || '';
  }, [stocks]);

  const card = (active: boolean) =>
    `rounded-xl border p-4 transition-opacity ${active ? 'opacity-100' : 'opacity-75'} ` +
    (active
      ? 'bg-sky-950/40 border-sky-500/40'
      : 'bg-slate-900 border-slate-800');

  return (
    <div className="space-y-3">
      {!bt.tradingDay && (
        <div className="text-[11px] text-slate-400 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-center">
          今天美股休市，下面是上个交易日的总结 🌙
        </div>
      )}

      {/* 盘前瞻 */}
      <div className={card(bt.phase === 'pre' && bt.tradingDay)}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-100">🌅 盘前瞻 · {bt.md}</span>
          {bt.phase === 'pre' && bt.tradingDay && (
            <span className="text-[10px] text-sky-300 bg-sky-500/15 border border-sky-500/30 rounded-full px-2 py-0.5">
              现在看这张
            </span>
          )}
        </div>
        {pre == null ? (
          <p className="text-[11px] text-slate-500">汇总中…</p>
        ) : !bt.tradingDay ? (
          <p className="text-[11px] text-slate-500">休市中，下个交易日开盘前再来看。</p>
        ) : (
          <div className="space-y-2 text-[11px] leading-relaxed">
            <div>
              {pre.eventsToday.length === 0 ? (
                <span className="text-slate-400">今日无重磅日程</span>
              ) : (
                <ul className="space-y-1">
                  {pre.eventsToday.slice(0, 4).map((e, i) => (
                    <li key={i} className="text-slate-300">
                      📌 {e.title}
                      {e.symbol ? ` · ${e.symbol}` : ''}
                      {e.note ? <span className="text-slate-500">（{e.note}）</span> : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {(pre.ups.length > 0 || pre.downs.length > 0) && barDate && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-500 shrink-0">上个交易日（{barDate}）</span>
                {[...pre.ups, ...pre.downs].map((s) => <Mover key={s.symbol} s={s} />)}
              </div>
            )}
            {pre.market && (
              <div className="space-y-1.5 pt-0.5">
                {(pre.market.qqq || pre.market.spy) && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 shrink-0">大盘</span>
                    {[pre.market.qqq, pre.market.spy].filter(Boolean).map((m) => (
                      <IndexChip key={m!.symbol} m={m!} />
                    ))}
                  </div>
                )}
                <p className="text-slate-400">
                  📡 全市场扫描（{pre.market.total}只）：{pre.market.hotCount}只
                  <span className="text-amber-300">「涨太猛了」</span>，
                  {pre.market.coldCount}只
                  <span className="text-sky-300">「跌过头了」</span>
                </p>
              </div>
            )}
            <p className="text-amber-200/90">💡 {pre.line}</p>
          </div>
        )}
      </div>

      {/* 盘后总结 */}
      <div className={card(bt.phase === 'post' || !bt.tradingDay)}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-slate-100">
            🌇 盘后总结{barDate ? ` · ${barDate}` : ''}
          </span>
          {(bt.phase === 'post' || !bt.tradingDay) && (
            <span className="text-[10px] text-sky-300 bg-sky-500/15 border border-sky-500/30 rounded-full px-2 py-0.5">
              现在看这张
            </span>
          )}
        </div>
        {post == null ? (
          <p className="text-[11px] text-slate-500">汇总中…</p>
        ) : (
          <div className="space-y-2 text-[11px] leading-relaxed">
            {(post.ups.length > 0 || post.downs.length > 0) && (
              <div className="space-y-1.5">
                {post.ups.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 shrink-0">领涨</span>
                    {post.ups.map((s) => <Mover key={s.symbol} s={s} />)}
                  </div>
                )}
                {post.downs.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 shrink-0">领跌</span>
                    {post.downs.map((s) => <Mover key={s.symbol} s={s} />)}
                  </div>
                )}
              </div>
            )}
            <div>
              {post.changes.length === 0 ? (
                <p className="text-slate-500">自选股律动信号无变化</p>
              ) : (
                <ul className="space-y-1">
                  {post.changes.slice(0, 5).map((c, i) => (
                    <li key={i} className="text-slate-300">
                      🔄 {c.symbol}：{c.from} → <strong className="text-amber-300">{c.to}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {post.market && (post.market.inflowTop.length > 0 || post.market.outflowTop.length > 0) && (
              <div className="space-y-1.5">
                <p className="text-slate-500">
                  💸 昨日资金异动<span className="text-slate-600">（日线估算，非逐笔）</span>
                </p>
                {post.market.inflowTop.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 shrink-0">流入</span>
                    {post.market.inflowTop.map((m) => (
                      <FlowChip key={m.symbol} m={m} dir={1} />
                    ))}
                  </div>
                )}
                {post.market.outflowTop.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-slate-500 shrink-0">流出</span>
                    {post.market.outflowTop.map((m) => (
                      <FlowChip key={m.symbol} m={m} dir={-1} />
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-amber-200/90">💡 {post.line}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Mover({ s }: { s: BriefStock }) {
  const up = (s.changePct ?? 0) > 0;
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full border tabular-nums ${
        up
          ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
          : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
      }`}
    >
      {s.symbol} {up ? '+' : ''}{s.changePct}%
    </span>
  );
}

/** 大盘 chip：指数 + 大白话信号 */
function IndexChip({ m }: { m: ScanMini }) {
  const up = (m.changePct ?? 0) > 0;
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-slate-700 bg-slate-800/60 text-slate-300 tabular-nums">
      {m.symbol} · {zhStatus(m.statusKey)}
      {m.changePct != null && (
        <span className={up ? 'text-emerald-300' : 'text-rose-300'}>
          {' '}{up ? '+' : ''}{m.changePct}%
        </span>
      )}
    </span>
  );
}

/** 资金异动 chip：估算净流入/流出 */
function FlowChip({ m, dir }: { m: ScanMini; dir: 1 | -1 }) {
  const amt = m.inflowEst != null ? fmtCompactMoney(m.symbol, Math.abs(m.inflowEst)) : '—';
  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full border tabular-nums ${
        dir === 1
          ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
          : 'text-rose-300 border-rose-500/30 bg-rose-500/10'
      }`}
    >
      {m.symbol} {dir === 1 ? '净流入' : '净流出'} {amt}
    </span>
  );
}
