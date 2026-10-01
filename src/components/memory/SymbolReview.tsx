// src/components/memory/SymbolReview.tsx
// 按标的复盘：操作记录 + 我在资讯圈的分享，按标的归类，一只一只看。
// 数据源：本地操作记忆（ops + reviews）+ 自己的资讯帖子（myPosts）。

'use client';

import React, { useMemo } from 'react';
import { tx } from '@/lib/hant';
import { verdictFor, type OperationRecord } from '@/lib/operations';
import { splitSymbols, type FamilyPost } from '@/lib/family';

interface Review { r5: number | null; r20: number | null }

interface SymStat {
  symbol: string;
  name?: string;
  buys: number;
  sells: number;
  goodBuy: number;
  highBuy: number;
  goodSell: number;
  missSell: number;
  posts: FamilyPost[];
}

export default function SymbolReview({
  ops,
  reviews,
  myPosts,
  lang,
  loggedIn,
}: {
  ops: OperationRecord[];
  reviews: Record<string, Review>;
  myPosts: FamilyPost[];
  lang: 'zh' | 'hant' | 'en';
  loggedIn: boolean;
}) {
  const stats = useMemo<SymStat[]>(() => {
    const map = new Map<string, SymStat>();
    const get = (symbol: string): SymStat => {
      const key = symbol.toUpperCase();
      let s = map.get(key);
      if (!s) {
        s = { symbol: key, buys: 0, sells: 0, goodBuy: 0, highBuy: 0, goodSell: 0, missSell: 0, posts: [] };
        map.set(key, s);
      }
      return s;
    };
    for (const op of ops) {
      const s = get(op.symbol);
      if (!s.name && op.name) s.name = op.name;
      if (op.action === 'buy') s.buys++;
      else s.sells++;
      // 复盘结论：口径与记忆页复盘小结一致（用 20 天，没有就用 5 天）
      const rv = reviews[op.id];
      if (rv) {
        const fwd = rv.r20 ?? rv.r5;
        const v = verdictFor(op.action, fwd, lang);
        if (v) {
          const real = fwd != null && Math.abs(fwd) >= 0.05;
          if (op.action === 'sell' && !v.good) s.missSell++;
          if (op.action === 'sell' && v.good && real) s.goodSell++;
          if (op.action === 'buy' && !v.good) s.highBuy++;
          if (op.action === 'buy' && v.good && real) s.goodBuy++;
        }
      }
    }
    for (const p of myPosts) {
      for (const sym of splitSymbols(p.symbol)) {
        get(sym).posts.push(p);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.buys + b.sells + b.posts.length - (a.buys + a.sells + a.posts.length),
    );
  }, [ops, reviews, myPosts, lang]);

  if (stats.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div className="text-xs font-semibold text-slate-200 mb-1">
        {tx(lang, `Review by ticker (${stats.length})`, `按标的复盘（${stats.length} 只）`)}
      </div>
      {!loggedIn && (
        <p className="text-[10px] text-slate-600 mb-2">
          {tx(lang, 'Log in to link your community posts here', '登录后，这里的复盘会关联你在资讯圈的分享')}
        </p>
      )}
      <div className="divide-y divide-slate-800/70">
        {stats.map((s) => {
          const verdicts: string[] = [];
          if (s.goodBuy > 0) verdicts.push(tx(lang, `${s.goodBuy} bought right`, `买对${s.goodBuy}`));
          if (s.highBuy > 0) verdicts.push(tx(lang, `${s.highBuy} bought high`, `买高${s.highBuy}`));
          if (s.goodSell > 0) verdicts.push(tx(lang, `${s.goodSell} sold right`, `卖对${s.goodSell}`));
          if (s.missSell > 0) verdicts.push(tx(lang, `${s.missSell} sold early`, `卖飞${s.missSell}`));
          const latest = s.posts[0];
          return (
            <div key={s.symbol} className="py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-100">
                  {s.symbol}
                  {s.name && <span className="ml-1.5 text-[11px] font-normal text-slate-500">{s.name}</span>}
                </span>
                <span className="text-[10px] text-slate-500">
                  {tx(lang, `${s.buys} buys ${s.sells} sells`, `${s.buys}买${s.sells}卖`)}
                  {s.posts.length > 0 && (
                    <span className="text-violet-400/80"> · {tx(lang, `${s.posts.length} posts`, `分享${s.posts.length}`)}</span>
                  )}
                </span>
              </div>
              {verdicts.length > 0 && (
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {tx(lang, 'Review: ', '复盘：')}{verdicts.join(' · ')}
                </div>
              )}
              {latest && (
                <div className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  <span className="mr-1">{latest.post_type === 'thesis' ? '💡' : '⚠️'}</span>
                  {latest.content.length > 60 ? `${latest.content.slice(0, 60)}…` : latest.content}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

