// src/components/tabs/CommunityTab.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, HeartHandshake, Send, Trash2, LogIn, BarChart3, Check,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNickname } from '@/hooks/useNickname';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import LoginModal from '../modals/LoginModal';
import FamilyNews from '../FamilyNews';
import DailyBrief from '../DailyBrief';
import DenominatorStrip from '../DenominatorStrip';
import MarketSentimentStrip from '../MarketSentimentStrip';
import {
  fetchPosts,
  createPost,
  deletePost,
  toggleLike,
  setNickname,
  updateMyPostsNickname,
  getSurvey,
  setSurveyVote,
  getVoterKey,
  relativeTime,
  surveyLabel,
  type FamilyPost,
  type SurveyChoice,
  type SurveyState,
} from '@/lib/family';
import { isSupabaseConfigured } from '@/lib/supabase';

/** 昵称首字配色 */
function avatarColor(name: string): string {
  const colors = [
    'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    'bg-sky-500/20 text-sky-400 border-sky-500/30',
    'bg-amber-500/20 text-amber-400 border-amber-500/30',
    'bg-rose-500/20 text-rose-400 border-rose-500/30',
    'bg-violet-500/20 text-violet-400 border-violet-500/30',
  ];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return colors[h % colors.length];
}

export default function CommunityTab() {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useLanguage();
  const [loginOpen, setLoginOpen] = useState(false);
  const [posts, setPosts] = useState<FamilyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // 发帖表单
  const [postType, setPostType] = useState<'thesis' | 'lesson'>('thesis');
  const [symbol, setSymbol] = useState('');
  const [content, setContent] = useState('');
  // 昵称全局同步：顶栏、帖子署名都跟着变
  const nickname = useNickname(user?.email);
  const [nickDraft, setNickDraft] = useState('');
  const [editingNick, setEditingNick] = useState(false);
  const [publishing, setPublishing] = useState(false);

  // 删除二次确认（两步点击，不用浏览器 confirm）
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // 投票
  const [survey, setSurvey] = useState<SurveyState | null>(null);
  const [voting, setVoting] = useState(false);

  const loadAll = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotice(null);
    try {
      // 投票对游客开放：一设备一票；帖子仍需登录
      const s = await getSurvey(user ? user.id : null, user ? null : getVoterKey());
      setSurvey(s);
      if (user) {
        const p = await fetchPosts(user.id);
        setPosts(p);
      } else {
        setPosts([]);
      }
    } catch (e: any) {
      console.error(e);
      setNotice(tx(lang, 'Load failed — pull down to retry', '加载失败，下拉页面重试一下'));
    } finally {
      setLoading(false);
    }
  }, [user, lang]);

  useEffect(() => {
    if (!authLoading) {
      loadAll();
    }
  }, [authLoading, user, loadAll]);

  const handlePublish = async () => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    const text = content.trim();
    if (text.length < 2) {
      setNotice(tx(lang, 'Write a couple of lines first', '写两句再发吧'));
      return;
    }
    setPublishing(true);
    setNotice(null);
    try {
      await createPost({
        user_id: user.id,
        nickname,
        post_type: postType,
        symbol,
        content: text,
      });
      setContent('');
      setSymbol('');
      const p = await fetchPosts(user.id);
      setPosts(p);
    } catch (e: any) {
      console.error(e);
      setNotice(tx(lang, 'Post failed — try again later', '发布失败，稍后再试'));
    } finally {
      setPublishing(false);
    }
  };

  const handleLike = async (post: FamilyPost) => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    // 乐观更新
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? {
              ...p,
              liked_by_me: !p.liked_by_me,
              like_count: p.like_count + (p.liked_by_me ? -1 : 1),
            }
          : p,
      ),
    );
    try {
      await toggleLike(post.id, user.id, post.liked_by_me);
    } catch (e) {
      console.error(e);
      loadAll(); // 失败回滚
    }
  };

  const handleDelete = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      console.error(e);
      setNotice(tx(lang, 'Delete failed — try again later', '删除失败，稍后再试'));
    }
  };

  const handleVote = async (choice: SurveyChoice) => {
    if (voting) return;
    setVoting(true);
    try {
      const id = user ? { userId: user.id } : { voterKey: getVoterKey() };
      await setSurveyVote(id, choice);
      const s = await getSurvey(user ? user.id : null, user ? null : getVoterKey());
      setSurvey(s);
    } catch (e) {
      console.error(e);
      setNotice(tx(lang, 'Vote failed — try again later', '投票失败，稍后再试'));
    } finally {
      setVoting(false);
    }
  };

  const saveNickname = async () => {
    const n = nickDraft.trim().slice(0, 12) || nickname;
    setNickname(n); // 广播到顶栏等所有地方
    setEditingNick(false);
    // 同步自己所有帖子的署名
    if (user) {
      try {
        await updateMyPostsNickname(user.id, n);
      } catch {
        /* 本地已更新，署名下次加载时同步 */
      }
      setPosts((prev) =>
        prev.map((p) => (p.user_id === user.id ? { ...p, nickname: n } : p)),
      );
    }
  };

  return (
    <div className="p-4 space-y-5 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">{tx(lang, 'News', '资讯')}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{tx(lang, 'Sharing joy makes it greater', '独乐乐不如大家乐')}</p>
      </header>

      {/* 每日两报：盘前瞻 + 盘后总结 */}
      <DailyBrief />

      {/* 分母：30Y / 10Y 美债收益率（无 key 时自动隐藏） */}
      <DenominatorStrip />

      {/* 市场情绪：VIX + 贪婪指数（取不到自动隐藏） */}
      <MarketSentimentStrip />

      {/* 今日大事 + 财经日历：免登录可看 */}
      <FamilyNews />

      {/* 理念卡片 */}
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
        <Users className="w-8 h-8 text-emerald-400 flex-shrink-0" />
        <div className="text-xs text-slate-300 space-y-0.5">
          <p className="font-semibold text-emerald-400">{tx(lang, '💬 Moments · only "buy logic" and "lessons learned"', '💬 朋友圈 · 只分享"买入逻辑"与"避坑经验"')}</p>
          <p className="text-slate-400">{tx(lang, 'No trade calls, no stock tips — rational discussion, growing together.', '不喊单、不荐股，理性交流共同成长。')}</p>
        </div>
      </div>

      {notice && (
        <div className="bg-amber-950/50 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-2">
          <span className="text-xs text-amber-200">{notice}</span>
          <button onClick={() => setNotice(null)} className="text-amber-400 text-xs shrink-0">{tx(lang, 'Got it', '知道了')}</button>
        </div>
      )}

      {!isSupabaseConfigured() ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
          <p className="text-xs text-slate-400">{tx(lang, 'Moments is not set up yet — check back later.', '朋友圈功能尚未配置，稍后再来看看。')}</p>
        </div>
      ) : authLoading ? (
        <div className="text-center text-xs text-slate-500 py-8">{tx(lang, 'Loading…', '加载中…')}</div>
      ) : !user ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center space-y-3">
          <Users className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400 leading-relaxed">
            {tx(lang, 'Log in to see shares, post and like.', '登录后才能看朋友圈的分享、发帖和点赞。')}<br />{tx(lang, 'Just an email — no password to remember.', '一个邮箱就行，不用记密码。')}
          </p>
          <button
            onClick={() => setLoginOpen(true)}
            className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold px-5 py-2.5 rounded-xl"
          >
            <LogIn className="w-3.5 h-3.5" /> {tx(lang, 'Log in / Sign up', '登录 / 注册')}
          </button>
        </div>
      ) : (
        <>
          {/* 发帖 */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-1.5">
                <button
                  onClick={() => setPostType('thesis')}
                  className={`text-[11px] px-3 py-1.5 rounded-full border font-medium ${
                    postType === 'thesis'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'text-slate-500 border-slate-700'
                  }`}
                >
                  {tx(lang, '💡 Buy logic', '💡 买入逻辑')}
                </button>
                <button
                  onClick={() => setPostType('lesson')}
                  className={`text-[11px] px-3 py-1.5 rounded-full border font-medium ${
                    postType === 'lesson'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'text-slate-500 border-slate-700'
                  }`}
                >
                  {tx(lang, '⚠️ Lessons learned', '⚠️ 避坑经验')}
                </button>
              </div>
              {editingNick ? (
                <div className="flex items-center gap-1">
                  <input
                    value={nickDraft}
                    onChange={(e) => setNickDraft(e.target.value)}
                    maxLength={12}
                    className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <button onClick={saveNickname} className="text-emerald-400">
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setNickDraft(nickname);
                    setEditingNick(true);
                  }}
                  className="text-[11px] text-slate-500 hover:text-slate-300"
                >
                  {tx(lang, `I'm ${nickname} ✎`, `我是${nickname} ✎`)}
                </button>
              )}
            </div>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 10))}
              placeholder={tx(lang, 'Ticker (optional, e.g. AAPL)', '标的代码（选填，如 AAPL）')}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder={postType === 'thesis' ? tx(lang, 'Share why you bought… (within 500 chars)', '说说这次买入的逻辑…（500字以内）') : tx(lang, 'Share the pitfall so others can avoid it… (within 500 chars)', '说说这次踩的坑，给大家提个醒…（500字以内）')}
              className="w-full h-20 bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="w-full flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold py-2.5 rounded-xl"
            >
              <Send className="w-3.5 h-3.5" /> {publishing ? tx(lang, 'Publishing…', '发布中…') : tx(lang, 'Publish', '发布')}
            </button>
          </div>

          {/* 帖子列表 */}
          {loading ? (
            <div className="text-center text-xs text-slate-500 py-8">{tx(lang, 'Loading…', '加载中…')}</div>
          ) : posts.length === 0 ? (
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 text-center">
              <p className="text-xs text-slate-500">{tx(lang, 'No posts yet — be the first 👆', '还没有人发帖，来发第一条吧 👆')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => {
                // 自己的帖子永远显示当前昵称，改名即时生效
                const displayName = post.user_id === user?.id ? nickname : post.nickname;
                return (
                <div key={post.id} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold ${avatarColor(displayName)}`}>
                        {displayName.slice(0, 1)}
                      </span>
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{displayName}</div>
                        <div className="text-[10px] text-slate-500">{relativeTime(post.created_at, lang)}</div>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-medium border ${
                        post.post_type === 'thesis'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      }`}
                    >
                      {post.post_type === 'thesis' ? tx(lang, '💡 Buy logic', '💡 买入逻辑') : tx(lang, '⚠️ Lessons learned', '⚠️ 避坑经验')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {post.symbol && (
                      <div className="text-xs font-bold text-slate-100">{tx(lang, `Ticker: ${post.symbol}`, `标的：${post.symbol}`)}</div>
                    )}
                    <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                      {post.content}
                    </p>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-700/50">
                    <button
                      onClick={() => handleLike(post)}
                      className={`flex items-center gap-1 ${post.liked_by_me ? 'text-emerald-400' : 'hover:text-emerald-400'}`}
                    >
                      <HeartHandshake className="w-3.5 h-3.5" />
                      {post.liked_by_me ? tx(lang, 'Insightful ✓', '有启发 ✓') : tx(lang, 'Insightful', '觉得有启发')} ({post.like_count})
                    </button>
                    {user && post.user_id === user.id && (
                      <button
                        onClick={() => handleDelete(post.id)}
                        className={`flex items-center gap-1 ${confirmDeleteId === post.id ? 'text-rose-400 font-semibold' : 'hover:text-rose-400'}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {confirmDeleteId === post.id ? tx(lang, 'Confirm delete?', '确认删除？') : tx(lang, 'Delete', '删除')}
                      </button>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 小调查：持仓总览意愿 */}
      <div className="bg-slate-900 border border-sky-500/25 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
          <BarChart3 className="w-3.5 h-3.5" /> {tx(lang, 'Quick survey', '做个小调查')}
        </div>
        <p className="text-xs text-slate-300 leading-relaxed">
          {tx(lang, `If we add "Portfolio overview" (auto-sums everyone's holdings and P&L, each person can toggle whether theirs is public), would you use it?`, '如果上线「持仓总览」（自动汇总大家的持仓和盈亏，每人可单独开关是否公开），你愿意用吗？')}
        </p>
        <div className="flex gap-2">
          {(['yes', 'maybe', 'no'] as SurveyChoice[]).map((c) => (
            <button
              key={c}
              onClick={() => handleVote(c)}
              disabled={voting || !isSupabaseConfigured()}
              className={`flex-1 text-[11px] py-2 rounded-xl border font-medium disabled:opacity-50 ${
                survey?.myChoice === c
                  ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                  : 'text-slate-400 border-slate-700 hover:border-slate-500'
              }`}
            >
              {survey?.myChoice === c ? '✓ ' : ''}{surveyLabel(c, lang)}
            </button>
          ))}
        </div>
        {survey && survey.total > 0 && (
          <p className="text-[10px] text-slate-500">
            {tx(lang, `${survey.total} votes: ${survey.counts.yes} yes · ${survey.counts.maybe} maybe · ${survey.counts.no} no`, `已有 ${survey.total} 人投票：${survey.counts.yes} 愿意 · ${survey.counts.maybe} 看情况 · ${survey.counts.no} 不愿意`)}
            {survey.myChoice ? tx(lang, ' (voted — you can change it)', '（你已投票，可更改）') : ''}
          </p>
        )}
      </div>

      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
    </div>
  );
}
