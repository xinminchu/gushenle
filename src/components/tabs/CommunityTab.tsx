// src/components/tabs/CommunityTab.tsx
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, HeartHandshake, Send, Trash2, LogIn, BarChart3, Check, Pencil, MessageCircle, X,
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
import PiisWeekly from '../PiisWeekly';
import {
  fetchPosts,
  createPost,
  deletePost,
  updatePost,
  toggleLike,
  setNickname,
  updateMyPostsNickname,
  fetchReplies,
  createReply,
  deleteReply,
  splitSymbols,
  getSurvey,
  setSurveyVote,
  getVoterKey,
  relativeTime,
  surveyLabel,
  isPostTypeSellBlocked,
  type FamilyPost,
  type FamilyReply,
  type SurveyChoice,
  type SurveyState,
} from '@/lib/family';
import { isSupabaseConfigured } from '@/lib/supabase';
import { saveOperation, todayStr } from '@/lib/operations';

/** 发帖类型：买入逻辑 / 卖出逻辑 / 避坑经验（卖出 ≠ 避坑，止盈调仓是正当逻辑） */
type PostKind = 'thesis' | 'sell' | 'lesson';
function postKindLabel(t: string, lang: string): string {
  return t === 'thesis'
    ? tx(lang, '💡 Buy logic', '💡 买入逻辑')
    : t === 'sell'
      ? tx(lang, '📤 Sell logic', '📤 卖出逻辑')
      : tx(lang, '⚠️ Lessons learned', '⚠️ 避坑经验');
}
function postKindBadge(t: string): string {
  return t === 'thesis'
    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    : t === 'sell'
      ? 'bg-sky-500/20 text-sky-400 border-sky-500/30'
      : 'bg-amber-500/20 text-amber-400 border-amber-500/30';
}

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

