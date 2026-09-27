// 买入前体检：5 道检查，每道给 ✓/△/✗，底部一句话总结。
// 口径：拦追高，不预测；查不到的数据给"—"，不瞎判。

'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Minus, X } from 'lucide-react';
import type { RhythmPoint, StatusKey } from '@/lib/rhythm';
import { loadPositions } from '@/lib/positions';
import { loadOperations } from '@/lib/operations';
import { getRhythm } from '@/lib/market';
import { actualHighLow } from '@/lib/brief';
import { fmtMoney } from '@/lib/currency';

type Icon = 'ok' | 'warn' | 'bad' | 'na';

interface Check {
  icon: Icon;
  title: string;
  detail: string;
}

interface BuyCheckupProps {
  symbol: string;
  name: string;
  score: number;
  /** 过热阈值（波动自适应那套） */
  hot: number;
  statusKey?: StatusKey;
  /** 三档高点：近3月 / 近1年（1Y 数据没到时为 null，该档跳过不瞎判；历史档弹窗自己拉 ALL 补） */
  highs: { m3: number | null; y1: number | null };
  price: number;
  series: RhythmPoint[];
  onClose: () => void;
}

function IconGlyph({ icon }: { icon: Icon }) {
  if (icon === 'ok') return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
  if (icon === 'warn') return <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />;
  if (icon === 'bad') return <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
  return <Minus className="w-4 h-4 text-slate-500 shrink-0" />;
}

const zhDate = (ds: string) => {
  const m = ds.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return ds;
  return `${parseInt(m[1], 10)}月${parseInt(m[2], 10)}日`;
};

/** 财报查询的模块级客户端缓存：symbol -> 结果，TTL 1 小时（失败不缓存，下次打开重试） */
type EarnVal = 'none' | 'error' | { date: string; session: string };
const earnCache = new Map<string, { at: number; val: EarnVal }>();
const EARN_CACHE_TTL = 60 * 60 * 1000;

