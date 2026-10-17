'use client';

import {
  STREAMER_VIEW_HISTORY,
  STANCE_ZH,
  HORIZON_ZH,
  type DailyBatch,
  type SymbolViewGroup,
  type ViewStance,
} from '@/lib/streamerViews';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 主播观点：Mas 分析整理后的结构化展示（博主·标的·倾向·期限·理由·保留/证伪·来源）。
 * 每日更新：最新一期全展，往期折叠为"回看"（观点留痕）。
 * 设计纪律：只呈现分歧与留痕，不做结论、不荐股；
 * 倾向四档受控词表，长短期强制分开，判断与持仓变化分开记。
 */

const STANCE_STYLE: Record<ViewStance, string> = {
  bullish: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  bearish: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
  cautious: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

function disagreeLine(views: { stance: ViewStance; kind: string }[]): string {
  const counts = new Map<ViewStance, number>();
  let pos = 0;
  for (const v of views) {
    if (v.kind === 'position') {
      pos += 1;
      continue;
    }
    counts.set(v.stance, (counts.get(v.stance) ?? 0) + 1);
  }
  const parts: string[] = [];
  (['bullish', 'bearish', 'cautious', 'neutral'] as ViewStance[]).forEach((s) => {
    const n = counts.get(s) ?? 0;
    if (n > 0) parts.push(`${n} ${STANCE_ZH[s]}`);
  });
  if (pos > 0) parts.push(`${pos} 持仓变化`);
  return parts.join(' · ');
}

function ViewCard({ v }: { v: SymbolViewGroup['views'][number] }) {
  const { lang } = useLanguage();
  return (
    <div
      className={
        v.kind === 'position'
          ? 'rounded-xl border border-dashed border-slate-600 bg-slate-800/40 px-3 py-2.5'
          : 'rounded-xl border border-slate-800 bg-slate-800/60 px-3 py-2.5'
      }
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-200">{v.blogger}</span>
        {v.kind === 'position' ? (
          <span className="rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-px text-[11px] text-sky-300">
            💼 {tx(lang, 'Position change', '持仓变化')}
          </span>
        ) : (
          <span className={`rounded-full border px-2 py-px text-[11px] ${STANCE_STYLE[v.stance]}`}>
            {STANCE_ZH[v.stance]}
          </span>
        )}
        <span className="rounded-full border border-slate-600 px-2 py-px text-[11px] text-slate-400">
          {HORIZON_ZH[v.horizon]}
        </span>
      </div>
      <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-100">{v.headline}</p>
      {v.reason && <p className="mt-1 text-xs leading-relaxed text-slate-300">{v.reason}</p>}
      {v.caveat && (
        <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
          <span className="text-slate-500">{tx(lang, 'Caveat: ', '保留／证伪：')}</span>
          {v.caveat}
        </p>
      )}
      {v.note && <p className="mt-1 text-[11px] text-slate-500">⚠️ {v.note}</p>}
      <p className="mt-1.5 text-[11px] text-slate-500">
        {tx(lang, 'Source: ', '来源：')}
        {v.source}｜{v.published}
        {v.clip ? `｜原片 ${v.clip}` : ''}
      </p>
    </div>
  );
}

function GroupBlock({ g }: { g: SymbolViewGroup }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[13px] font-bold text-slate-200">
          {g.symbol}
          <span className="ml-1.5 font-normal text-slate-400">{g.label}</span>
        </h3>
        <span className="text-xs text-slate-500">{disagreeLine(g.views)}</span>
      </div>
      <div className="mt-1.5 space-y-2">
        {g.views.map((v) => (
          <ViewCard key={v.id} v={v} />
        ))}
      </div>
    </div>
  );
}

function HistoryItem({ b }: { b: DailyBatch }) {
  const { lang } = useLanguage();
  const bloggerCount = new Set(b.groups.flatMap((g) => g.views.map((v) => v.blogger))).size;
  return (
    <details className="rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2">
      <summary className="cursor-pointer text-xs text-slate-300">
        {b.date} · {bloggerCount} {tx(lang, 'bloggers', '位博主')} · {b.groups.length}{' '}
        {tx(lang, 'symbols', '个标的')}
      </summary>
      <div className="mt-2 space-y-2">
        {b.groups.map((g) => (
          <div key={g.symbol}>
            <p className="text-xs font-semibold text-slate-200">
              {g.symbol} <span className="font-normal text-slate-500">{g.label}</span>
              <span className="ml-1.5 font-normal text-slate-500">{disagreeLine(g.views)}</span>
            </p>
            {g.views
              .filter((v) => v.kind === 'view')
              .map((v) => (
                <p key={v.id} className="mt-0.5 text-xs leading-relaxed text-slate-400">
                  · {v.blogger}｜{STANCE_ZH[v.stance]}（{HORIZON_ZH[v.horizon]}）：{v.headline}
                </p>
              ))}
          </div>
        ))}
      </div>
    </details>
  );
}

export default function StreamerViews() {
  const { lang } = useLanguage();
  const [latest, ...past] = STREAMER_VIEW_HISTORY;
  const bloggerCount = new Set(latest.groups.flatMap((g) => g.views.map((v) => v.blogger))).size;
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">
          {tx(lang, '🎙️ Streamer Views', '🎙️ 主播观点')}
          <span className="ml-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-px text-[11px] font-normal text-teal-300">
            🔄 {tx(lang, 'Daily', '每日更新')}
          </span>
        </h2>
        <span className="text-xs text-slate-400">
          {bloggerCount}
          {tx(lang, ' bloggers', ' 位博主')} · {latest.date.slice(5).replace('-', '/')}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {tx(
          lang,
          'Views compiled from programs — not buy/sell advice. Horizons are split: short-term vs long-term.',
          '节目观点整理·非本人买卖建议。长短期判断分开看。'
        )}
      </p>

      <div className="mt-3 space-y-4">
        {latest.groups.map((g) => (
          <GroupBlock key={g.symbol} g={g} />
        ))}
      </div>

      {past.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-400">
            📌 {tx(lang, 'Past reviews', '往期回看')}
          </h4>
          {past.map((b) => (
            <HistoryItem key={b.date} b={b} />
          ))}
        </div>
      )}
    </section>
  );
}
