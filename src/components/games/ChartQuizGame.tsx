'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import { zh2hant } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';
import {
  CHART_PATTERNS,
  CHART_THEMES,
  patternById,
  type ChartPattern,
  type ChartThemeKey,
} from '@/lib/chartPatterns';
import { LETTERS, PRAISES, shuffle } from '@/lib/encyclopedia';
import { recordPlay } from '@/lib/gameStats';

interface QuizItem {
  id: string;
  options: string[];
  answer: number;
}

function themeOf(p: ChartPattern) {
  return CHART_THEMES.find((t) => t.key === p.theme);
}

/** 为一道题配 3 个干扰项：优先同主题，不够再从全库补 */
function buildItem(p: ChartPattern, pool: ChartPattern[]): QuizItem {
  const sameTheme = shuffle(pool.filter((x) => x.id !== p.id && x.theme === p.theme));
  const others = shuffle(pool.filter((x) => x.id !== p.id && x.theme !== p.theme));
  const distract = [...sameTheme, ...others].slice(0, 3).map((x) => x.name);
  const options = shuffle([p.name, ...distract]);
  return { id: p.id, options, answer: options.indexOf(p.name) };
}

const DIFF_STARS = ['★☆☆', '★★☆', '★★★'];

export default function ChartQuizGame() {
  const { lang } = useLanguage();
  const [view, setView] = useState<'home' | 'quiz'>('home');
  const [theme, setTheme] = useState<ChartThemeKey | 'all'>('all');

  const [queue, setQueue] = useState<QuizItem[]>([]);
  const [qi, setQi] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [phase, setPhase] = useState<'answering' | 'revealed'>('answering');
  const [wrong, setWrong] = useState(0);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [praise, setPraise] = useState('');
  const [gained, setGained] = useState(0);
  const [reshuffleToast, setReshuffleToast] = useState(false);

  const [sessionScore, setSessionScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const sessionScoreRef = useRef(0);
  const topRef = useRef<HTMLDivElement>(null);

  // 关闭游戏时结算本局积分
  useEffect(() => {
    return () => {
      recordPlay('chartquiz', sessionScoreRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pool = useMemo(
    () => (theme === 'all' ? CHART_PATTERNS : CHART_PATTERNS.filter((p) => p.theme === theme)),
    [theme]
  );

  const item = queue.length > 0 ? queue[qi] : undefined;
  const pattern = item ? patternById(item.id) : undefined;
  const pTheme = pattern ? themeOf(pattern) : undefined;

  const resetQuestionState = () => {
    setPicked(null);
    setPhase('answering');
    setWrong(0);
    setWasCorrect(false);
    setPraise('');
    setGained(0);
  };

  const startQuiz = () => {
    if (pool.length === 0) return;
    setQueue(shuffle(pool).map((p) => buildItem(p, pool)));
    setQi(0);
    resetQuestionState();
    setView('quiz');
  };

  const scrollTop = () => {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start' }));
  };

  const addScore = (pts: number) => {
    setGained(pts);
    setPraise(zh2hant(lang, PRAISES[Math.floor(Math.random() * PRAISES.length)]));
    setSessionScore((s) => {
      const n = s + pts;
      sessionScoreRef.current = n;
      return n;
    });
  };

  const pick = (i: number) => {
    if (!item || phase !== 'answering') return;
    setPicked(i);
    if (i === item.answer) {
      addScore(wrong === 0 ? 10 : 5);
      setWasCorrect(true);
      setPhase('revealed');
      setCorrectCount((c) => c + 1);
      setAnsweredCount((c) => c + 1);
    } else if (wrong === 0) {
      setWrong(1);
    } else {
      setWasCorrect(false);
      setPhase('revealed');
      setAnsweredCount((c) => c + 1);
    }
  };

  const nextQuestion = () => {
    if (qi + 1 >= queue.length) {
      setQueue(shuffle(pool).map((p) => buildItem(p, pool)));
      setQi(0);
      setReshuffleToast(true);
      window.setTimeout(() => setReshuffleToast(false), 2600);
    } else {
      setQi((i) => i + 1);
    }
    resetQuestionState();
    scrollTop();
  };

  /* ---------------- 首页 ---------------- */
  if (view === 'home') {
    return (
      <div className="w-full m-auto">
        <div className="text-center mb-4">
          <p className="text-3xl mb-2">🖼️</p>
          <p className="text-sm font-bold text-slate-200">{zh2hant(lang, '股民必备手册 · 看图识图')}</p>
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
            {zh2hant(lang, '随机抽一张图，从 4 个选项里认出它是谁')}
            <br />
            {zh2hant(lang, 'K线 / 均线 / 形态 / 量价分时，认图如认人')}
          </p>
        </div>

        <p className="text-xs text-slate-400 mb-2">{zh2hant(lang, '选个图鉴开刷')}</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => setTheme('all')}
            className={`rounded-xl border p-3 text-left transition-all active:scale-[0.97] ${
              theme === 'all'
                ? 'border-emerald-500/60 bg-emerald-500/10'
                : 'border-slate-700 bg-slate-800/60'
            }`}
          >
            <div className="text-xl mb-1">🖼️</div>
            <div className="text-xs font-bold text-slate-200">{zh2hant(lang, '全部图鉴')}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{zh2hant(lang, `${CHART_PATTERNS.length} 张图`)}</div>
          </button>
          {CHART_THEMES.map((t) => {
            const n = CHART_PATTERNS.filter((x) => x.theme === t.key).length;
            const active = theme === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTheme(t.key)}
                className={`rounded-xl border p-3 text-left transition-all active:scale-[0.97] ${
                  active
                    ? 'border-emerald-500/60 bg-emerald-500/10'
                    : 'border-slate-700 bg-slate-800/60'
                }`}
              >
                <div className="text-xl mb-1">{t.emoji}</div>
                <div className="text-xs font-bold text-slate-200">{zh2hant(lang, t.name)}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {zh2hant(lang, `${n} 张图 · ${t.desc}`)}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={startQuiz}
          className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm active:scale-[0.98] transition-transform"
        >
          {zh2hant(lang, `开始认图（共 ${pool.length} 张）`)}
        </button>
        <p className="text-[11px] text-slate-500 text-center leading-relaxed mt-3">
          {zh2hant(lang, '一次答对 +10 分，第二次答对 +5 分')}
          <br />
          {zh2hant(lang, '第一次答错可以再试，第二次才公布答案 · 刷完一轮自动洗牌')}
          <br />
          <span className="text-slate-600">{zh2hant(lang, '仅供学习交流，不构成任何投资建议')}</span>
        </p>
      </div>
    );
  }

  /* ---------------- 答题 ---------------- */
  if (!item || !pattern) return null;
  const Art = pattern.art;
  return (
    <div className="w-full m-auto relative" ref={topRef}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setView('home')}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" /> {zh2hant(lang, '换图鉴')}
        </button>
        <div className="text-[11px] text-slate-500">
          {zh2hant(lang, `第 ${qi + 1} / ${queue.length} 题 · 答对 ${correctCount}/${answeredCount}`)}
        </div>
        <div className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-lg px-2 py-1">
          {zh2hant(lang, `${sessionScore} 分`)}
        </div>
      </div>

      {reshuffleToast && (
        <div className="mb-2 text-center text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg py-1.5">
          {zh2hant(lang, '♻️ 一轮刷完，已重新洗牌继续')}
        </div>
      )}

      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[11px] text-slate-300 bg-slate-700/70 rounded-md px-1.5 py-0.5">
            {pTheme?.emoji} {pTheme ? zh2hant(lang, pTheme.name) : ''}
          </span>
          <span className="text-[10px] text-amber-400">{DIFF_STARS[pattern.difficulty - 1]}</span>
        </div>

        <p className="text-[15px] text-slate-100 font-medium mb-3">{zh2hant(lang, '下面这张图是什么？')}</p>

        {/* 题干：图 */}
        <div className="mb-4">
          <Art />
        </div>

        {/* 选项 */}
        <div className="space-y-2">
          {item.options.map((opt, i) => {
            const isAnswer = i === item.answer;
            const isPicked = picked === i;
            let cls = 'border-slate-700 bg-slate-800/80 hover:border-slate-500';
            if (phase === 'revealed') {
              if (isAnswer) cls = 'border-emerald-500/70 bg-emerald-500/15';
              else if (isPicked) cls = 'border-red-500/60 bg-red-500/10';
              else cls = 'border-slate-700 bg-slate-800/40 opacity-60';
            } else if (wrong === 1 && isPicked) {
              cls = 'border-red-500/60 bg-red-500/10';
            }
            return (
              <button
                key={i}
                disabled={phase === 'revealed'}
                onClick={() => pick(i)}
                className={`w-full flex items-center gap-2.5 text-left border rounded-xl px-3 py-2.5 text-sm transition-all active:scale-[0.99] ${cls}`}
              >
                <span
                  className={`shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    phase === 'revealed' && isAnswer
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {LETTERS[i]}
                </span>
                <span className="text-slate-200 font-medium">{zh2hant(lang, opt)}</span>
              </button>
            );
          })}
        </div>

        {phase === 'answering' && wrong === 1 && (
          <div className="mt-3 text-center text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl py-2">
            {zh2hant(lang, '不对，再仔细看看图 💪 还有一次机会')}
          </div>
        )}

        {phase === 'revealed' && (
          <div className="mt-3 space-y-2">
            <div
              className={`text-center text-sm font-bold rounded-xl py-2 ${
                wasCorrect
                  ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
                  : 'text-slate-300 bg-slate-700/50 border border-slate-600'
              }`}
            >
              {wasCorrect ? (
                <>
                  {praise} <span className="text-amber-300">{zh2hant(lang, `+${gained} 分`)}</span>
                </>
              ) : (
                <>{zh2hant(lang, '正确答案：')}{zh2hant(lang, item.options[item.answer])}</>
              )}
            </div>
            <div className="text-[13px] leading-relaxed text-slate-300 bg-slate-800 border border-slate-700 rounded-xl p-3">
              <span className="text-slate-500">{zh2hant(lang, '💡 解析：')}</span>
              {zh2hant(lang, pattern.explanation)}
            </div>
          </div>
        )}

        {phase === 'revealed' && (
          <button
            onClick={nextQuestion}
            className="w-full mt-3 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-1"
          >
            {zh2hant(lang, '下一张')} <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
