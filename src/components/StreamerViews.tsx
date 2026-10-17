'use client';

import {
  STREAMER_VIEWS,
  STREAMER_VIEWS_UPDATED,
  STREAMER_VIEWS_BLOGGER_COUNT,
  STANCE_ZH,
  HORIZON_ZH,
  type ViewStance,
} from '@/lib/streamerViews';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 主播观点：Mas 分析整理后的结构化展示（博主·标的·倾向·期限·理由·保留/证伪·来源）。
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

export default function StreamerViews() {
  const { lang } = useLanguage();
  return (
    <section className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">
          {tx(lang, '🎙️ Streamer Views', '🎙️ 主播观点')}
        </h2>
        <span className="text-xs text-slate-400">
          {STREAMER_VIEWS_BLOGGER_COUNT}
          {tx(lang, ' bloggers', ' 位博主')} · {STREAMER_VIEWS_UPDATED.slice(5).replace('-', '/')}
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
        {STREAMER_VIEWS.map((g) => (
          <div key={g.symbol}>
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-[13px] font-bold text-slate-200">
                {g.symbol}
                <span className="ml-1.5 font-normal text-slate-400">{g.label}</span>
              </h3>
              <span className="text-xs text-slate-500">{disagreeLine(g.views)}</span>
            </div>
            <div className="mt-1.5 space-y-2">
              {g.views.map((v) => (
                <div
                  key={v.id}
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
                      <span
                        className={`rounded-full border px-2 py-px text-[11px] ${STANCE_STYLE[v.stance]}`}
                      >
                        {STANCE_ZH[v.stance]}
                      </span>
                    )}
                    <span className="rounded-full border border-slate-600 px-2 py-px text-[11px] text-slate-400">
                      {HORIZON_ZH[v.horizon]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[13px] font-semibold leading-snug text-slate-100">
                    {v.headline}
                  </p>
                  {v.reason && (
                    <p className="mt-1 text-xs leading-relaxed text-slate-300">{v.reason}</p>
                  )}
                  {v.caveat && (
                    <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                      <span className="text-slate-500">
                        {tx(lang, 'Caveat: ', '保留／证伪：')}
                      </span>
                      {v.caveat}
                    </p>
                  )}
                  {v.note && (
                    <p className="mt-1 text-[11px] text-slate-500">⚠️ {v.note}</p>
                  )}
                  <p className="mt-1.5 text-[11px] text-slate-500">
                    {tx(lang, 'Source: ', '来源：')}
                    {v.source}｜{v.published}
                    {v.clip ? `｜原片 ${v.clip}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
