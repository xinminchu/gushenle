'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { displayStockName } from '@/lib/stockList';
import { tx } from '@/lib/hant';

/** 首页三行的大白话标题（用户定版；中间行名字暂定） */

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
  /** 每行实际用的数据日期（空行回补时与 scanDate 不同） */
  rowDates?: { hot: string; middle: string; cold: string };
  /** 中间行是否经过"近20天流入（估算）为正"过滤 */
  flowFilter?: boolean;
}

/**
 * 首页「今日信号」：每天收盘后批处理扫精选池，摆三行
 * 🔥 涨得欢：冲高过热，按分从高到低前 5 —— 慎追，当心套牢（红框栏杆）
 * 👀 看一眼：离50由近到远、50上下成对比较，留近20天流入（估算）为正者；
 *   都为正取20天流入（估算）大者 —— 中间行名字暂定（绿框观察区）
 * 🥶 跌得凶：分最低的 5 只（跌过头判定天然排最前）—— 慎割肉，慎抄底（红框栏杆）
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
  // "2026-09-25" → "9月25日" / "Sep 25"（回补行标注用）
  function shortDate(s: string): string {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    if (en) {
      const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${monthEn[Number(m[2]) - 1]} ${Number(m[3])}`;
    }
    return `${Number(m[2])}月${Number(m[3])}日`;
  }
  // 某行用了回补的旧数据：标注"（9月25日数据）"，跟当天数据区分开
  const asOfNote = (k: 'hot' | 'middle' | 'cold'): string => {
    const rd = data.rowDates;
    if (!rd || !rd[k] || rd[k] === md) return '';
    return tx(lang, `(${shortDate(rd[k])} data)`, `（${shortDate(rd[k])}数据）`);
  };
  // scanDate 是 YYYY-MM-DD（最新一根日线的日期）：中文显示"数据截至 9月25日（周五收盘）"
  function fmtScanDate(s: string): string {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const weekCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const weekEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return tx(lang, `Data as of ${monthEn} ${Number(m[3])} (${weekEn} close)`, `数据截至 ${Number(m[2])}月${Number(m[3])}日（${weekCn}收盘）`);
  }

  // tone: 三行去背景，只留边框 —— 上下红框（栏杆），中间绿框（观察区）；某行空时显示"今日暂无"
  // asOfNote：该行用了回补的旧数据时标注日期，如"（9月25日数据）"
  const row = (items: ScanItem[], label: string, sub: string | undefined, tone: 'red' | 'green', asOfNote?: string) => (
    <div
      className={`mb-2 last:mb-0 rounded-lg border px-2 py-2 ${
        tone === 'red' ? 'border-red-500/70' : 'border-green-500/70'
      }`}
    >
      <div className="mb-1.5">
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        {sub && <span className="text-[10px] text-slate-500 ml-1.5">{sub}</span>}
        {asOfNote && <span className="text-[10px] text-slate-500 ml-1">{asOfNote}</span>}
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
              <div className="text-[9px] text-slate-500 leading-tight truncate">{displayStockName(s.symbol, lang, s.name)}</div>
              {s.upStreak != null && s.upStreak >= 3 && (
                <div className="text-[9px] leading-tight mt-0.5 text-amber-300">
                  📈{s.upStreak}{tx(lang, '-day rise', '连涨')}
                </div>
              )}
              {s.downStreak != null && s.downStreak >= 3 && (
                <div className="text-[9px] leading-tight mt-0.5 text-sky-300">
                  📉{s.downStreak}{tx(lang, '-day slide', '连跌')}
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
          {tx(lang, 'none today', '今日暂无')}
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-100">
          📡 {tx(lang, 'Market Signals', '今日信号')}
          {md && <span className="text-[10px] font-normal text-slate-500 ml-1.5">📅 {fmtScanDate(md)}</span>}
        </span>
        <span className="text-[10px] text-slate-500">{tx(lang, 'data only', '只摆数据·仅供参考')}</span>
      </div>
      {row(
        data.hot,
        `🔥 ${tx(lang, 'Hot', '涨得欢')}`,
        tx(lang, 'don\u2019t chase, beware of getting trapped', '慎追，当心套牢'),
        'red',
        asOfNote('hot'),
      )}
      {row(
        data.middle || [],
        `👀 ${tx(lang, 'Worth a look', '看一眼')}`,
        tx(lang, data.flowFilter
            ? 'near 50 · 20-day inflow (est.)'
            : 'closest to score 50', data.flowFilter
            ? '离50近 · 近20天买入多'
            : '离50分最近'),
        'green',
        asOfNote('middle'),
      )}
      {row(
        data.cold || [],
        `🥶 ${tx(lang, 'Cold', '跌得凶')}`,
        tx(lang, 'be careful about selling the bottom or catching the knife', '慎割肉，慎抄底'),
        'red',
        asOfNote('cold'),
      )}
      <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
        {tx(lang, '📌 Hot: don\u2019t chase, beware of getting trapped; Cold: be careful about selling the bottom or catching the knife; Take a look: inflow (est.) — all three describe conditions, you make your own calls.', '📌 涨得欢：慎追，当心套牢；跌得凶：慎割肉，慎抄底；看一眼：买入多——三行都是状态，买卖自己定。')}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
        {tx(lang, '📊 Streaks count consecutive up/down closes; shown only at 3+ days, a flat day breaks the streak.', '📊 连涨/连跌按收盘价连续天数算，满 3 天才标，平盘打断。')}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
        {tx(lang, '👀 Middle: pairs nearest to 50 above/below; keep 20-day inflow (est.); both positive → larger 20-day inflow (est.) wins.', '👀 中间行取法：离50由近到远、上下成对比较，留近20天买入多者；都多时取20天流入（估算）大者。')}
      </div>
    </div>
  );
}
