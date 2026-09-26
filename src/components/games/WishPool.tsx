'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lightbulb, MessageSquareHeart, Send, Trash2, Reply } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNickname } from '@/hooks/useNickname';
import { isAdminEmail } from '@/lib/admin';
import { REPLY_DRAFTS } from '@/lib/replyDrafts';
import { grantEndorseBonus, BONUS_PER_ENDORSE } from '@/lib/stockbox';

interface Wish {
  id: string;
  user_id: string | null;
  nickname: string;
  kind: 'idea' | 'review';
  content: string;
  created_at: string;
  adopted: boolean;
  reply_text: string | null;
  replied_at: string | null;
  bonus_points: number; // 017：被采纳的额外奖励分（默认 0）
}

/** EaaS v0 · 认同：某条留言收到的具名认同（认同 = 认可 + 同频，认同即定价） */
interface EndorseInfo {
  count: number;
  names: string[];
  mine: boolean;
}

const KIND_META = {
  idea: { label: '游戏设想', icon: <Lightbulb className="w-3 h-3" />, chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  review: { label: '玩家评价', icon: <MessageSquareHeart className="w-3 h-3" />, chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
} as const;

const fmtTime = (iso: string) => {
  try {
    const d = new Date(iso);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '';
  }
};

/** 站长回复草稿：点一下填入输入框，可再修改后发布（只站长可见，不会自动发布）
 * 草稿正文见 @/lib/replyDrafts，与站长工具箱共用同一份 */

export default function WishPool() {
  const { user } = useAuth();
  const nickname = useNickname(user?.email);
  const [kind, setKind] = useState<'idea' | 'review'>('idea');
  const [content, setContent] = useState('');
  const [guestName, setGuestName] = useState('');
  const [wishes, setWishes] = useState<Wish[]>([]);
  const [points, setPoints] = useState(0);
  const [posting, setPosting] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [replying, setReplying] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyBusy, setReplyBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [endorsements, setEndorsements] = useState<Record<string, EndorseInfo>>({});
  const [endorseReady, setEndorseReady] = useState(false); // 023 没跑时隐藏认同区
  const [endorseBusy, setEndorseBusy] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);
  const [pendingClaims, setPendingClaims] = useState<Set<string>>(new Set());
  const [claimReady, setClaimReady] = useState(false); // 028 没跑时隐藏认领入口
  const isAdmin = isAdminEmail(user?.email);

  const normalize = (rows: object[]): Wish[] =>
    rows.map((w) => {
      const r = w as Partial<Wish>;
      return {
        ...(w as Wish),
        adopted: r.adopted ?? false,
        reply_text: r.reply_text ?? null,
        replied_at: r.replied_at ?? null,
        bonus_points: r.bonus_points ?? 0,
      };
    });

  /** EaaS v0 · 拉取展示中留言的认同情况；023 没跑（表不存在）时静默隐藏认同区 */
  const loadEndorsements = useCallback(
    async (ids: string[]) => {
      if (!supabase || ids.length === 0) {
        setEndorsements({});
        setEndorseReady(false);
        return;
      }
      try {
        const r = await supabase
          .from('wish_endorsements')
          .select('wish_id,user_id,display_name')
          .in('wish_id', ids)
          .order('created_at', { ascending: true })
          .limit(600);
        if (r.error) throw r.error;
        const map: Record<string, EndorseInfo> = {};
        for (const e of (r.data || []) as {
          wish_id: string;
          user_id: string;
          display_name: string;
        }[]) {
          const m = map[e.wish_id] ?? (map[e.wish_id] = { count: 0, names: [], mine: false });
          m.count += 1;
          if (m.names.length < 3) m.names.push(e.display_name || '股友');
          if (user && e.user_id === user.id) m.mine = true;
        }
        setEndorsements(map);
        setEndorseReady(true);
      } catch {
        setEndorsements({});
        setEndorseReady(false);
      }
    },
    [user]
  );

  const load = useCallback(async () => {
    if (!supabase) return;
    try {      // 四档降级：017 没跑就没有 bonus_points 列，009 没跑就没有 reply 列，006 没跑就没有 adopted 列
      const tries = [
        'id,user_id,nickname,kind,content,created_at,adopted,reply_text,replied_at,bonus_points',
        'id,user_id,nickname,kind,content,created_at,adopted,reply_text,replied_at',
        'id,user_id,nickname,kind,content,created_at,adopted',
        'id,user_id,nickname,kind,content,created_at',
      ];
      let rows: Wish[] = [];
      for (const cols of tries) {
        const r = await supabase
          .from('game_wishes')
          .select(cols)
          .order('created_at', { ascending: false })
          .limit(30);
        if (!r.error) {
          rows = normalize((r.data || []) as object[]);
          break;
        }
      }
      setWishes(rows);
      await loadEndorsements(rows.map((r) => r.id));
      if (user) {
        // 贡献值 = Σ(10 + bonus_points)：被采纳的留言额外 +40；
        // bonus_points 列不存在（017 没跑）时降级回按条数 ×10
        try {
          const r = await supabase
            .from('game_wishes')
            .select('bonus_points')
            .eq('user_id', user.id);
          if (r.error) throw r.error;
          const pts = ((r.data || []) as { bonus_points: number | null }[]).reduce(
            (a, w) => a + 10 + (w.bonus_points || 0),
            0
          );
          setPoints(pts);
        } catch {
          const { count } = await supabase
            .from('game_wishes')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);
          setPoints((count || 0) * 10);
        }
      } else {
        setPoints(0);
      }
    } catch {
      /* 忽略 */
    }
  }, [user, loadEndorsements]);

  useEffect(() => {
    load();
    loadClaims();
  }, [load, loadClaims]);

  /** EaaS v0 · 认同/取消认同：具名，公开，不可给自己认同 */
  const toggleEndorse = async (w: Wish) => {
    if (!supabase || endorseBusy) return;
    if (!user) {
      setMsg('登录后可认同');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    if (w.user_id && w.user_id === user.id) {
      setMsg('自己的许愿不用认同啦～');
      setTimeout(() => setMsg(''), 3000);
      return;
    }
    setEndorseBusy(w.id);
    try {
      const st = endorsements[w.id];
      if (st?.mine) {
        const { error } = await supabase
          .from('wish_endorsements')
          .delete()
          .eq('wish_id', w.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('wish_endorsements').insert({
          wish_id: w.id,
          user_id: user.id,
          display_name: (nickname || '股友').slice(0, 20),
        });
        if (error) throw error;
        // EaaS v0 联动：认同一条留言，股票盲盒 +5 次（每条终身只加一次）
        const bonus = grantEndorseBonus(w.id);
        setMsg(bonus ? `已认同！股票盲盒 +${BONUS_PER_ENDORSE} 次 🎁` : '已认同');
        setTimeout(() => setMsg(''), 3000);
      }
      await loadEndorsements(wishes.map((x) => x.id));
    } catch {
      /* 023 没跑或网络问题：静默 */
    } finally {
      setEndorseBusy(null);
    }
  };

  /** EaaS v0 · 拉取待审认领（028 没跑时静默隐藏认领入口） */
  const loadClaims = useCallback(async () => {
    try {
      const res = await fetch('/api/wish-claim?status=pending');
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || 'fail');
      setPendingClaims(new Set((j.claims || []).map((c: { nickname: string }) => c.nickname)));
      setClaimReady(true);
    } catch {
      setPendingClaims(new Set());
      setClaimReady(false);
    }
  }, []);

  /** 认领该昵称：站长审批后，该昵称下所有未认领留言归到我名下 */
  const claimNickname = async (w: Wish) => {
    if (!supabase || !user) return;
    setClaimBusy(w.nickname);
    try {
      const res = await fetch('/api/wish-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await authToken()}`,
        },
        body: JSON.stringify({ nickname: w.nickname }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || '认领失败');
      setMsg(`已提交认领「${w.nickname}」，等站长审核～`);
      await loadClaims();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '认领失败');
    } finally {
      setClaimBusy(null);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  const submit = async () => {
    const text = content.trim();
    if (!text) {
      setMsg('先写点什么再发送吧～');
      return;
    }
    if (!supabase) {
      setMsg('留言功能还没准备好，稍后再试');
      return;
    }
    if (!user && !guestName.trim()) {
      setMsg('匿名留言请填个昵称，以后认领得靠它～');
      return;
    }
    setPosting(true);
    setMsg('');
    try {
      const name = user ? nickname || '股友' : guestName.trim();
      const { error } = await supabase.from('game_wishes').insert({
        user_id: user ? user.id : null,
        nickname: name.slice(0, 20),
        kind,
        content: text.slice(0, 500),
      });
      if (error) throw error;
      setContent('');
      setMsg(user ? '已收到！贡献值 +10 🎉' : '已收到！登录后留言可获得贡献值');
      await load();
    } catch {
      setMsg('发送失败，检查网络后重试');
    } finally {
      setPosting(false);
      setTimeout(() => setMsg(''), 3000);
    }
  };

  /** 站长（Mas）公开回复：走服务端 API，只有站长邮箱能写 */
  const authToken = async () => {
    const { data } = await supabase!.auth.getSession();
    return data.session?.access_token ?? '';
  };

  const saveReply = async (id: string) => {
    const text = replyText.trim();
    if (!text || !supabase) return;
    setReplyBusy(true);
    try {
      const res = await fetch('/api/admin/wish-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await authToken()}`,
        },
        body: JSON.stringify({ id, reply_text: text }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '保存失败');
      setReplying(null);
      setReplyText('');
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存失败');
      setTimeout(() => setMsg(''), 4000);
    } finally {
      setReplyBusy(false);
    }
  };

  const clearReply = async (id: string) => {
    if (!supabase) return;
    setReplyBusy(true);
    try {
      await fetch('/api/admin/wish-reply', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await authToken()}`,
        },
        body: JSON.stringify({ id }),
      });
      setReplying(null);
      setReplyText('');
      await load();
    } finally {
      setReplyBusy(false);
    }
  };

  const del = async (id: string) => {    if (confirmDel !== id) {
      setConfirmDel(id);
      setTimeout(() => setConfirmDel((v) => (v === id ? null : v)), 3000);
      return;
    }
    if (!supabase) return;
    try {
      await supabase.from('game_wishes').delete().eq('id', id);
      setConfirmDel(null);
      await load();
    } catch {
      /* 忽略 */
    }
  };

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-sm font-bold text-slate-200">💡 游戏许愿池</h2>
        {user && (
          <span className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">
            我的贡献值：{points}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
        想玩什么股票主题游戏？直接许愿——你的设想可能变成下一个游戏，贡献者榜上有名。
        {!user && <span className="text-slate-400">匿名留言请填昵称（以后登录可认领），登录后留言计贡献值。</span>}
      </p>

      {/* 发表区 */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 space-y-2.5">
        <div className="flex gap-1.5">
          {(['idea', 'review'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-full border ${
                kind === k
                  ? 'bg-sky-600 text-white border-sky-500 font-semibold'
                  : 'text-slate-400 border-slate-700'
              }`}
            >
              {KIND_META[k].icon} {KIND_META[k].label}
            </button>
          ))}
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={kind === 'idea' ? '比如：来个"抄底接飞刀"游戏，越跌越买…' : '比如：割肉那个太真实了，玩完不敢乱卖了…'}
          className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-sky-500 resize-none"
        />
        <div className="flex gap-2">
          {!user && (
            <input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={20}
              placeholder="昵称（必填）"
              className="w-28 bg-slate-900/80 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-sky-500"
            />
          )}
          <button
            onClick={submit}
            disabled={posting}
            className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1"
          >
            <Send className="w-3.5 h-3.5" />
            {posting ? '发送中…' : user ? '许愿（+10 贡献值）' : '匿名许愿'}
          </button>
        </div>
        {msg && <p className="text-[11px] text-emerald-300">{msg}</p>}
      </div>

      {/* 留言列表 */}
      <div className="mt-3 space-y-2">
        {wishes.length === 0 && (
          <p className="text-center text-[11px] text-slate-600 py-4">
            许愿池空空如也——来许第一个愿吧 🌱
          </p>
        )}
        {wishes.map((w) => {
          const st = endorsements[w.id];
          return (
          <div key={w.id} className="bg-slate-800/40 border border-slate-700/60 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded border ${KIND_META[w.kind].chip}`}>
                {KIND_META[w.kind].icon} {KIND_META[w.kind].label}
              </span>
              <span className="text-[11px] text-slate-300 font-medium">{w.nickname}</span>
              {w.adopted && (
                <span className="text-[10px] text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                  🎉 已被采纳
                </span>
              )}
              {w.user_id && (
                <span className="text-[10px] text-amber-400/80">
                  +{10 + (w.bonus_points || 0)} 贡献
                </span>
              )}
              {/* EaaS v0 · 昵称认领：登录用户可认领无人认领的具名留言，站长审批 */}
              {claimReady && user && !w.user_id && w.nickname !== '匿名股友' && (
                pendingClaims.has(w.nickname) ? (
                  <span className="text-[10px] text-slate-500">📥 审核中</span>
                ) : (
                  <button
                    onClick={() => claimNickname(w)}
                    disabled={claimBusy === w.nickname}
                    className="text-[10px] text-sky-400/90 underline underline-offset-2 disabled:opacity-50"
                  >
                    {claimBusy === w.nickname ? '提交中…' : '📥 认领'}
                  </button>
                )
              )}
              <span className="text-[10px] text-slate-600 ml-auto">{fmtTime(w.created_at)}</span>
              {user && w.user_id === user.id && (
                <button
                  onClick={() => del(w.id)}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    confirmDel === w.id ? 'bg-rose-600 text-white' : 'text-slate-500'
                  }`}
                >
                  {confirmDel === w.id ? '确认删？' : <Trash2 className="w-3 h-3" />}
                </button>
              )}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{w.content}</p>

            {/* EaaS v0 · 认同区：具名认同，认同即定价（023 没跑时整行隐藏） */}
            {endorseReady && (
              <div className="mt-1.5 flex items-center gap-2 min-w-0">
                <button
                  onClick={() => toggleEndorse(w)}
                  disabled={endorseBusy === w.id}
                  className={`shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border disabled:opacity-50 ${
                    st?.mine
                      ? 'bg-amber-500/25 text-amber-200 border-amber-400/50 font-semibold'
                      : 'text-amber-300/90 border-amber-500/30 bg-amber-500/10'
                  }`}
                >
                  🤝 {st?.mine ? '已认同' : '认同'}
                  {st && st.count > 0 ? `（${st.count}）` : ''}
                </button>
                {st && st.count > 0 && (
                  <span className="text-[10px] text-slate-500 truncate">
                    {st.names.join('、')}
                    {st.count > st.names.length ? ` 等 ${st.count} 人` : ''}
                    认同了这条
                  </span>
                )}
                {!st?.mine && (
                  <span className="text-[10px] text-slate-600 shrink-0">认同+{BONUS_PER_ENDORSE}次盲盒</span>
                )}
              </div>
            )}

            {/* Mas 官方回复：所有人可见 */}
            {w.reply_text && (
              <div className="mt-2 bg-emerald-500/10 border border-emerald-500/25 rounded-lg px-2.5 py-2">
                <div className="text-[10px] text-emerald-300 font-semibold mb-0.5">
                  ✦ Mas 回复
                  {w.replied_at && (
                    <span className="font-normal text-emerald-400/60 ml-1">{fmtTime(w.replied_at)}</span>
                  )}
                </div>
                <p className="text-xs text-emerald-100/90 leading-relaxed whitespace-pre-line">
                  {w.reply_text}
                </p>
              </div>
            )}

            {/* 站长回复入口：只有站长登录才看得到 */}
            {isAdmin && (
              <div className="mt-1.5">
                {replying === w.id ? (
                  <div className="space-y-1.5">
                    {/* 草稿轮盘：点选填入，可再修改，发布仍由站长亲手点（无草稿时整行隐藏） */}
                    {REPLY_DRAFTS.length > 0 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto">
                        <span className="text-[10px] text-slate-500 shrink-0">📋 草稿</span>
                        {REPLY_DRAFTS.map((d) => (
                          <button
                            key={d.label}
                            onClick={() => {
                              if (replyText.trim() && !window.confirm('用这条草稿替换已输入的内容？'))
                                return;
                              setReplyText(d.text);
                            }}
                            className="shrink-0 text-[10px] px-2 py-1 rounded-full border border-sky-500/40 text-sky-300 bg-sky-500/10 active:bg-sky-500/25"
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    )}
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="以 Mas 的名义公开回复…"
                      className="w-full bg-slate-900/80 border border-emerald-500/40 rounded-lg px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-emerald-400 resize-none"
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => saveReply(w.id)}
                        disabled={replyBusy || !replyText.trim()}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold disabled:opacity-50"
                      >
                        {replyBusy ? '保存中…' : '发布回复'}
                      </button>
                      <button
                        onClick={() => {
                          setReplying(null);
                          setReplyText('');
                        }}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-slate-700 text-slate-400"
                      >
                        取消
                      </button>
                      {w.reply_text && (
                        <button
                          onClick={() => clearReply(w.id)}
                          disabled={replyBusy}
                          className="text-[11px] px-2.5 py-1.5 rounded-lg border border-rose-500/40 text-rose-400 ml-auto"
                        >
                          删除回复
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setReplying(w.id);
                      setReplyText(w.reply_text || '');
                    }}
                    className="flex items-center gap-1 text-[10px] text-sky-400/80 hover:text-sky-300 px-1 py-0.5"
                  >
                    <Reply className="w-3 h-3" />
                    {w.reply_text ? '修改回复' : '回复'}
                  </button>
                )}
              </div>
            )}
          </div>
          );
        })}
      </div>
    </section>
  );
}
