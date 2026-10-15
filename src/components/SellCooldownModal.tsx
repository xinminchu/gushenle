'use client';

import type { CooldownData } from '@/lib/sellCooldown';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 卖出冷静三眼：浮亏深 + 信号"跌不动了"/"跌过头了"时，记卖出前先看三眼。
 * 摩擦不是拦截：用户仍可继续卖出。
 */

function verdictText(lang: string, d: CooldownData): { text: string; cls: string } {
  const s = d.stat;
  if (!s || s.total === 0)
    return { text: tx(lang, 'No history for this signal yet', '这个信号过去还没出现过'), cls: 'text-slate-500' };
  if (s.edge == null || s.accuracy == null)
    return { text: tx(lang, 'Not enough samples', '样本还不够'), cls: 'text-slate-500' };
  const base = tx(
    lang,
    `"${d.statusLabel}" appeared ${s.total}×, hit rate ${s.accuracy}%`,
    `「${d.statusLabel}」过去出现 ${s.total} 次，应验率 ${s.accuracy}%`,
  );
  if (s.edge >= 5)
    return { text: `${base} — ${tx(lang, 'reliable, worth a second thought', '比较准，多掂量一下')}`, cls: 'text-emerald-400' };
  if (s.edge <= -5)
    return { text: `${base} — ${tx(lang, 'often wrong, take with a grain of salt', '经常报错，别太当真')}`, cls: 'text-rose-400' };
  return { text: `${base} — ${tx(lang, 'barely better than guessing', '跟瞎猜差不多')}`, cls: 'text-slate-500' };
}

export default function SellCooldownModal({
  data,
  onCancel,
  onProceed,
}: {
  data: CooldownData;
  onCancel: () => void;
  onProceed: () => void;
}) {
  const { lang } = useLanguage();
  const v = verdictText(lang, data);
  const belowCost = ((data.price - data.avgCost) / data.avgCost) * 100;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-600/50 bg-slate-900 p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="text-base font-bold text-slate-100">
            {tx(lang, '⏸️ Cooling down — 3 things first', '⏸️ 先冷静一下，看三眼')}
          </h3>
          <p className="mt-1 text-[13px] text-slate-400">
            {tx(
              lang,
              `${data.symbol} is down ${Math.abs(data.lossPct).toFixed(1)}% from your cost and showing "${data.statusLabel}". Nothing is blocked — just look first.`,
              `${data.symbol} 已浮亏 ${Math.abs(data.lossPct).toFixed(1)}%，信号是「${data.statusLabel}」。不拦你卖出，先看三眼再决定。`,
            )}
          </p>
        </div>

        {/* 一、买入理由 */}
        <div className="rounded-xl bg-slate-800/60 px-3.5 py-3">
          <p className="text-xs font-semibold text-slate-300">
            {tx(lang, '1 · Why did you buy it?', '一、你当初为什么买？')}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
            {data.thesis ??
              tx(lang, 'No buy thesis on record.', '没找到你当初的买入理由。')}
          </p>
        </div>

        {/* 二、信号应验率 */}
        <div className="rounded-xl bg-slate-800/60 px-3.5 py-3">
          <p className="text-xs font-semibold text-slate-300">
            {tx(lang, '2 · How reliable is this signal?', '二、这个信号过去准不准？')}
          </p>
          <p className={`mt-1 text-[13px] leading-relaxed ${v.cls}`}>{v.text}</p>
        </div>

        {/* 三、回本线 */}
        <div className="rounded-xl bg-slate-800/60 px-3.5 py-3">
          <p className="text-xs font-semibold text-slate-300">
            {tx(lang, '3 · Where is your break-even?', '三、回本线在哪？')}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
            {tx(
              lang,
              `Break-even $${data.avgCost.toFixed(2)} — current price is ${Math.abs(belowCost).toFixed(1)}% below it.`,
              `回本线 $${data.avgCost.toFixed(2)}，现价低于回本线 ${Math.abs(belowCost).toFixed(1)}%。`,
            )}
            {data.recentLow != null &&
              tx(
                lang,
                ` 3-month low zone near $${data.recentLow.toFixed(2)}.`,
                ` 近 3 个月低点区间在 $${data.recentLow.toFixed(2)} 附近。`,
              )}
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-500 text-white py-2.5 text-sm font-semibold active:scale-95 transition"
          >
            {tx(lang, 'Think again', '再想想')}
          </button>
          <button
            onClick={onProceed}
            className="flex-1 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 text-sm font-medium active:scale-95 transition"
          >
            {tx(lang, 'Sell anyway', '仍要卖出')}
          </button>
        </div>
      </div>
    </div>
  );
}
