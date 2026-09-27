// 买入前体检：5 道检查，每道给 ✓/△/✗，底部一句话总结。
// 口径：拦追高，不预测；查不到的数据给"—"，不瞎判。

'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Minus, X } from 'lucide-react';
import type { RhythmPoint, StatusKey } from '@/lib/rhythm';
import { loadPositions } from '@/lib/positions';

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
  /** 年内最高价（拿不到时传 null，该项显示"—"） */
  yearHigh: number | null;
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

export default function BuyCheckup({
  symbol,
  name,
  score,
  hot,
  yearHigh,
  price,
  series,
  onClose,
}: BuyCheckupProps) {
  // 财报：14 天内有没有这只的财报（走现有 /api/earnings，不新增接口）
  const [earnState, setEarnState] = useState<'loading' | 'none' | 'error' | { date: string; session: string }>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/earnings?days=14&symbols=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const ev = (json.events ?? [])[0];
        setEarnState(ev ? { date: ev.date, session: ev.session } : 'none');
      })
      .catch(() => {
        if (!cancelled) setEarnState('error');
      });
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

  // 3. 位置高吗（距年内高点）
  if (yearHigh == null || yearHigh <= 0) {
    checks.push({ icon: 'na', title: '位置', detail: '年内高点数据还没到，不瞎判' });
  } else {
    const dist = ((yearHigh - price) / yearHigh) * 100;
    if (dist <= 3) {
      checks.push({ icon: 'bad', title: '位置很高', detail: '就在年内高点边上，现在买等于接最后一棒' });
    } else if (dist <= 8) {
      checks.push({ icon: 'warn', title: '位置偏高', detail: `离年内高点只剩 ${dist.toFixed(0)}%，性价比一般` });
    } else {
      checks.push({ icon: 'ok', title: '位置还行', detail: `离年内高点还有 ${dist.toFixed(0)}%，不算贵` });
    }
  }

  // 4. 仓位重吗（按成本算占比；没记持仓不瞎判）
  if (typeof window !== 'undefined') {
    const positions = loadPositions();
    const mine = positions.find((p) => p.symbol.toUpperCase() === symbol.toUpperCase());
    if (!mine) {
      checks.push({ icon: 'na', title: '仓位', detail: '没记持仓，不瞎判' });
    } else {
      const total = positions.reduce((a, p) => a + p.shares * p.avgCost, 0);
      const w = total > 0 ? (mine.shares * mine.avgCost) / total : 0;
      const pct = (w * 100).toFixed(0);
      if (w >= 0.3) {
        checks.push({ icon: 'warn', title: '仓位已重', detail: `这只已占 ${pct}% 仓位（按成本），再加就重了` });
      } else {
        checks.push({ icon: 'ok', title: '仓位不重', detail: `已持有，占 ${pct}% 仓位（按成本）` });
      }
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
