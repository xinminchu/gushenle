'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  PencilLine,
  Star,
  Trash2,
} from 'lucide-react';
import {
  ENCYCLOPEDIA_PURPOSE_LABEL,
  ENCYCLOPEDIA_QUESTIONS,
  ENCYCLOPEDIA_SCENARIO_LABEL,
  ENCYCLOPEDIA_THEMES,
  type EncyclopediaPurpose,
  type EncyclopediaQuestion,
  type EncyclopediaThemeKey,
} from '@/lib/encyclopediaBank';
import {
  LETTERS,
  PRAISES,
  buildPool,
  getQuestion,
  isMultiCorrect,
  loadFavorites,
  mergeCloudFavorites,
  shuffle,
  submitSuggestion,
  toggleFavorite,
} from '@/lib/encyclopedia';
import { recordPlay } from '@/lib/gameStats';
import { useAuth } from '@/context/AuthContext';
import { useNickname } from '@/hooks/useNickname';

type View = 'home' | 'quiz';
type HomeTab = 'quiz' | 'shelf';

const DIFF_STARS = ['★☆☆', '★★☆', '★★★'];

function themeOf(q: EncyclopediaQuestion) {
  return ENCYCLOPEDIA_THEMES.find((t) => t.key === q.theme);
}

export default function EncyclopediaGame() {
  const { user } = useAuth();
  const nickname = useNickname(user?.email);

  const [view, setView] = useState<View>('home');
  const [homeTab, setHomeTab] = useState<HomeTab>('quiz');
  const [theme, setTheme] = useState<EncyclopediaThemeKey | 'all'>('all');
  const [purpose, setPurpose] = useState<EncyclopediaPurpose | 'all'>('all');

  const [queue, setQueue] = useState<string[]>([]);
  const [qi, setQi] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
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

  const [favorites, setFavorites] = useState<string[]>([]);
  const [shelfOpenId, setShelfOpenId] = useState<string | null>(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestDone, setSuggestDone] = useState(false);
  const [suggestSending, setSuggestSending] = useState(false);

  const topRef = useRef<HTMLDivElement>(null);

  // 打开即加载收藏；登录用户合并云端。关闭游戏时结算本局积分。
  useEffect(() => {
    setFavorites(loadFavorites());
    void mergeCloudFavorites().then((ids) => setFavorites(ids));
    return () => {
      recordPlay('encyclopedia', sessionScoreRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const poolCount = useMemo(() => buildPool(theme, purpose).length, [theme, purpose]);

  const q = useMemo(
    () => (queue.length > 0 ? getQuestion(queue[qi]) : undefined),
    [queue, qi]
  );
  const qTheme = q ? themeOf(q) : undefined;

  const resetQuestionState = () => {
    setSelected([]);
    setPhase('answering');
    setWrong(0);
    setWasCorrect(false);
    setPraise('');
    setGained(0);
  };

  const startQuiz = () => {
    const pool = buildPool(theme, purpose);
    if (pool.length === 0) return;
    setQueue(shuffle(pool.map((x) => x.id)));
    setQi(0);
    resetQuestionState();
    setView('quiz');
  };

  const scrollTop = () => {
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ block: 'start' }));
  };

  const handleCorrect = () => {
    const pts = wrong === 0 ? 10 : 5;
    setGained(pts);
    setPraise(PRAISES[Math.floor(Math.random() * PRAISES.length)]);
    setWasCorrect(true);
    setPhase('revealed');
    setSessionScore((s) => {
      const n = s + pts;
      sessionScoreRef.current = n;
      return n;
    });
    setCorrectCount((c) => c + 1);
    setAnsweredCount((c) => c + 1);
  };

  const handleWrong = () => {
    if (wrong === 0) {
      setWrong(1);
    } else {
      setWasCorrect(false);
      setPhase('revealed');
      setAnsweredCount((c) => c + 1);
    }
  };

  const pickSingle = (i: number) => {
    if (!q || phase !== 'answering') return;
    if (q.answer.includes(i)) handleCorrect();
    else handleWrong();
    setSelected([i]);
  };

  const toggleSelect = (i: number) => {
    if (phase !== 'answering') return;
    setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };

  const submitMulti = () => {
    if (!q || phase !== 'answering' || selected.length === 0) return;
    if (isMultiCorrect(q, selected)) handleCorrect();
    else handleWrong();
  };

  const nextQuestion = () => {
    if (qi + 1 >= queue.length) {
      // 一轮刷完：重新洗牌继续，十几分钟内不重样
      const pool = buildPool(theme, purpose);
      setQueue(shuffle(pool.map((x) => x.id)));
      setQi(0);
      setReshuffleToast(true);
      window.setTimeout(() => setReshuffleToast(false), 2600);
    } else {
      setQi((i) => i + 1);
    }
    resetQuestionState();
    scrollTop();
  };

  const onToggleFav = (id: string) => setFavorites(toggleFavorite(id));

  const sendSuggest = async () => {
    const text = suggestText.trim();
    if (!q || text.length < 2 || suggestSending) return;
    setSuggestSending(true);
    await submitSuggestion({
      questionId: q.id,
      questionSnapshot: q.question,
      suggestion: text,
      nickname: nickname || '匿名股友',
    });
    setSuggestSending(false);
    setSuggestDone(true);
  };

  const answerLetters = q ? q.answer.map((a) => LETTERS[a]).join('、') : '';

  /* ---------------- 首页 ---------------- */
  if (view === 'home') {
    return (
      <div className="w-full m-auto">
        {/* 页签 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setHomeTab('quiz')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
              homeTab === 'quiz'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            📖 刷题
          </button>
          <button
            onClick={() => setHomeTab('shelf')}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
              homeTab === 'shelf'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            ⭐ 知识库{favorites.length > 0 && `（${favorites.length}）`}
          </button>
        </div>

        {homeTab === 'quiz' ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-slate-400 mb-2">选个主题开刷</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setTheme('all')}
                  className={`rounded-xl border p-2.5 text-left transition-all active:scale-[0.97] ${
                    theme === 'all'
                      ? 'border-emerald-500/60 bg-emerald-500/10'
                      : 'border-slate-700 bg-slate-800/60'
                  }`}
                >
                  <div className="text-xl mb-1">📚</div>
                  <div className="text-xs font-bold text-slate-200">全部主题</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {ENCYCLOPEDIA_QUESTIONS.length} 题
                  </div>
                </button>
                {ENCYCLOPEDIA_THEMES.map((t) => {
                  const n = ENCYCLOPEDIA_QUESTIONS.filter((x) => x.theme === t.key).length;
                  const active = theme === t.key;
                  return (
                    <button
                      key={t.key}
                      onClick={() => setTheme(t.key)}
                      className={`rounded-xl border p-2.5 text-left transition-all active:scale-[0.97] ${
                        active
                          ? 'border-emerald-500/60 bg-emerald-500/10'
                          : 'border-slate-700 bg-slate-800/60'
                      }`}
                    >
                      <div className="text-xl mb-1">{t.emoji}</div>
                      <div className="text-xs font-bold text-slate-200">{t.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">{n} 题</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-xs text-slate-400 mb-2">难度口味</p>
              <div className="flex gap-2">
                {(['all', 'beginner', 'intermediate', 'advanced'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPurpose(p)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      purpose === p
                        ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-800/60 text-slate-400'
                    }`}
                  >
                    {p === 'all' ? '都要' : ENCYCLOPEDIA_PURPOSE_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startQuiz}
              className="w-full py-3 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm active:scale-[0.98] transition-transform"
            >
              开始刷题（共 {poolCount} 题）
            </button>
            <p className="text-[11px] text-slate-500 text-center leading-relaxed">
              一次答对 +10 分，第二次答对 +5 分
              <br />
              第一次答错可以再试，第二次才公布答案 · 刷完一轮自动洗牌
            </p>
          </div>
        ) : (
          <ShelfList
            favorites={favorites}
            openId={shelfOpenId}
            onToggleOpen={(id) => setShelfOpenId((o) => (o === id ? null : id))}
            onRemove={onToggleFav}
            onGoQuiz={() => setHomeTab('quiz')}
          />
        )}
      </div>
    );
  }

  /* ---------------- 答题 ---------------- */
  if (!q) return null;
  return (
    <div className="w-full m-auto relative" ref={topRef}>
      {/* 顶栏 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setView('home')}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4" /> 换主题
        </button>
        <div className="text-[11px] text-slate-500">
          第 {qi + 1} / {queue.length} 题 · 答对 {correctCount}/{answeredCount}
        </div>
        <div className="text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-lg px-2 py-1">
          {sessionScore} 分
        </div>
      </div>

      {reshuffleToast && (
        <div className="mb-2 text-center text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg py-1.5">
          ♻️ 一轮刷完，已重新洗牌继续
        </div>
      )}

      {/* 题目卡 */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-300 bg-slate-700/70 rounded-md px-1.5 py-0.5">
              {qTheme?.emoji} {qTheme?.name}
            </span>
            <span className="text-[11px] text-slate-400">
              {ENCYCLOPEDIA_PURPOSE_LABEL[q.purpose]} · {ENCYCLOPEDIA_SCENARIO_LABEL[q.scenario]}
            </span>
            <span className="text-[10px] text-amber-400">{DIFF_STARS[q.difficulty - 1]}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onToggleFav(q.id)}
              className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
              aria-label="收藏"
            >
              <Star
                className={`w-[18px] h-[18px] ${
                  favorites.includes(q.id) ? 'text-amber-400 fill-amber-400' : 'text-slate-500'
                }`}
              />
            </button>
            <button
              onClick={() => {
                setSuggestText('');
                setSuggestDone(false);
                setSuggestOpen(true);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-700 transition-colors"
              aria-label="建议修改"
            >
              <PencilLine className="w-[18px] h-[18px] text-slate-500" />
            </button>
          </div>
        </div>

        <p className="text-[15px] leading-relaxed text-slate-100 font-medium mb-1">{q.question}</p>
        {q.multi && (
          <p className="text-[11px] text-violet-300 mb-3">
            多选：共 {q.answer.length} 个正确答案，选完点确认
          </p>
        )}

        {/* 选项 */}
        <div className="space-y-2 mt-3">
          {q.options.map((opt, i) => {
            const isAnswer = q.answer.includes(i);
            const isPicked = selected.includes(i);
            let cls = 'border-slate-700 bg-slate-800/80 hover:border-slate-500';
            if (phase === 'revealed') {
              if (isAnswer) cls = 'border-emerald-500/70 bg-emerald-500/15';
              else if (isPicked) cls = 'border-red-500/60 bg-red-500/10';
              else cls = 'border-slate-700 bg-slate-800/40 opacity-60';
            } else if (q.multi && isPicked) {
              cls = 'border-emerald-500/60 bg-emerald-500/10';
            } else if (wrong === 1 && isPicked && !q.multi) {
              cls = 'border-red-500/60 bg-red-500/10';
            }
            return (
              <button
                key={i}
                disabled={phase === 'revealed'}
                onClick={() => (q.multi ? toggleSelect(i) : pickSingle(i))}
                className={`w-full flex items-start gap-2.5 text-left border rounded-xl px-3 py-2.5 text-sm transition-all active:scale-[0.99] ${cls}`}
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
                <span className="text-slate-200 leading-relaxed">{opt}</span>
              </button>
            );
          })}
        </div>

        {/* 反馈区 */}
        {phase === 'answering' && wrong === 1 && (
          <div className="mt-3 text-center text-sm text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl py-2">
            不对，再想想 💪 还有一次机会
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
                  {praise} <span className="text-amber-300">+{gained} 分</span>
                </>
              ) : (
                <>正确答案：{answerLetters}</>
              )}
            </div>
            <div className="text-[13px] leading-relaxed text-slate-300 bg-slate-800 border border-slate-700 rounded-xl p-3">
              <span className="text-slate-500">💡 解析：</span>
              {q.explanation}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="mt-3">
          {phase === 'answering' && q.multi && (
            <button
              onClick={submitMulti}
              disabled={selected.length === 0}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              确认提交（已选 {selected.length} 项）
            </button>
          )}
          {phase === 'revealed' && (
            <button
              onClick={nextQuestion}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm active:scale-[0.98] transition-transform flex items-center justify-center gap-1"
            >
              下一题 <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 建议修改弹窗 */}
      {suggestOpen && (
        <div className="absolute inset-0 z-10 bg-black/70 backdrop-blur-sm rounded-2xl flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 w-full">
            {suggestDone ? (
              <div className="text-center py-4">
                <p className="text-2xl mb-2">👀</p>
                <p className="text-sm text-slate-200 font-bold">已收到，谢谢你的火眼金睛！</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  {user ? '登录用户提交的建议被采纳后会获得贡献值' : '登录后提交，被采纳可获得贡献值'}
                </p>
                <button
                  onClick={() => setSuggestOpen(false)}
                  className="mt-3 px-6 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold"
                >
                  好的
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-bold text-slate-200 mb-1">✏️ 对这道题有建议？</p>
                <p className="text-[11px] text-slate-500 mb-2 line-clamp-2">「{q.question}」</p>
                <textarea
                  value={suggestText}
                  onChange={(e) => setSuggestText(e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="哪里写得不对 / 不够清楚 / 有更好的讲法……写下来告诉我们"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500/60 resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setSuggestOpen(false)}
                    className="flex-1 py-2 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-300"
                  >
                    取消
                  </button>
                  <button
                    onClick={sendSuggest}
                    disabled={suggestText.trim().length < 2 || suggestSending}
                    className="flex-1 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold disabled:opacity-40"
                  >
                    {suggestSending ? '发送中…' : '提交建议'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- 知识库列表 ---------------- */

function ShelfList({
  favorites,
  openId,
  onToggleOpen,
  onRemove,
  onGoQuiz,
}: {
  favorites: string[];
  openId: string | null;
  onToggleOpen: (id: string) => void;
  onRemove: (id: string) => void;
  onGoQuiz: () => void;
}) {
  const questions = useMemo(
    () =>
      favorites
        .map((id) => getQuestion(id))
        .filter((x): x is EncyclopediaQuestion => !!x),
    [favorites]
  );

  if (questions.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-3">⭐</p>
        <p className="text-sm text-slate-300 font-bold">还没有收藏</p>
        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
          刷题时点题目右上角的星星
          <br />
          把难啃的硬骨头留在这里慢慢啃
        </p>
        <button
          onClick={onGoQuiz}
          className="mt-4 px-6 py-2 rounded-xl bg-emerald-500 text-slate-950 text-sm font-bold"
        >
          去刷题
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-slate-500 flex items-center gap-1">
        <BookOpen className="w-3 h-3" /> 点题目展开看答案和解析
      </p>
      {questions.map((x) => {
        const t = themeOf(x);
        const open = openId === x.id;
        return (
          <div
            key={x.id}
            className="bg-slate-800/60 border border-slate-700 rounded-xl overflow-hidden"
          >
            <button onClick={() => onToggleOpen(x.id)} className="w-full text-left p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-[10px] text-slate-300 bg-slate-700/70 rounded px-1.5 py-0.5">
                  {t?.emoji} {t?.name}
                </span>
                <span className="text-[10px] text-amber-400">{DIFF_STARS[x.difficulty - 1]}</span>
                {x.multi && <span className="text-[10px] text-violet-300">多选</span>}
              </div>
              <p className={`text-[13px] text-slate-200 leading-relaxed ${open ? '' : 'line-clamp-2'}`}>
                {x.question}
              </p>
            </button>
            {open && (
              <div className="px-3 pb-3 space-y-2">
                <div className="text-[13px] text-slate-300 space-y-1">
                  {x.options.map((opt, i) => (
                    <div key={i} className="flex gap-2">
                      <span
                        className={`font-bold ${
                          x.answer.includes(i) ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {LETTERS[i]}.
                      </span>
                      <span className={x.answer.includes(i) ? 'text-emerald-300' : ''}>{opt}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[12px] text-slate-400 leading-relaxed bg-slate-800 rounded-lg p-2">
                  💡 {x.explanation}
                </p>
                <button
                  onClick={() => onRemove(x.id)}
                  className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-red-400"
                >
                  <Trash2 className="w-3 h-3" /> 移出知识库
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
