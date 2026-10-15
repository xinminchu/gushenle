'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { displayStockName } from '@/lib/stockList';
import { getRhythm, dayChangePct } from '@/lib/market';
import { tx } from '@/lib/hant';

interface ProbeHit {
  symbol: string;
  name: string;
  score: number;
  changePct: number | null;
  upStreak?: number | null;
  downStreak?: number | null;
  probeNote: string;
}

interface ScanPayload {
  ok: boolean;
  empty?: boolean;
  scanDate?: string;
  qqq?: { changePct: number | null } | null;
  discovery?: {
    trendConfirm: ProbeHit[];
    breakout: ProbeHit[];
    relStrength: ProbeHit[];
    momentum: ProbeHit[];
    vcp: ProbeHit[];
    prevDate: string | null;
    withProbes: boolean;
  };
}

/**
 * 首页「潜力发现」：发现雷达五探针（2026-10-12 重构）。
 * 老规则（单日上穿50）本地回测无超额已下线。新规则：
 * 🚀 趋势确认：连2天HOT + 分≥55 + 流入>0 —— 本地回测前向5日 +1.42% vs 基线 +0.49%（n=114）
 * 💥 放量突破：20日新高 + RVOL≥1.5 —— 文献阈值（Minervini）
 * 🏆 相对强度：近3个月相对SPY超额前25% —— 动量文献
 * 🌊 中线动量：近6个月涨幅前20%（跳过最近1个月）—— Jegadeesh-Titman(1993)
 * 🐆 蓄势待发：VCP 波动收缩 —— 文献参数，台账收集中
 * 每只带触发事实 + 作废线；只摆数据、不做买入推荐。点一只跳到它的价格走势。
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

  const [qqqChg, setQqqChg] = useState<number | null>(null);
  const apiQqqChg = data?.qqq?.changePct ?? null;
  useEffect(() => {
    // 大盘涨跌：优先用扫描的 qqq 行；扫描没写大盘行时客户端直取兜底
    if (apiQqqChg != null) {
      setQqqChg(apiQqqChg);
      return;
    }
    if (!data) return;
    let alive = true;
    getRhythm('QQQ', '1m', { lang: 'zh' })
      .then((r) => {
        if (alive) setQqqChg(dayChangePct(r));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [apiQqqChg, !!data]);

  const disc = data?.discovery;
  if (!data || !disc) return null;
  const md = data.scanDate || '';
  // 大盘下跌日：趋势确认上榜的多为防御型抗跌，加一句 regime 说明，免得看着像"潜力股"
  const riskOff = qqqChg != null && qqqChg <= -1.5;
  // 039 未执行时 P2-P5 为空是因为没数据，不是没信号——空态文案要区分
  const noProbeData = !disc.withProbes;

  function fmtScanDate(s: string): string {
    const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return s;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const weekCn = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
    const monthEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
    const weekEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    return tx(lang, `Data as of ${monthEn} ${Number(m[3])} (${weekEn} close)`, `数据截至 ${Number(m[2])}月${Number(m[3])}日（${weekCn}收盘）`);
  }

  const probes = [
    {
      key: 'trendConfirm',
      items: disc.trendConfirm,
      icon: '🚀',
      label: tx(lang, 'Trend confirmed', '趋势确认'),
      sub: tx(lang, 'HOT 2 days · score ≥55 · inflow>0', '连2天转强 · 分≥55 · 流入>0'),
      invalid: tx(
        lang,
        'Invalid if it falls back below 50 — backtested +1.42% vs +0.49% baseline (5d, n=114), not a buy call.',
        '跌回 50 下方作废——本地回测前向5日+1.42% vs 基线+0.49%（n=114），不是买入推荐。',
      ),
      border: 'border-green-500/70',
    },
    {
      key: 'breakout',
      items: disc.breakout,
      icon: '💥',
      label: tx(lang, 'Volume breakout', '放量突破'),
      sub: tx(lang, '20-day high · RVOL ≥1.5×', '20日新高 · 量能≥1.5倍'),
      invalid: tx(
        lang,
        'Invalid if it falls back below the breakout level — false breakouts are common, watch continuation.',
        '跌回突破位下方作废——假突破常见，盯延续，不是买入推荐。',
      ),
      border: 'border-red-500/70',
    },
    {
      key: 'relStrength',
      items: disc.relStrength,
      icon: '🏆',
      label: tx(lang, 'Relative strength', '相对强度'),
      sub: tx(lang, 'top 25% excess vs SPY (3m)', '3个月跑赢大盘前25%'),
      invalid: tx(
        lang,
        'Monthly rotation list — drops out when it falls out of the top 25%.',
        '月度轮动名单——掉出前25%移出，不是买入推荐。',
      ),
      border: 'border-blue-500/70',
    },
    {
      key: 'momentum',
      items: disc.momentum,
      icon: '🌊',
      label: tx(lang, 'Mid-term momentum', '中线动量'),
      sub: tx(lang, 'top 20% 6m gain (skip latest 1m)', '6个月涨幅前20%（跳过最近1个月）'),
      invalid: tx(
        lang,
        'Monthly rotation list — momentum reverses too; data only, not a buy call.',
        '月度轮动名单——动量也会反转，只摆数据，不是买入推荐。',
      ),
      border: 'border-cyan-500/70',
    },
    {
      key: 'vcp',
      items: disc.vcp,
      icon: '🐆',
      label: tx(lang, 'Coiling up', '蓄势待发'),
      sub: tx(lang, 'volatility squeeze · above 50d · volume dry-up', '波动收缩 · 站上50日线 · 量能萎缩'),
      invalid: tx(
        lang,
        'Invalid on a breakdown — coiling can fizzle out; watch for the volume breakout.',
        '跌破盘整低点作废——蓄势也可能哑火，等放量突破确认。',
      ),
      border: 'border-purple-500/70',
    },
  ];

  const allEmpty = probes.every((p) => p.items.length === 0);

  const row = (p: (typeof probes)[number]) => (
    <div key={p.key} className={`mb-2 last:mb-0 rounded-lg border px-2 py-2 ${p.border}`}>
      <div className="mb-1.5">
        <span className="text-xs font-semibold text-slate-200">
          {p.icon} {p.label}
        </span>
        <span className="text-[10px] text-slate-500 ml-1.5">{p.sub}</span>
      </div>
      {p.items.length > 0 ? (
        <div className="grid grid-cols-5 gap-1.5">
          {p.items.map((s) => {
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
                <div className="text-[9px] leading-tight mt-0.5 text-sky-300 tabular-nums truncate px-0.5">
                  {s.probeNote}
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
          {p.key !== 'trendConfirm' && noProbeData
            ? tx(
                lang,
                'Probe data collecting — check back after the next scan.',
                '探针数据收集中，下次扫描后可见（需站长执行 039 迁移）。',
              )
            : tx(lang, 'none today', '今日暂无')}
        </div>
      )}
      {p.key === 'trendConfirm' && riskOff && (
        <div className="mt-1.5 text-[10px] leading-relaxed text-amber-200/70">
          {tx(
            lang,
            `Market down ${qqqChg}% today — these are defensive names holding up, i.e. relative strength, not offense.`,
            `大盘今日跌 ${qqqChg}%，上榜多为防御型抗跌——是相对转强，不是进攻信号。`,
          )}
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">⚠️ {p.invalid}</div>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 mb-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-slate-100">
          🔍 {tx(lang, 'Discovery radar', '潜力发现')}
          {md && <span className="text-[10px] font-normal text-slate-500 ml-1.5">📅 {fmtScanDate(md)}</span>}
        </span>
        <span className="text-[10px] text-slate-500">{tx(lang, 'data only', '只摆数据·仅供参考')}</span>
      </div>
      {allEmpty && (
        <div className="text-[10px] text-slate-500 py-2 text-center leading-relaxed">
          {tx(
            lang,
            'Probes are collecting data — results appear after the next scan.',
            '探针收集中…下次扫描后出结果（需站长执行 039 迁移）。',
          )}
        </div>
      )}
      {probes.map(row)}
      <div className="mt-2 text-[10px] leading-relaxed text-slate-500">
        {tx(
          lang,
          '📌 Five probes, five lists — no combined score. Trend-confirm is locally backtested; the rest use literature parameters with a local ledger accumulating.',
          '📌 五探针各看各的事实，不合成总分。趋势确认本地回测过，其余按文献参数，本地台账收集中。',
        )}
      </div>
      <div className="mt-1 text-[10px] leading-relaxed text-slate-600">
        {tx(
          lang,
          '📊 Single-day crosses are noise (Jegadeesh 1990) — no such signal enters this radar.',
          '📊 单日上穿是噪音（Jegadeesh 1990）——这类信号不进雷达。',
        )}
      </div>
    </div>
  );
}
