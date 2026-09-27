'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';

/** 首页三行的大白话标题（用户定版；中间行名字暂定） */
const HOT_LABEL = '涨得欢';
const MIDDLE_LABEL = '看一眼';
const COLD_LABEL = '跌得凶';

interface ScanItem {
  symbol: string;
  name: string;
  score: number;
  changePct: number | null;
  upStreak?: number | null;
  downStreak?: number | null;
}

interface ScanPayload {
  ok: boolean;
  empty?: boolean;
  scanDate?: string;
  hot?: ScanItem[];
  middle?: ScanItem[];
  cold?: ScanItem[];
  /** 中间行是否经过"近20天净流入为正"过滤 */
  flowFilter?: boolean;
}

/**
 * 首页「今日信号」：每天收盘后批处理扫精选池，摆三行
 * 🔥 涨得欢：冲高过热，按分从高到低前 5 —— 慎追，当心套牢（栏杆，淡红底）
 * 👀 看一眼：离50由近到远、50上下成对比较，留近20天净流入为正者；
 *   都为正取20天净流入大者 —— 中间行名字暂定（淡绿底，观察中）
 * 🥶 跌得凶：分最低的 5 只（跌过头判定天然排最前）—— 不割肉，不抄底（栏杆，淡红底）
 * 不展示律动分；连涨/连跌≥3 天在 tile 上打标（平盘打断）；点一只直接跳到它的价格走势。
 * 只展示数据 + 大白话，不做买入推荐。
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

  if (
    !data ||
    !data.hot ||
    (data.hot.length === 0 && (data.middle || []).length === 0 && (data.cold || []).length === 0)
  ) {
    return null;
  }
  const md = data.scanDate || '';
  // scanDate 是 YYYY-MM-DD（最新一根日线的日期）：中文显示"数据截至 9月25日（周五收盘）"
  function fmtScanDate(s: string): string {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const weekCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const weekEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return en
      ? `Data as of ${monthEn} ${Number(m[3])} (${weekEn} close)`
      : `数据截至 ${Number(m[2])}月${Number(m[3])}日（${weekCn}收盘）`;
  }

  // tone: 上下两行是栏杆（淡红底），中间行观察区（淡绿底）；某行空时显示"今日暂无"，栏杆一直在
  const row = (items: ScanItem[], label: string, sub: string | undefined, tone: 'red' | 'green') => (
    <div
      className={`mb-2 last:mb-0 rounded-lg border px-2 py-2 ${
        tone === 'red' ? 'bg-red-950/50 border-red-900/50' : 'bg-green-950/40 border-green-900/50'
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
              className="rounded-lg border border-slate-800 bg-slate-950/60 px-1 py-1.5 text-center active:bg-slate-800"
            >
              <div className="text-[11px] font-bold text-slate-100 leading-tight">{s.symbol}</div>
              <div className="text-[9px] text-slate-500 leading-tight truncate">{s.name}</div>
              {s.upStreak != null && s.upStreak >= 3 && (
                <div className="text-[9px] leading-tight mt-0.5 text-amber-300">
                  📈{s.upStreak}连涨
                </div>
              )}
              {s.downStreak != null && s.downStreak >= 3 && (
                <div className="text-[9px] leading-tight mt-0.5 text-sky-300">
                  📉{s.downStreak}连跌
                </div>
              )}
              <div
                className={`text-[9px] tabular-nums ${
                  s.changePct == null
                    ? 'text-slate-500'
                    : up
                      ? 'text-emerald-300'
                      : 'text-rose-300'
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
          {en ? 'none today' : '今日暂无'}
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-100">
          📡 {en ? 'Market Signals' : '今日信号'}
          {md && <span className="text-[10px] font-normal text-slate-500 ml-1.5">📅 {fmtScanDate(md)}</span>}
        </span>
        <span className="text-[10px] text-slate-500">{en ? 'data only' : '只摆数据·仅供参考'}</span>
      </div>
      {row(
        data.hot,
        `🔥 ${HOT_LABEL}`,
        en ? 'don\u2019t chase, beware of getting trapped' : '慎追，当心套牢',
        'red',
      )}
      {row(
        data.middle || [],
        `👀 ${MIDDLE_LABEL}`,
        en
          ? data.flowFilter
            ? 'near 50 · 20-day net inflow'
            : 'closest to score 50'
          : data.flowFilter
            ? '离50近 · 近20天买入多'
            : '离50分最近',
        'green',
      )}
      {row(
        data.cold || [],
        `🥶 ${COLD_LABEL}`,
        en ? 'don\u2019t sell the bottom, don\u2019t catch the knife' : '不割肉，不抄底',
        'red',
      )}
      <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
        {en
          ? '📌 Hot: don\u2019t chase, beware of getting trapped; Cold: neither sell the bottom nor catch the knife; Take a look: net inflow — all three describe conditions, you make your own calls.'
          : '📌 涨得欢：慎追，当心套牢；跌得凶：不割肉，不抄底；看一眼：买入多——三行都是状态，买卖自己定。'}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
        {en
          ? '📊 Streaks count consecutive up/down closes; shown only at 3+ days, a flat day breaks the streak.'
          : '📊 连涨/连跌按收盘价连续天数算，满 3 天才标，平盘打断。'}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
        {en
          ? '👀 Middle: pairs nearest to 50 above/below; keep 20-day net inflow; both positive → larger 20-day inflow wins.'
          : '👀 中间行取法：离50由近到远、上下成对比较，留近20天买入多者；都多时取20天净流入大者。'}
      </div>
    </div>
  );
}