export default function BuyCheckup({
  symbol,
  name,
  score,
  hot,
  highs,
  price,
  series,
  onClose,
}: BuyCheckupProps) {
  // 财报：14 天内有没有这只的财报（走现有 /api/earnings，不新增接口；模块级缓存 1 小时）
  const [earnState, setEarnState] = useState<'loading' | 'none' | 'error' | { date: string; session: string }>('loading');

  useEffect(() => {
    let cancelled = false;
    const key = symbol.toUpperCase();
    const hit = earnCache.get(key);
    if (hit && Date.now() - hit.at < EARN_CACHE_TTL) {
      setEarnState(hit.val);
      return;
    }
    setEarnState('loading');
    fetch(`/api/earnings?days=14&symbols=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const ev = (json.events ?? [])[0];
        const val: EarnVal = ev ? { date: ev.date, session: ev.session } : 'none';
        earnCache.set(key, { at: Date.now(), val });
        setEarnState(val);
      })
      .catch(() => {
        if (!cancelled) setEarnState('error');
      });
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // 历史高点：ALL 区间（服务端近 3 年日线），回来自动补上第三档；拿不到就不显示该档
  const [allHigh, setAllHigh] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    getRhythm(symbol, 'ALL')
      .then((d) => {
        if (cancelled) return;
        setAllHigh(actualHighLow(d.series)?.high ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const checks: Check[] = [];

  // 1. 律动过热吗
  if (score >= hot) {
    checks.push({
      icon: 'bad',
      title: '律动过热',
      detail: `律动 ${score} 分，过了 ${hot} 分的过热线——太热了，先别追`,
    });
  } else if (score >= hot - 15) {
    checks.push({ icon: 'warn', title: '律动偏热', detail: `律动 ${score} 分，离过热线不远，悠着点` });
  } else {
    checks.push({ icon: 'ok', title: '律动不热', detail: `律动 ${score} 分，没到追高的危险区` });
  }

  // 2. 财报临近吗
  if (earnState === 'loading') {
    checks.push({ icon: 'na', title: '财报日历', detail: '正在查…' });
  } else if (earnState === 'error') {
    checks.push({ icon: 'na', title: '财报日历', detail: '财报日历没查到，不瞎判' });
  } else if (earnState === 'none') {
    checks.push({ icon: 'ok', title: '近期无财报', detail: '14 天内没这只的财报，少一个爆雷变量' });
  } else {
    checks.push({
      icon: 'warn',
      title: '财报临近',
      detail: `${zhDate(earnState.date)}有财报（${earnState.session}）——财报前后波动大，想清楚再动`,
    });
  }

  // 3. 位置高吗（三档：近3月 / 近1年 / 历史，取离得最近的一档判；拿不到的档直接跳过）
  {
    const tiers: Array<[string, number | null]> = [
      ['3月高点', highs.m3],
      ['年内高点', highs.y1],
      ['历史高点', allHigh],
    ];
    const dists: number[] = [];
    const labels: string[] = [];
    for (const [label, h] of tiers) {
      if (h == null || h <= 0 || price <= 0) continue;
      const d = ((h - price) / h) * 100;
      dists.push(d);
      labels.push(`离${label} ${d.toFixed(0)}%`);
    }
    if (dists.length === 0) {
      checks.push({ icon: 'na', title: '位置', detail: '高点数据还没到，不瞎判' });
    } else {
      const d = Math.min(...dists);
      const detail = labels.join(' · ');
      if (d <= 3) {
        checks.push({ icon: 'bad', title: '位置很高', detail: `${detail}——现在买基本是接最后一棒` });
      } else if (d <= 8) {
        checks.push({ icon: 'warn', title: '位置偏高', detail: `${detail}，性价比一般` });
      } else {
        checks.push({ icon: 'ok', title: '位置还行', detail: `${detail}，不算贵` });
      }
    }
  }

  // 4. 仓位 + 历史操作：有现持仓看占比和浮动盈亏；空仓但有历史操作就总结历史；都没有不瞎判
  if (typeof window !== 'undefined') {
    const positions = loadPositions();
    const mine = positions.find((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
    const ops = loadOperations().filter((o) => (o.symbol || '').toUpperCase() === symbol.toUpperCase());
    if (mine) {
      const total = positions.reduce((a, p) => a + p.shares * p.avgCost, 0);
      const w = total > 0 ? (mine.shares * mine.avgCost) / total : 0;
      const pct = (w * 100).toFixed(0);
      const pnl = (price - mine.avgCost) * mine.shares;
      const pnlPct = mine.avgCost > 0 ? ((price - mine.avgCost) / mine.avgCost) * 100 : 0;
      const sign = pnl >= 0 ? '+' : '-';
      const pnlStr = `浮动盈亏 ${sign}${fmtMoney(symbol, Math.abs(pnl))}（${sign}${Math.abs(pnlPct).toFixed(1)}%）`;
      if (w >= 0.3) {
        checks.push({ icon: 'warn', title: '仓位已重', detail: `这只已占 ${pct}% 仓位（按成本），再加就重了；${pnlStr}` });
      } else {
        checks.push({ icon: 'ok', title: '仓位不重', detail: `已持有，占 ${pct}% 仓位（按成本）；${pnlStr}` });
      }
    } else if (ops.length > 0) {
      const buys = ops.filter((o) => o.action === 'buy');
      const sells = ops.filter((o) => o.action === 'sell');
      const sumQty = (list: typeof ops) => list.reduce((a, o) => a + (o.qty ?? 0), 0);
      const sumCost = (list: typeof ops) => list.reduce((a, o) => a + (o.qty != null ? o.qty * o.price : 0), 0);
      const bq = sumQty(buys);
      const sq = sumQty(sells);
      const avgB = bq > 0 ? sumCost(buys) / bq : null;
      const avgS = sq > 0 ? sumCost(sells) / sq : null;
      const lines: string[] = [];
      if (avgB != null) lines.push(`累计买入 ${bq} 股（均价 ${fmtMoney(symbol, avgB)}）`);
      else if (buys.length > 0) lines.push(`买入过 ${buys.length} 笔（没记数量）`);
      if (avgS != null) lines.push(`累计卖出 ${sq} 股（均价 ${fmtMoney(symbol, avgS)}）`);
      else if (sells.length > 0) lines.push(`卖出过 ${sells.length} 笔（没记数量）`);
      if (avgB != null && avgS != null && sq > 0) {
        const realized = (avgS - avgB) * sq;
        const rsign = realized >= 0 ? '+' : '-';
        lines.push(`已实现估算 ${rsign}${fmtMoney(symbol, Math.abs(realized))}`);
      }
      const recent = ops.slice(0, 3).map((o) => {
        const act = o.action === 'buy' ? '买入' : '卖出';
        const q = o.qty != null ? ` ${o.qty}股` : '';
        const th = o.thesis ? `（${o.thesis}）` : '';
        return `${zhDate(o.date)} ${act}${q} @${fmtMoney(symbol, o.price)}${th}`;
      });
      if (recent.length > 0) lines.push(`最近：${recent.join('；')}`);
      checks.push({ icon: 'ok', title: '当前空仓', detail: lines.join('；') });
    } else {
      checks.push({ icon: 'na', title: '仓位', detail: '没记持仓，不瞎判' });
    }
  } else {
    checks.push({ icon: 'na', title: '仓位', detail: '没记持仓，不瞎判' });
  }

  // 5. 短期涨太急吗（近 5 个交易日）
  if (series.length >= 6) {
    const ago = series[series.length - 6].close;
    const now = series[series.length - 1].close;
    const chg5 = ago > 0 ? ((now - ago) / ago) * 100 : 0;
    if (chg5 >= 8) {
      checks.push({ icon: 'warn', title: '涨得太急', detail: `近 5 天涨了 ${chg5.toFixed(1)}%，有点急，等它喘口气` });
    } else {
      checks.push({
        icon: 'ok',
        title: '涨速正常',
        detail: `近 5 天 ${chg5 >= 0 ? '+' : ''}${chg5.toFixed(1)}%，没出现短期暴涨`,
      });
    }
  } else {
    checks.push({ icon: 'na', title: '涨速', detail: '数据不足，不瞎判' });
  }

  const bads = checks.filter((c) => c.icon === 'bad').length;
  const warns = checks.filter((c) => c.icon === 'warn').length;
  const oks = checks.filter((c) => c.icon === 'ok').length;
  const nas = checks.filter((c) => c.icon === 'na').length;
  const summary =
    bads > 0
      ? `有 ${bads} 项亮红灯，再想想`
      : warns > 0
        ? `${warns} 项要注意，${oks} 项通过`
        : oks === 5
          ? '5 项都过，真想买可以分批'
          : `${oks} 项通过，${nas} 项没数据——能查的都过了，真想买可以分批`;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-slate-800 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-slate-100">
            买入前体检 <span className="text-slate-400 font-normal">{symbol} {name}</span>
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1" aria-label="关闭">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mb-3">买之前过一遍，拦住一时冲动</p>
        <div className="space-y-2">
          {checks.map((c, i) => (
            <div key={i} className="flex items-start gap-2.5 bg-slate-900/60 rounded-xl px-3 py-2.5">
              <div className="pt-0.5"><IconGlyph icon={c.icon} /></div>
              <div className="min-w-0">
                <div className="text-xs font-medium text-slate-200">{c.title}</div>
                <div className="text-[11px] text-slate-400 leading-relaxed mt-0.5">{c.detail}</div>
              </div>
            </div>
          ))}
        </div>
        <div
          className={`mt-3 rounded-xl px-3 py-2.5 text-xs leading-relaxed ${
            bads > 0
              ? 'bg-rose-500/10 border border-rose-500/30 text-rose-200'
              : warns > 0
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-200'
                : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200'
          }`}
        >
          {summary}
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-200 font-medium"
        >
          知道了
        </button>
      </div>
    </div>
  );
}
