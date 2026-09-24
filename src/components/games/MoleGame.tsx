'use client';

import React, { useEffect, useRef, useState } from 'react';
import { recordPlay } from '@/lib/gameStats';

const HOLES = 9;
const DURATION = 45; // 秒
const TICK = 450; // 地鼠刷新节拍 ms
const MOLE_TTL = 1300; // 地鼠停留 ms

const TICKERS = ['AAPL', 'NVDA', 'TSLA', 'MSFT', 'AMZN', 'META', 'GOOGL', 'AMD', 'NFLX', 'COIN', 'MSTR', 'BABA'];
// 纯卡通形象：真人高管头像有肖像权风险，这里一律用 emoji 脸 + 西装，不对应任何真人
const FACES = ['🤵', '👩‍💼', '🧑‍💼', '👨‍💼', '🧓', '👩‍🦳'];

type Kind = 'exec' | 'short' | 'gold';
interface Mole {
  id: number;
  kind: Kind;
  ticker: string;
  face: string;
  born: number;
}
interface Floater {
  id: number;
  hole: number;
  text: string;
  good: boolean;
}

const TIPS = [
  '💡 地鼠冒头就要打？股市里追着每个热点打的人，打中的往往是"利空地鼠"。',
  '💡 金地鼠很稀有——真正的好机会也稀有，平时练的是"不乱出手"。',
  '💡 打地鼠靠反应，炒股靠耐心。反应越快的人，越要练"忍住别打"。',
];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export default function MoleGame() {
  const [holes, setHoles] = useState<(Mole | null)[]>(() => Array(HOLES).fill(null));
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [phase, setPhase] = useState<'setup' | 'playing' | 'over'>('setup');
  const [tip, setTip] = useState('');
  const idRef = useRef(0);
  const scoreRef = useRef(0);
  scoreRef.current = score;
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // 关闭弹窗时结算战绩（多局累计一次记）
  useEffect(() => {
    return () => {
      if (scoreRef.current > 0) recordPlay('mole', scoreRef.current);
    };
  }, []);

  const start = () => {
    setHoles(Array(HOLES).fill(null));
    setFloaters([]);
    setScore(0);
    setTimeLeft(DURATION);
    setTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
    setPhase('playing');
  };

  // 地鼠刷新：过期消失 + 随机冒头
  useEffect(() => {
    if (phase !== 'playing') return;
    const iv = setInterval(() => {
      const now = Date.now();
      setHoles((prev) => {
        const next = prev.map((m) => (m && now - m.born > MOLE_TTL ? null : m));
        const emptyIdx = next.map((m, i) => (m ? -1 : i)).filter((i) => i >= 0);
        if (emptyIdx.length > 0 && Math.random() < 0.85) {
          const hole = pick(emptyIdx);
          const r = Math.random();
          const kind: Kind = r < 0.08 ? 'gold' : r < 0.25 ? 'short' : 'exec';
          next[hole] = {
            id: ++idRef.current,
            kind,
            ticker: kind === 'gold' ? 'GOLD' : pick(TICKERS),
            face: kind === 'gold' ? '🤴' : kind === 'short' ? '👺' : pick(FACES),
            born: now,
          };
        }
        return next;
      });
      setFloaters((prev) => prev.filter((f) => now - f.id < 700));
    }, TICK);
    return () => clearInterval(iv);
  }, [phase]);

  // 倒计时
  useEffect(() => {
    if (phase !== 'playing') return;
    if (timeLeft <= 0) {
      setPhase('over');
      setHoles(Array(HOLES).fill(null));
      return;
    }
    const t = setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, timeLeft]);

  const whack = (i: number) => {
    if (phaseRef.current !== 'playing') return;
    const m = holes[i];
    if (!m) return;
    const delta = m.kind === 'gold' ? 30 : m.kind === 'short' ? -5 : 10;
    const text =
      m.kind === 'gold' ? '+30 金地鼠！' : m.kind === 'short' ? '−5 踩到利空！' : '+10 高管现形！';
    setScore((v) => Math.max(0, v + delta));
    setHoles((prev) => {
      const next = [...prev];
      next[i] = null;
      return next;
    });
    const fid = Date.now() + Math.random();
    setFloaters((prev) => [...prev, { id: fid, hole: i, text, good: delta > 0 }]);
  };

  return (
    <div className="w-full max-w-[340px] p-3 space-y-3">
      <style>{`
        @keyframes mole-float-up {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-28px); }
        }
        .mole-floater { animation: mole-float-up 0.7s ease-out forwards; }
        @keyframes mole-pop {
          0% { transform: scale(0.3); }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); }
        }
        .mole-pop { animation: mole-pop 0.18s ease-out; }
      `}</style>

      <div className="text-center">
        <div className="text-sm font-bold text-slate-200">🔨 高管打地鼠</div>
        <div className="text-[11px] text-slate-500 mt-0.5">
          {phase === 'playing' ? (
            <span className="tabular-nums">
              得分 <span className="text-amber-300 font-bold">{score}</span> · 剩余{' '}
              <span className="text-sky-300 font-bold">{timeLeft}s</span>
            </span>
          ) : (
            '45 秒 · 见高管就打，见利空就忍'
          )}
        </div>
      </div>

      {phase === 'setup' && (
        <div className="space-y-3">
          <div className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-1.5">
            <p>
              🤵 <span className="text-slate-100 font-semibold">高管地鼠</span>冒头就打，
              <span className="text-amber-300 font-semibold">+10 分</span>
            </p>
            <p>
              👺 <span className="text-rose-300 font-semibold">利空地鼠</span>（红色）千万别打，
              打中 <span className="text-rose-300 font-semibold">−5 分</span>——练的就是"忍住别追利空"
            </p>
            <p>
              🤴 <span className="text-amber-300 font-semibold">金地鼠</span>稀有，
              <span className="text-amber-300 font-semibold">+30 分</span>，好机会不常有
            </p>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed px-1">
            小说明：真人高管头像有肖像权风险，这里的高管全是卡通形象，不对应任何真人。
            <span className="text-violet-300/80">💡 创意来自 @麻牛</span>
          </p>
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
          >
            开打！🔨
          </button>
        </div>
      )}

      {(phase === 'playing' || phase === 'over') && (
        <div className="grid grid-cols-3 gap-2">
          {holes.map((m, i) => (
            <div key={i} className="relative aspect-square">
              {/* 洞 */}
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-4/5 h-1/3 bg-amber-950 rounded-[50%] border-2 border-amber-900" />
              {m && phase === 'playing' && (
                <button
                  onClick={() => whack(i)}
                  className={`mole-pop absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center rounded-xl px-1.5 py-1 active:scale-90 transition-transform border-2 ${
                    m.kind === 'short'
                      ? 'border-rose-500 bg-rose-950/80'
                      : m.kind === 'gold'
                        ? 'border-amber-400 bg-amber-950/80'
                        : 'border-slate-600 bg-slate-800/90'
                  }`}
                >
                  <span className="text-5xl leading-none">{m.face}</span>
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      m.kind === 'short'
                        ? 'text-rose-300'
                        : m.kind === 'gold'
                          ? 'text-amber-300'
                          : 'text-slate-300'
                    }`}
                  >
                    {m.ticker}
                  </span>
                </button>
              )}
              {floaters
                .filter((f) => f.hole === i)
                .map((f) => (
                  <span
                    key={f.id}
                    className={`mole-floater absolute top-0 left-1/2 -translate-x-1/2 text-xs font-bold whitespace-nowrap ${
                      f.good ? 'text-emerald-300' : 'text-rose-300'
                    }`}
                  >
                    {f.text}
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}

      {phase === 'over' && (
        <div className="space-y-2">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-center">
            <p className="text-sm font-bold text-slate-100">
              🔨 时间到！本局 <span className="text-amber-300">{score}</span> 分
            </p>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed px-1">{tip}</p>
          <button
            onClick={start}
            className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-bold"
          >
            再打一局
          </button>
        </div>
      )}
    </div>
  );
}
