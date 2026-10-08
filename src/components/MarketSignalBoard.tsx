'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { displayStockName } from '@/lib/stockList';
import { tx } from '@/lib/hant';

interface DiscoverItem {
  symbol: string;
  name: string;
  score: number;
  changePct: number | null;
  upStreak?: number | null;
  downStreak?: number | null;
  prevScore: number;
  prevStatusKey: string;
}

interface ScanPayload {
  ok: boolean;
  empty?: boolean;
  scanDate?: string;
  discovery?: {
    emerging: DiscoverItem[];
    rebounding: DiscoverItem[];
    prevDate: string | null;
  };
}

/**
 * 首页「潜力发现」：前后两个收盘日对比，找"刚转折"的股票。
 * 🚀 趋势初起：昨天 50 分下方（非热），今天转入涨势加速/稳着涨 —— 趋势刚转正，盯确认
 * 🌱 止跌回升：昨天跌不动了/还在跌，今天转入涨势加速/稳着涨 —— 跌势扭转早期，盯延续
 * 每只带昨天→今天分数 + 作废线；只摆数据、不做买入推荐。点一只跳到它的价格走势。
 */
export default function MarketSignalBoard({ onPick }: { onPick: (symbol: string) => void }) {
  const { lang } = useLanguage();
  const en = lang === 'en';
  const [data, setData] = useState<ScanPayload | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/market-scan')
      .then((r) => r.json())
      .then((j) => {
        if (alive && j.ok && !j.empty) setData(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const disc = data?.discovery;
  if (!data || !disc) return null;
  const md = data.scanDate || '';

  function shortDate(s: string): string {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    if (en) {
      const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthEn[Number(m[2]) - 1]} ${Number(m[3])}`;
    }
    return `${Number(m[2])}月${Number(m[3])}日`;
  }
  function fmtScanDate(s: string): string {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const weekCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const weekEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return tx(lang, `Data as of ${monthEn} ${Number(m[3])} (${weekEn} close)`, `数据截至 ${Number(m[2])}月${Number(m[3])}日（${weekCn}收盘）`);
  }
  // 对比区间： "10月6日→10月7日"
  const rangeNote =
    disc.prevDate && md
      ? tx(lang, `${shortDate(disc.prevDate)} → ${shortDate(md)}`, `${shortDate(disc.prevDate)}→${shortDate(md)}`)
      : '';

  const row = (
    items: DiscoverItem[],
    label: string,
    sub: string,
    invalidLine: string,
    tone: 'green' | 'amber',
  ) => (
    <div
      className={`mb-2 last:mb-0 rounded-lg border px-2 py-2 ${
        tone === 'green' ? 'border-green-500/70' : 'border-amber-500/70'
      }`}
    >
      <div className="mb-1.5">
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        {sub && <span className="text-[10px] text-slate-500 ml-1.5">{sub}</span>}
      </div>
      {items.length > 0 ? (
        <div className="grid grid-cols-5 gap-1.5">
          {items.map((s) => {
            const up = (s.changePct ?? 0) > 0;
            return (
              <button
                key={s.symbol}
                onClick={() => onPick(s.symbol)}
                className="signal-tile rounded-lg border border-slate-800 bg-slate-950/60 px-1 py-1.5 text-center active:bg-slate-800"
              >
                <div className="text-[11px] font-bold text-slate-100 leading-tight">{s.symbol}</div>
                <div className="text-[9px] text-slate-500 leading-tight truncate">
                  {displayStockName(s.symbol, lang, s.name)}
                </div>
                <div className="text-[9px] leading-tight mt-0.5 text-sky-300 tabular-nums">
                  {Math.round(s.prevScore)}→{Math.round(s.score)}
                </div>
                <div
                  className={`text-[9px] tabular-nums ${
                    s.changePct == null ? 'text-slate-500' : up ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                >
                  {s.changePct == null ? '—' : `${up ? '+' : ''}${s.changePct}%`}
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="text-[10px] text-slate-500 py-2 text-center">
          {tx(lang, 'none today', '今日暂无')}
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">⚠️ {invalidLine}</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-100">
          🔍 {tx(lang, 'Discovery', '潜力发现')}
          {md && <span className="text-[10px] font-normal text-slate-500 ml-1.5">📅 {fmtScanDate(md)}</span>}
        </span>
        <span className="text-[10px] text-slate-500">{tx(lang, 'data only', '只摆数据·仅供参考')}</span>
      </div>
      {row(
        disc.emerging,
        `🚀 ${tx(lang, 'Trend emerging', '趋势初起')}`,
        tx(
          lang,
          `below 50 yesterday, turned up today ${rangeNote ? `· ${rangeNote}` : ''}`,
          `昨天 50 下方，今天转正${rangeNote ? ` · ${rangeNote}` : ''}`,
        ),
        tx(
          lang,
          'Invalid if it falls back below 50 — early turn, watch for confirmation, not a buy call.',
          '跌回 50 下方作废——刚转折，盯确认，不是买入推荐。',
        ),
        'green',
      )}
      {row(
        disc.rebounding,
        `🌱 ${tx(lang, 'Bottoming out', '止跌回升')}`,
        tx(
          lang,
          `was oversold yesterday, turned up today ${rangeNote ? `· ${rangeNote}` : ''}`,
          `昨天跌惨，今天转正${rangeNote ? ` · ${rangeNote}` : ''}`,
        ),
        tx(
          lang,
          'Invalid on a new low — early reversal, watch continuation, not a buy call.',
          '再创新低作废——扭转早期，盯延续，不是买入推荐。',
        ),
        'amber',
      )}
      <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
        {tx(
          lang,
          '📌 Both rows describe trend turns, not buy calls — you make your own decisions.',
          '📌 两行都是"刚转折"的状态，不是买入推荐，买卖自己定。',
        )}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
        {tx(
          lang,
          '📊 Compares the last two closes in the curated pool; false breakouts are common.',
          '📊 对比精选池内前后两个收盘日；趋势初起假突破不少见。',
        )}
      </div>
    </div>
  );
}