export default function CommunityTab({ calendarFocus }: { calendarFocus?: string | null }) {
  const { user, loading: authLoading } = useAuth();
  const { lang } = useLanguage();
  const [loginOpen, setLoginOpen] = useState(false);
  const [posts, setPosts] = useState<FamilyPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);

  // 发帖表单
  const [postType, setPostType] = useState<PostKind>('thesis');
  const [symbol, setSymbol] = useState('');
  const [content, setContent] = useState('');
  // 昵称全局同步：顶栏、帖子署名都跟着变
  const nickname = useNickname(user?.email);
  const [nickDraft, setNickDraft] = useState('');
  const [editingNick, setEditingNick] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // 发帖时同步记一笔到操作记忆：勾选后按标的逐只记（股数/价格逐只填）
  const [logToMemory, setLogToMemory] = useState(false);
  const [logAction, setLogAction] = useState<'buy' | 'sell'>('buy');
  const [logRows, setLogRows] = useState<Record<string, { qty: string; price: string }>>({});

  // 删除二次确认（两步点击，不用浏览器 confirm）
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // 回复
  const [replies, setReplies] = useState<FamilyReply[]>([]);
  const [repliesReady, setRepliesReady] = useState(false); // 034 迁移跑完才有回复表
  const [openReplyFor, setOpenReplyFor] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  // 编辑自己的帖子
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editSymbol, setEditSymbol] = useState('');
  const [editType, setEditType] = useState<PostKind>('thesis');
  const [savingEdit, setSavingEdit] = useState(false);

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
        // 回复表要等 034 迁移跑完；没跑就先隐藏回复入口，不挡发帖
        try {
          const r = await fetchReplies(p.map((x) => x.id));
          setReplies(r);
          setRepliesReady(true);
        } catch {
          setReplies([]);
          setRepliesReady(false);
        }
      } else {
        setPosts([]);
        setReplies([]);
        setRepliesReady(false);
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
      // 发帖→记一笔：按标的逐只生成操作记忆（价格没填的跳过）
      let logged = 0;
      let skipped: string[] = [];
      if (logToMemory) {
        const syms = splitSymbols(symbol);
        const today = todayStr();
        for (const s of syms) {
          const row = logRows[s] || { qty: '', price: '' };
          const price = parseFloat(row.price);
          const qty = parseInt(row.qty, 10);
          if (price > 0) {
            saveOperation({
              symbol: s,
              action: logAction,
              price,
              qty: qty > 0 ? qty : undefined,
              date: today,
              source: 'community',
              thesis: text,
            });
            logged++;
          } else {
            skipped.push(s);
          }
        }
      }
      setContent('');
      setSymbol('');
      setLogToMemory(false);
      setLogRows({});
      setLogAction('buy');
      const p = await fetchPosts(user.id);
      setPosts(p);
      if (logged > 0) {
        setNotice(
          tx(
            lang,
            `Posted ✓ — logged ${logged} ${logged > 1 ? 'entries' : 'entry'} to your memory${skipped.length > 0 ? ` (${skipped.join('、')} had no price, skipped)` : ''}`,
            `发布成功 ✓，已记 ${logged} 笔到操作记忆${skipped.length > 0 ? `（${skipped.join('、')}没填价格，未记）` : ''}`,
          ),
        );
      }
    } catch (e: any) {
      console.error(e);
      setNotice(
        isPostTypeSellBlocked(e)
          ? tx(lang, '"Sell logic" is new — run DB migration 036 once from the ⚙️ admin toolbox first', '“卖出逻辑”是新类型：先去顶栏 ⚙️ 站长工具箱跑一下数据库迁移 036，再发')
          : tx(lang, 'Post failed — try again later', '发布失败，稍后再试'),
      );
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

  const handleSendReply = async (postId: number) => {
    if (!user) {
      setLoginOpen(true);
      return;
    }
    const text = replyDraft.trim();
    if (text.length < 1 || sendingReply) return;
    setSendingReply(true);
    try {
      await createReply({ post_id: postId, user_id: user.id, nickname, content: text });
      setReplyDraft('');
      const r = await fetchReplies(posts.map((x) => x.id));
      setReplies(r);
    } catch (e) {
      console.error(e);
      setNotice(tx(lang, 'Reply failed — try again later', '回复失败，稍后再试'));
    } finally {
      setSendingReply(false);
    }
  };

  const handleDeleteReply = async (id: number) => {
    try {
      await deleteReply(id);
      setReplies((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const startEdit = (post: FamilyPost) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
    setEditSymbol(splitSymbols(post.symbol).join(' '));
    setEditType(post.post_type);
    setOpenReplyFor(null);
  };

  const handleSaveEdit = async () => {
    if (editingPostId == null) return;
    const text = editContent.trim();
    if (text.length < 2) {
      setNotice(tx(lang, 'Write a couple of lines first', '写两句再发吧'));
      return;
    }
    setSavingEdit(true);
    try {
      await updatePost(editingPostId, { content: text, symbol: editSymbol, post_type: editType });
      const normSymbol = editSymbol.toUpperCase().split(/[\s,，、]+/).map((s) => s.replace(/[^A-Z]/g, '')).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).slice(0, 8).join(',');
      setPosts((prev) =>
        prev.map((p) =>
          p.id === editingPostId ? { ...p, content: text, symbol: normSymbol, post_type: editType } : p,
        ),
      );
      setEditingPostId(null);
    } catch (e) {
      console.error(e);
      setNotice(
        isPostTypeSellBlocked(e)
          ? tx(lang, '"Sell logic" is new — run DB migration 036 once from the ⚙️ admin toolbox first', '“卖出逻辑”是新类型：先去顶栏 ⚙️ 站长工具箱跑一下数据库迁移 036，再改')
          : tx(lang, 'Edit needs migration 034 — run it from the ⚙️ admin panel first', '编辑要先跑 034 迁移：点顶栏 ⚙️ → 数据库迁移 → 一键执行'),
      );
    } finally {
      setSavingEdit(false);
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

      {/* PIIS 本周解读：先给视角，再看下面的新闻 */}
      <PiisWeekly />

      {/* 今日大事 + 财经日历：免登录可看 */}
      <FamilyNews focusDate={calendarFocus} />

      {/* 理念卡片 */}
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
        <Users className="w-8 h-8 text-emerald-400 flex-shrink-0" />
        <div className="text-xs text-slate-300 space-y-0.5">
          <p className="font-semibold text-emerald-400">{tx(lang, '💬 Moments · "buy logic", "sell logic" and "lessons learned" only', '💬 朋友圈 · 只分享"买入逻辑"、"卖出逻辑"与"避坑经验"')}</p>
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
                  onClick={() => { setPostType('thesis'); setLogAction('buy'); }}
                  className={`text-[11px] px-3 py-1.5 rounded-full border font-medium ${
                    postType === 'thesis'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : 'text-slate-500 border-slate-700'
                  }`}
                >
                  {tx(lang, '💡 Buy logic', '💡 买入逻辑')}
                </button>
                <button
                  onClick={() => { setPostType('sell'); setLogAction('sell'); }}
                  className={`text-[11px] px-3 py-1.5 rounded-full border font-medium ${
                    postType === 'sell'
                      ? 'bg-sky-500/20 text-sky-400 border-sky-500/40'
                      : 'text-slate-500 border-slate-700'
                  }`}
                >
                  {tx(lang, '📤 Sell logic', '📤 卖出逻辑')}
                </button>
                <button
                  onClick={() => { setPostType('lesson'); setLogAction('sell'); }}
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
              onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/[^A-Z,，、 ]/g, '').slice(0, 40))}
              placeholder={tx(lang, 'Tickers (optional, several separated by space, e.g. NVDA COIN)', '标的代码（选填，可填多个，空格分隔，如 NVDA COIN）')}
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value.slice(0, 500))}
              placeholder={postType === 'thesis' ? tx(lang, 'Share why you bought… (within 500 chars)', '说说这次买入的逻辑…（500字以内）') : postType === 'sell' ? tx(lang, 'Share why you sold… (within 500 chars)', '说说这次卖出的逻辑…（500字以内）') : tx(lang, 'Share the pitfall so others can avoid it… (within 500 chars)', '说说这次踩的坑，给大家提个醒…（500字以内）')}
              className="w-full h-20 bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
            />
            {/* 发帖→记一笔：把这次分享同步成操作记忆 */}
            <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={logToMemory}
                onChange={(e) => setLogToMemory(e.target.checked)}
                className="accent-emerald-500 w-3.5 h-3.5"
              />
              {tx(lang, 'Also log to my trade memory', '同时记一笔到操作记忆')}
            </label>
            {logToMemory && (
              <div className="bg-slate-800/40 border border-slate-800 rounded-xl p-3 space-y-2">
                <div className="flex gap-1.5">
                  {(['buy', 'sell'] as const).map((a) => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setLogAction(a)}
                      className={`text-[11px] px-3 py-1 rounded-full border font-medium ${
                        logAction === a
                          ? a === 'buy'
                            ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'text-slate-500 border-slate-700'
                      }`}
                    >
                      {a === 'buy' ? tx(lang, 'Buy', '买入') : tx(lang, 'Sell', '卖出')}
                    </button>
                  ))}
                </div>
                {splitSymbols(symbol).length === 0 ? (
                  <p className="text-[11px] text-slate-600">{tx(lang, 'Add the tickers above first', '先在上面填标的代码')}</p>
                ) : (
                  splitSymbols(symbol).map((s) => (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-blue-300 w-20 truncate">{s}</span>
                      <input
                        value={logRows[s]?.qty ?? ''}
                        onChange={(e) => setLogRows((prev) => ({ ...prev, [s]: { qty: e.target.value.replace(/[^\d]/g, ''), price: prev[s]?.price ?? '' } }))}
                        inputMode="numeric"
                        placeholder={tx(lang, 'Shares', '股数')}
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        value={logRows[s]?.price ?? ''}
                        onChange={(e) => setLogRows((prev) => ({ ...prev, [s]: { qty: prev[s]?.qty ?? '', price: e.target.value.replace(/[^\d.]/g, '') } }))}
                        inputMode="decimal"
                        placeholder={tx(lang, 'Price', '价格')}
                        className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  ))
                )}
                <p className="text-[10px] text-slate-600">{tx(lang, 'No price = skipped for that ticker', '没填价格的那只会跳过，不记')}</p>
              </div>
            )}
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
                const symbols = splitSymbols(post.symbol);
                const postReplies = replies.filter((r) => r.post_id === post.id);
                const isEditing = editingPostId === post.id;
                const replyOpen = openReplyFor === post.id;
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
                      className={`text-[10px] px-2 py-0.5 rounded font-medium border ${postKindBadge(post.post_type)}`}
                    >
                      {postKindLabel(post.post_type, lang)}
                    </span>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2 bg-slate-900/60 border border-amber-500/30 rounded-lg p-3">
                      <div className="flex gap-1.5">
                        {(['thesis', 'sell', 'lesson'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setEditType(t)}
                            className={`text-[11px] px-3 py-1 rounded-full border font-medium ${
                              editType === t
                                ? postKindBadge(t).replace('/30', '/40')
                                : 'text-slate-500 border-slate-700'
                            }`}
                          >
                            {postKindLabel(t, lang)}
                          </button>
                        ))}
                      </div>
                      <input
                        value={editSymbol}
                        onChange={(e) => setEditSymbol(e.target.value.toUpperCase().replace(/[^A-Z,，、 ]/g, '').slice(0, 40))}
                        placeholder={tx(lang, 'Tickers, space-separated', '标的代码，空格分隔可填多个')}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                      />
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value.slice(0, 500))}
                        className="w-full h-20 bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 resize-none"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleSaveEdit}
                          disabled={savingEdit}
                          className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-semibold py-2 rounded-lg"
                        >
                          {savingEdit ? tx(lang, 'Saving…', '保存中…') : tx(lang, 'Save', '保存')}
                        </button>
                        <button
                          onClick={() => setEditingPostId(null)}
                          className="px-4 text-xs text-slate-400 border border-slate-700 rounded-lg hover:text-slate-200"
                        >
                          {tx(lang, 'Cancel', '取消')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {symbols.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {symbols.map((s) => (
                            <span key={s} className="text-[11px] font-bold text-sky-300 bg-sky-500/15 border border-sky-500/30 rounded-md px-2 py-0.5">
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 whitespace-pre-wrap">
                        {post.content}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-700/50">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleLike(post)}
                        className={`flex items-center gap-1 ${post.liked_by_me ? 'text-emerald-400' : 'hover:text-emerald-400'}`}
                      >
                        <HeartHandshake className="w-3.5 h-3.5" />
                        {post.liked_by_me ? tx(lang, 'Insightful ✓', '有启发 ✓') : tx(lang, 'Insightful', '觉得有启发')} ({post.like_count})
                      </button>
                      {repliesReady && !isEditing && (
                        <button
                          onClick={() => {
                            setOpenReplyFor(replyOpen ? null : post.id);
                            setReplyDraft('');
                          }}
                          className={`flex items-center gap-1 ${replyOpen ? 'text-sky-400' : 'hover:text-sky-400'}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          {tx(lang, 'Reply', '回复')} ({postReplies.length})
                        </button>
                      )}
                    </div>
                    {user && post.user_id === user.id && !isEditing && (
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => startEdit(post)}
                          className="flex items-center gap-1 hover:text-amber-400"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          {tx(lang, 'Edit', '编辑')}
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className={`flex items-center gap-1 ${confirmDeleteId === post.id ? 'text-rose-400 font-semibold' : 'hover:text-rose-400'}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {confirmDeleteId === post.id ? tx(lang, 'Confirm delete?', '确认删除？') : tx(lang, 'Delete', '删除')}
                        </button>
                      </div>
                    )}
                  </div>

                  {replyOpen && (
                    <div className="space-y-2">
                      {postReplies.map((r) => (
                        <div key={r.id} className="flex gap-1.5 items-start">
                          <div className="flex-1 bg-slate-900/60 rounded-lg px-2.5 py-1.5 border border-slate-800">
                            <span className="text-[11px] font-semibold text-slate-200">
                              {r.user_id === user?.id ? nickname : r.nickname}
                            </span>
                            <span className="text-[10px] text-slate-500 ml-1.5">{relativeTime(r.created_at, lang)}</span>
                            <p className="text-xs text-slate-300 mt-0.5 whitespace-pre-wrap">{r.content}</p>
                          </div>
                          {user && r.user_id === user.id && (
                            <button
                              onClick={() => handleDeleteReply(r.id)}
                              className="text-slate-600 hover:text-rose-400 mt-1.5"
                              aria-label={tx(lang, 'Delete reply', '删除回复')}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <div className="flex gap-1.5">
                        <input
                          value={replyDraft}
                          onChange={(e) => setReplyDraft(e.target.value.slice(0, 300))}
                          placeholder={tx(lang, 'Write a reply…', '写条回复…')}
                          className="flex-1 bg-slate-800/60 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                        />
                        <button
                          onClick={() => handleSendReply(post.id)}
                          disabled={sendingReply || !replyDraft.trim()}
                          className="bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 px-3 rounded-lg"
                          aria-label={tx(lang, 'Send reply', '发送回复')}
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
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
