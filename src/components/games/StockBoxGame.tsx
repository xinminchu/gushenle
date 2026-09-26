'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { STOCK_LIST, findStock } from '@/lib/stockList';
import { recordPlay } from '@/lib/gameStats';
import { loadWatchlist, saveWatchlist } from '@/lib/watchlist';
import {
  loadDaily,
  saveDaily,
  todayStr,
  totalPlaysToday,
  playsLeft,
  bonusPlays,
  MAX_DAILY_FREE,
} from '@/lib/stockbox';

/**
 * 🎁 股票盲盒：CS 开箱式玩法，股票主题。
 * - 点开箱 → 股票条横向滚动减速 → 落定揭晓一只真股票
 * - 稀有度五档（普通/稀有/史诗/传说/金色传说），纯游戏设定，与投资价值无关
 * - 每日免费 10 次；许愿池认同一条留言 +5 次（每条终身只加一次）
 * - 开出的股票可一键加入自选；图鉴收集放本地
 * - 底部明示：游戏稀有度 ≠ 投资建议
 */

interface Tier {
  id: string;
  name: string;
  color: string;
  weight: number;
  score: number;
  codes: string[];
}

// 镇盒之宝 / 热门龙头 / 知名成长 / 熟脸；其余自动归入普通池
const UR_CODES = ['NVDA', 'TSLA', 'GME', 'PLTR', 'COIN', 'MSTR'];
const SSR_CODES = ['AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'AVGO', 'NFLX', 'CRM', 'ORCL', 'ADBE', 'SMCI', 'DJT', 'AMC', 'MU', 'INTC', 'TSM'];
const SR_CODES = ['UBER', 'ABNB', 'SQ', 'PYPL', 'SNOW', 'CRWD', 'DDOG', 'NET', 'OKTA', 'PANW', 'ANET', 'MRVL', 'QCOM', 'ARM', 'ASML', 'DIS', 'NKE', 'SBUX', 'KO', 'PEP', 'WMT', 'COST', 'HD', 'LLY', 'JNJ', 'XOM', 'CVX', 'NIO', 'LI', 'XPEV', 'RKLB', 'IONQ', 'OKLO', 'SMR', 'ASTS', 'LUNR'];
const R_CODES = ['SHOP', 'TEAM', 'WDAY', 'NOW', 'FTNT', 'ZS', 'TXN', 'ADI', 'NXPI', 'LRCX', 'AMAT', 'KLAC', 'EA', 'TTWO', 'RBLX', 'HOOD', 'SOFI', 'AFRM', 'UPST', 'LCID', 'RIVN', 'ENPH', 'FSLR', 'SOUN', 'RCAT', 'AVAV', 'KTOS', 'JOBY', 'ACHR', 'MP', 'LAC', 'RIOT', 'MARA', 'CLSK', 'HUT', 'IREN', 'SPCX'];

const DEX_KEY = 'gushenle_stockbox_dex_v1';
const STRIP_LEN = 48;
const SPIN_MS = 3400;

type Phase = 'idle' | 'spinning' | 'reveal';

interface Pull {
  code: string;
  zh: string;
  blurb: string;
  tier: Tier;
}

function loadDex(): string[] {
  try {
    const j = JSON.parse(localStorage.getItem(DEX_KEY) || '[]');
    return Array.isArray(j) ? j.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** 极简音效：滚动 tick + 揭晓和弦，无外部资源 */
function useBlip() {
  const ctxRef = useRef<AudioContext | null>(null);
  const [muted, setMuted] = useState(false);
  const blip = (freq: number, dur = 0.05, type: OscillatorType = 'square', vol = 0.03) => {
    if (muted) return;
    try {
      ctxRef.current = ctxRef.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const ctx = ctxRef.current;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + dur);
    } catch {}
  };
  return { blip, muted, setMuted };
}

export default function StockBoxGame({ onGoEndorse }: { onGoEndorse?: () => void }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [strip, setStrip] = useState<Pull[]>([]);
  const [pull, setPull] = useState<Pull | null>(null);
  const [quote, setQuote] = useState<{ price: number | null; chg: number | null } | null>(null);
  const [daily, setDaily] = useState(loadDaily);
  const [dex, setDex] = useState<string[]>(loadDex);
  const [showDex, setShowDex] = useState(false);
  const [hint, setHint] = useState('');
  const [inWatch, setInWatch] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const lastTickRef = useRef(0);
  const { blip, muted, setMuted } = useBlip();

  // ---- 奖池：高稀有度显式名单有效项 + 其余全部归入普通 ----
  const tiers: Tier[] = useMemo(() => {
    const valid = (codes: string[]) =>
      codes.filter((c) => findStock(c));
    const used = new Set([...UR_CODES, ...SSR_CODES, ...SR_CODES, ...R_CODES]);
    const rest = [...new Set(STOCK_LIST.map((s) => s.code))].filter((c) => !used.has(c));
    return [
      { id: 'N', name: '普通', color: '#7dd3fc', weight: 60, score: 10, codes: rest },
      { id: 'R', name: '稀有', color: '#c084fc', weight: 25, score: 30, codes: valid(R_CODES) },
      { id: 'SR', name: '史诗', color: '#f472b6', weight: 10, score: 80, codes: valid(SR_CODES) },
      { id: 'SSR', name: '传说', color: '#f87171', weight: 4, score: 200, codes: valid(SSR_CODES) },
      { id: 'UR', name: '金色传说', color: '#fbbf24', weight: 1, score: 500, codes: valid(UR_CODES) },
    ];
  }, []);

  const poolAll = useMemo(
    () => tiers.flatMap((t) => t.codes.map((code) => ({ code, tier: t }))),
    [tiers]
  );
  const totalPool = poolAll.length;

  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const drawPull = (): Pull => {
    const totalW = tiers.reduce((a, t) => a + t.weight, 0);
    let r = Math.random() * totalW;
    let tier = tiers[0];
    for (const t of tiers) {
      r -= t.weight;
      if (r <= 0) { tier = t; break; }
    }
    const code = tier.codes[Math.floor(Math.random() * tier.codes.length)];
    const info = findStock(code);
    return { code, zh: info?.zh || code, blurb: info?.blurb || '', tier };
  };

  const fetchQuote = async (symbol: string) => {
    try {
      const r = await fetch(`/api/rhythm?symbol=${encodeURIComponent(symbol)}&range=1M`);
      const j = await r.json();
      const price = typeof j.priceLive === 'number' ? j.priceLive : typeof j.price === 'number' ? j.price : null;
      const chg = typeof j.dayChangePct === 'number' ? j.dayChangePct : null;
      setQuote({ price, chg });
    } catch {
      setQuote(null);
    }
  };

  const openBox = () => {
    if (phase === 'spinning') return;
    const d = loadDaily();
    const total = totalPlaysToday();
    if (d.count >= total) {
      setHint(`今日 ${total} 次已开完，明天再来试手气`);
      return;
    }
    setHint('');
    setQuote(null);
    const result = drawPull();
    // 滚动条：前面随机填充，最后一位是结果
    const items: Pull[] = [];
    for (let i = 0; i < STRIP_LEN - 1; i++) {
      const p = poolAll[Math.floor(Math.random() * poolAll.length)];
      const info = findStock(p.code);
      items.push({ code: p.code, zh: info?.zh || p.code, blurb: '', tier: p.tier });
    }
    items.push(result);
    setStrip(items);
    setPull(result);
    setInWatch(loadWatchlist().items.some((w) => w.symbol === result.code));
    setPhase('spinning');

    // 减速动画：easeOutQuint，3.4 秒落定
    const wrapW = wrapRef.current?.clientWidth || 320;
    const step = 84; // 卡片 76 + 间隔 8
    const targetX = -((STRIP_LEN - 1) * step + step / 2 - wrapW / 2);
    const t0 = performance.now();
    lastTickRef.current = 0;
    const frame = (t: number) => {
      const p = Math.min(1, (t - t0) / SPIN_MS);
      const e = 1 - Math.pow(1 - p, 5);
      const x = targetX * e;
      if (stripRef.current) stripRef.current.style.transform = `translateX(${x}px)`;
      const idx = Math.floor(-x / step);
      if (idx !== lastTickRef.current) {
        lastTickRef.current = idx;
        blip(300 + p * 500, 0.03);
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        blip(660, 0.12, 'triangle', 0.06);
        setTimeout(() => blip(880, 0.2, 'triangle', 0.06), 120);
        const nd = { date: todayStr(), count: d.count + 1 };
        saveDaily(nd);
        setDaily(nd);
        setDex((prev) => {
          const next = prev.includes(result.code) ? prev : [...prev, result.code];
          try { localStorage.setItem(DEX_KEY, JSON.stringify(next)); } catch {}
          return next;
        });
        recordPlay('stockbox', result.tier.score);
        setPhase('reveal');
        fetchQuote(result.code);
      }
    };
    rafRef.current = requestAnimationFrame(frame);
  };

  const addToWatch = () => {
    if (!pull || inWatch) return;
    const wl = loadWatchlist();
    saveWatchlist([...wl.items, { symbol: pull.code, name: pull.zh }]);
    setInWatch(true);
    setHint(`已加入自选，去今日页看它的律动诊断`);
  };

  const usedToday = daily.date === todayStr() ? daily.count : 0;
  const left = playsLeft(usedToday);
  const bonus = bonusPlays();
  const dexByTier = tiers.map((t) => ({
    tier: t,
    got: t.codes.filter((c) => dex.includes(c)).length,
  }));

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-100">🎁 股票盲盒</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            创意 💡 @icey.bulbasa · 今日剩余 <span className="text-amber-300 font-bold">{left}</span> 次
            <span className="text-slate-500">（免费{MAX_DAILY_FREE}{bonus > 0 ? `＋认同加成${bonus}` : ''}）</span>
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setShowDex((v) => !v)}
            className="text-[11px] px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300"
          >
            图鉴 {dex.length}/{totalPool}
          </button>
          <button
            onClick={() => setMuted((v) => !v)}
            className="text-[11px] px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300"
            aria-label="声音开关"
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* 稀有度说明 */}
      <div className="flex flex-wrap gap-1.5">
        {[...tiers].reverse().map((t) => (
          <span
            key={t.id}
            className="text-[10px] px-2 py-0.5 rounded-full border"
            style={{ color: t.color, borderColor: `${t.color}55`, background: `${t.color}11` }}
          >
            {t.name} {t.weight}%
          </span>
        ))}
      </div>

      {/* 滚动条 */}
      <div className="relative">
        <div ref={wrapRef} className="overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/80 py-3">
          {phase === 'idle' && !pull ? (
            <p className="text-center text-xs text-slate-500 py-4">点下方开箱，看看今天是什么命 🎲</p>
          ) : (
            <div ref={stripRef} className="flex gap-2 px-2 will-change-transform" style={{ width: 'max-content' }}>
              {strip.map((it, i) => (
                <div
                  key={i}
                  className="w-[76px] shrink-0 rounded-lg border bg-slate-800/90 px-1 py-2 text-center"
                  style={{ borderColor: `${it.tier.color}66` }}
                >
                  <div className="text-[13px] font-bold text-slate-100 truncate">{it.code}</div>
                  <div className="text-[9px] text-slate-500 truncate mt-0.5">{it.zh}</div>
                  <div className="mx-auto mt-1 h-1 w-8 rounded-full" style={{ background: it.tier.color }} />
                </div>
              ))}
            </div>
          )}
        </div>
        {/* 中线 */}
        {phase !== 'idle' && (
          <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-amber-400/80 -translate-x-1/2 pointer-events-none" />
        )}
      </div>

      {/* 揭晓卡 */}
      {phase === 'reveal' && pull && (
        <div
          className="rounded-2xl border p-4 text-center animate-[pop_0.3s_ease-out]"
          style={{
            borderColor: `${pull.tier.color}88`,
            background: `linear-gradient(180deg, ${pull.tier.color}22, rgba(15,23,42,0.9))`,
            boxShadow: `0 0 24px ${pull.tier.color}44`,
          }}
        >
          <div className="text-xs font-bold tracking-widest" style={{ color: pull.tier.color }}>
            {pull.tier.id === 'UR' ? '✨ 金色传说 ✨' : `${pull.tier.name}！`}
          </div>
          <div className="text-2xl font-black text-slate-50 mt-1">{pull.code}</div>
          <div className="text-sm text-slate-300">{pull.zh}</div>
          {pull.blurb && <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">{pull.blurb}</p>}
          {quote && quote.price !== null && (
            <p className="text-[11px] mt-1.5 text-slate-400">
              现价 <span className="text-slate-200 font-bold">${quote.price}</span>
              {quote.chg !== null && (
                <span className={`font-bold ml-1 ${quote.chg >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {quote.chg >= 0 ? '+' : ''}{(quote.chg * 100).toFixed(2)}%
                </span>
              )}
              <span className="text-slate-600"> · 今日</span>
            </p>
          )}
          <div className="flex gap-2 justify-center mt-3 flex-wrap">
            <button
              onClick={addToWatch}
              disabled={inWatch}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                inWatch
                  ? 'border-slate-700 text-slate-500'
                  : 'border-amber-500/50 bg-amber-500/15 text-amber-300'
              }`}
            >
              {inWatch ? '已在自选 ✓' : '＋ 加入自选'}
            </button>
            {left <= 0 && (
              <button
                onClick={() => setPhase('idle')}
                className="text-xs px-3 py-1.5 rounded-full border border-slate-600 bg-slate-800 text-slate-200"
              >
                ← 返回
              </button>
            )}
            {left <= 0 && onGoEndorse && (
              <button
                onClick={onGoEndorse}
                className="text-xs px-3 py-1.5 rounded-full border border-amber-500/60 bg-amber-500/20 text-amber-200 font-bold"
              >
                🤝 去认同 +5 次
              </button>
            )}
          </div>
          {/* 剩余次数倒数：揭晓时也能看到 */}
          <p className="text-center text-[11px] text-slate-500 mt-2">
            今日剩余 <span className="text-amber-300 font-bold">{left}</span> 次
            {left <= 0 && ' · 认同许愿可再 +5 次'}
          </p>
        </div>
      )}

      {/* 开箱按钮 */}
      {phase !== 'spinning' && (
        <button
          onClick={openBox}
          disabled={left <= 0 && phase === 'idle' && !pull}
          className={`w-full py-3 rounded-2xl font-bold text-sm transition active:scale-[0.98] ${
            left <= 0
              ? 'bg-slate-800 text-slate-500'
              : 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20'
          }`}
        >
          {left <= 0 ? '今日次数用完，明天再来' : pull ? '再开一次 🎁' : '开箱 🎁'}
        </button>
      )}
      {/* 次数用完：给出去认同的路 */}
      {left <= 0 && phase !== 'spinning' && onGoEndorse && (
        <button
          onClick={onGoEndorse}
          className="w-full py-2.5 rounded-2xl text-sm font-bold border border-amber-500/50 bg-amber-500/15 text-amber-300 active:scale-[0.98] transition"
        >
          🤝 去许愿池认同，每条 +5 次
        </button>
      )}
      {phase === 'spinning' && (
        <p className="text-center text-xs text-amber-300/90 animate-pulse">开箱中……屏住呼吸</p>
      )}
      {hint && <p className="text-center text-[11px] text-slate-400">{hint}</p>}

      {/* 图鉴 */}
      {showDex && (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-3 space-y-2">
          <p className="text-xs font-bold text-slate-200">📖 收集图鉴 {dex.length}/{totalPool}</p>
          {dexByTier.map(({ tier, got }) => (
            <div key={tier.id}>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span style={{ color: tier.color }}>{tier.name}</span>
                <span className="text-slate-500">{got}/{tier.codes.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: tier.codes.length ? `${(got / tier.codes.length) * 100}%` : '0%',
                    background: tier.color,
                  }}
                />
              </div>
            </div>
          ))}
          {dex.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {dex.map((c) => {
                const t = tiers.find((x) => x.codes.includes(c));
                const info = findStock(c);
                return (
                  <span
                    key={c}
                    className="text-[10px] px-1.5 py-0.5 rounded border border-slate-700 text-slate-300"
                    title={info?.zh}
                  >
                    <span style={{ color: t?.color }}>●</span> {c}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-slate-600 leading-relaxed">
        稀有度是游戏设定，与公司好坏、涨跌无关，不构成投资建议。开出的股票不代表推荐，加入自选后请去今日页看律动诊断再自己判断。
      </p>

      <style>{`@keyframes pop { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
    </div>
  );
}
