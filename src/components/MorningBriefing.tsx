'use client';

import { useState } from 'react';
import {
  BRIEFING_SECTION_META,
  BRIEFING_DISCLAIMER,
  MORNING_BRIEFING_HISTORY,
  briefingSections,
  latestBriefing,
  type MorningBriefing,
} from '@/lib/morningBriefing';
import { shareBriefingCard } from '@/lib/briefingCard';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

const SECTION_ICON = ['🌙', '📈', '🗓️', '🌡️'] as const;

function SectionBlock({ b, si, id, items }: {
  b: MorningBriefing;
  si: number;
  id: keyof typeof BRIEFING_SECTION_META;
  items: MorningBriefing['overnight'];
}) {
  const { lang } = useLanguage();
  const meta = BRIEFING_SECTION_META[id];
  return (
    <div className="mt-3">
      <h3 className="text-[13px] font-bold text-slate-100">
        {SECTION_ICON[si]} {meta.num}、{tx(lang, meta.en, meta.zh)}
      </h3>
      <ul className="mt-1.5 space-y-2">
        {items.map((it, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-slate-300">
            <span className="text-slate-500">·</span> {it.text}{' '}
            <span className="text-[11px] text-slate-500">
              （{tx(lang, 'Source: ', '来源：')}{it.url ? (
                <a href={it.url} target="_blank" rel="noreferrer" className="text-sky-400/80 hover:text-sky-300 underline underline-offset-2">
                  {it.source}
                </a>
              ) : it.source}）
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * 盘前早报：固定四栏目、每天只换内容。最新一期全展，往期折叠回看。
 * 人工审核门：内容由 Mas 盘前核实来源后写入 lib/morningBriefing.ts，无合格内容整期跳过。
 */
export default function MorningBriefing() {
  const { lang } = useLanguage();
  const [latest, ...past] = MORNING_BRIEFING_HISTORY;
  const [shareState, setShareState] = useState<'idle' | 'working' | 'done' | 'error'>('idle');

  const onShare = async () => {
    setShareState('working');
    const r = await shareBriefingCard(latest);
    setShareState(r === 'failed' ? 'error' : 'done');
    setTimeout(() => setShareState('idle'), 2500);
  };

  return (
    <section className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-amber-200">
          {tx(lang, '☀️ Pre-Market Briefing', '☀️ 盘前早报')}
          <span className="ml-2 text-xs font-normal text-slate-400">{latest.date}</span>
        </h2>
        <button
          onClick={onShare}
          disabled={shareState === 'working'}
          className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-200 active:bg-amber-500/20 disabled:opacity-50"
        >
          {shareState === 'working'
            ? tx(lang, 'Rendering…', '生成中…')
            : shareState === 'done'
              ? tx(lang, '✓ Done', '✓ 已生成')
              : shareState === 'error'
                ? tx(lang, 'Failed, retry', '失败，重试')
                : tx(lang, '📤 Share card', '📤 分享长图')}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {tx(lang, BRIEFING_DISCLAIMER.en, BRIEFING_DISCLAIMER.zh)}
      </p>

      {briefingSections(latest).map(({ id, items }, si) => (
        <SectionBlock key={id} b={latest} si={si} id={id} items={items} />
      ))}

      {past.length > 0 && (
        <div className="mt-4 space-y-2">
          <h4 className="text-xs font-semibold text-slate-400">
            📌 {tx(lang, 'Past briefings', '往期早报')}
          </h4>
          {past.map((b) => (
            <details key={b.date} className="rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2">
              <summary className="cursor-pointer text-xs text-slate-300">
                {b.date} · {tx(lang, '4 sections', '四栏目')}
              </summary>
              <div className="mt-1 pb-1">
                {briefingSections(b).map(({ id, items }, si) => (
                  <SectionBlock key={id} b={b} si={si} id={id} items={items} />
                ))}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
