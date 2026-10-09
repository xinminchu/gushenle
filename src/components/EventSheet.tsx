// src/components/EventSheet.tsx
// 价格走势图上的事件圆点弹窗：财报 / 宏观事件（FOMC/CPI/非农）。
// 宏观事件会拉 BLS 实际数据（新增非农、失业率、CPI），不只给标题。
import { useEffect, useState } from 'react';
import { tx } from '@/lib/hant';
import type { Lang } from '@/lib/i18n';
import type { ChartEventMarker } from './RhythmChart';

interface BLSPoint {
  year: string;
  period: string;
  periodName: string;
  value: string;
}

interface MacroData {
  ok: boolean;
  kind: string;
  payrolls?: BLSPoint[];
  unemployment?: BLSPoint[];
  cpi?: BLSPoint[];
}

export default function EventSheet({
  marker,
  lang,
  onClose,
  onGoCalendar,
}: {
  marker: ChartEventMarker;
  lang: Lang;
  onClose: () => void;
  onGoCalendar?: (date: string) => void;
}) {
  const m = marker;
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [macroLoading, setMacroLoading] = useState(false);

  const icon =
    m.kind === 'earnings' ? '📢' : m.macroKind === 'fomc' ? '🏦' : m.macroKind === 'cpi' ? '📊' : '💼';
  const explainer =
    m.kind === 'earnings'
      ? tx(lang, 'Earnings day — volatility often spikes around earnings.', '财报日——财报日前后，股价波动常常放大。')
      : m.macroKind === 'fomc'
        ? tx(lang, 'Fed rate decision — when rates move, funding costs move everywhere.', '美联储议息决议——利率一动，全市场的资金成本跟着动。')
        : m.macroKind === 'cpi'
          ? tx(lang, 'Key inflation data — shapes Fed rate-cut expectations directly.', '通胀关键数据——直接左右美联储的降息预期。')
          : tx(lang, 'US nonfarm payrolls — labor-market heat often swings the market.', '美国非农就业数据——就业冷热，常引发市场大波动。');

  // 宏观事件：拉实际数据
  useEffect(() => {
    if (m.kind !== 'macro' || (m.macroKind !== 'nonfarm' && m.macroKind !== 'cpi')) return;
    let alive = true;
    setMacroLoading(true);
    fetch(`/api/macro-data?kind=${m.macroKind}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive && d.ok) setMacro(d);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setMacroLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [m.kind, m.macroKind]);

  // 非农：算新增就业（当月减上月，单位千人）
  function payrollChanges(): { label: string; change: number }[] | null {
    if (!macro?.payrolls || macro.payrolls.length < 2) return null;
    const out: { label: string; change: number }[] = [];
    for (let i = 0; i < Math.min(4, macro.payrolls.length - 1); i++) {
      const cur = parseFloat(macro.payrolls[i].value);
      const prev = parseFloat(macro.payrolls[i + 1].value);
      if (isNaN(cur) || isNaN(prev)) continue;
      out.push({
        label: `${macro.payrolls[i].year}年${macro.payrolls[i].periodName}`,
        change: Math.round(cur - prev),
      });
    }
    return out;
  }

  const changes = m.macroKind === 'nonfarm' ? payrollChanges() : null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{icon}</span>
            <div>
              <h3 className="font-bold text-slate-100 text-base">
                {lang === 'en' ? m.titleEn : m.title}
              </h3>
              <p className="text-[11px] text-slate-500">
                {m.time} · {m.kind === 'earnings' ? tx(lang, 'Earnings', '财报') : tx(lang, 'Macro event', '宏观事件')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 text-lg leading-none"
            aria-label={tx(lang, 'Close', '关闭')}
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed mt-3">{explainer}</p>

        {/* 实际数据 */}
        {m.kind === 'macro' && (m.macroKind === 'nonfarm' || m.macroKind === 'cpi') && (
          <div className="mt-3 rounded-xl bg-slate-800/60 border border-slate-700/60 p-3">
            {macroLoading && (
              <p className="text-[11px] text-slate-500">{tx(lang, 'Loading data…', '加载数据…')}</p>
            )}
            {!macroLoading && m.macroKind === 'nonfarm' && changes && (
              <div>
                <p className="text-[11px] font-semibold text-slate-300 mb-2">
                  {tx(lang, 'Nonfarm payroll changes (thousands)', '新增非农就业（千人）')}
                </p>
                {changes.map((c) => (
                  <div key={c.label} className="flex justify-between text-[11px] py-0.5">
                    <span className="text-slate-500">{c.label}</span>
                    <span className={c.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                      {c.change >= 0 ? '+' : ''}{c.change}K
                    </span>
                  </div>
                ))}
                {macro?.unemployment && macro.unemployment.length > 0 && (
                  <div className="flex justify-between text-[11px] py-0.5 mt-1 pt-1 border-t border-slate-700/50">
                    <span className="text-slate-500">{tx(lang, 'Unemployment rate (latest)', '失业率（最新）')}</span>
                    <span className="text-slate-200">{macro.unemployment[0].value}%</span>
                  </div>
                )}
                <p className="text-[10px] text-slate-600 mt-1.5">BLS · {tx(lang, 'seasonally adjusted', '季调后')}</p>
              </div>
            )}
            {!macroLoading && m.macroKind === 'cpi' && macro?.cpi && (
              <div>
                <p className="text-[11px] font-semibold text-slate-300 mb-2">CPI</p>
                {macro.cpi.slice(0, 4).map((p) => (
                  <div key={`${p.year}-${p.period}`} className="flex justify-between text-[11px] py-0.5">
                    <span className="text-slate-500">{p.year}年{p.periodName}</span>
                    <span className="text-slate-200">{p.value}</span>
                  </div>
                ))}
                <p className="text-[10px] text-slate-600 mt-1.5">BLS · {tx(lang, 'index', '指数')}</p>
              </div>
            )}
            {!macroLoading && !macro && (
              <p className="text-[11px] text-slate-500">{tx(lang, 'Data unavailable', '暂无数据')}</p>
            )}
          </div>
        )}

        {onGoCalendar && (
          <button
            onClick={() => {
              onGoCalendar(m.time);
              onClose();
            }}
            className="mt-4 w-full text-center text-xs font-semibold text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-xl py-2.5 hover:bg-sky-500/20 transition-colors"
          >
            {tx(lang, 'View in finance calendar →', '去资讯页财经日历查看 →')}
          </button>
        )}
      </div>
    </div>
  );
}
