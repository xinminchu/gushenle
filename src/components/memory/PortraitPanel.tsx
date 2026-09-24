// src/components/memory/PortraitPanel.tsx
// 我的投资画像：卖飞率 + 买高率，只给自己看，数据只在手机本地。
'use client';

import React from 'react';
import { computePortrait, portraitSummary, PORTRAIT_MIN_SAMPLE, type PortraitSide } from '@/lib/portrait';
import type { OperationRecord } from '@/lib/operations';

interface Review { r5: number | null; r20: number | null }

function fmtDate(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${parseInt(m[2], 10)}月${parseInt(m[3], 10)}日`;
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
  if (side.rate == null) {
    const need = Math.max(0, PORTRAIT_MIN_SAMPLE - side.total);
    return (
      <div className="bg-slate-800/60 rounded-lg p-3 text-center">
        <div className="text-xs text-slate-400 mb-1">
          {emoji} {title}
        </div>
        <div className="text-sm font-bold text-slate-500">养成中</div>
        <div className="text-[10px] text-slate-500 mt-1">
          {side.total === 0 ? `记 ${PORTRAIT_MIN_SAMPLE} 笔后解锁` : `再有 ${need} 笔结果就解锁`}
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
        {side.total} 笔有结果 · {side.bad} 笔{badWord}
      </div>
      {side.worst && (
        <div className="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
          {worstWord}：{fmtDate(side.worst.op.date)}
          {side.worst.op.action === 'sell' ? '卖出' : '买入'} {side.worst.op.symbol}，
          {side.worst.pct > 0 ? '+' : ''}
          {side.worst.pct.toFixed(1)}%
        </div>
      )}
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
  const p = computePortrait(ops, reviews);
  const summary = portraitSummary(p);
  const anyData = p.sell.total > 0 || p.buy.total > 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
          🪞 我的投资画像
        </div>
        <span className="text-[10px] text-slate-500">只在你手机里，不上传</span>
      </div>

      {!anyData ? (
        <div className="text-xs text-slate-400 leading-relaxed">
          多记几笔买卖，画像会自动长出来：你是不是总卖早、是不是总买高，数据说了算。
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <SideCard
              title="卖飞率"
              emoji="🕊️"
              side={p.sell}
              badWord="卖飞"
              worstWord="最可惜"
              accent="text-amber-400"
            />
            <SideCard
              title="买高率"
              emoji="🏔️"
              side={p.buy}
              badWord="买高"
              worstWord="最惨"
              accent="text-rose-400"
            />
          </div>
          {summary && (
            <div className="text-[11px] text-slate-400 mt-2 leading-relaxed">{summary}</div>
          )}
          <div className="text-[10px] text-slate-600 mt-1.5">
            口径：卖出/买入后 20 天（不足 20 天用 5 天）涨跌；只陈述事实，不下人格判断。
          </div>
        </>
      )}
    </div>
  );
}
