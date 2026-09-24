'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Lightbulb, MessageSquareHeart, Send, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useNickname } from '@/hooks/useNickname';

interface Wish {
  id: string;
  user_id: string | null;
  nickname: string;
  kind: 'idea' | 'review';
  content: string;
  created_at: string;
  adopted: boolean;
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
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    if (!supabase) return;
    try {
      let rows: Wish[] | null = null;
      const full = await supabase
        .from('game_wishes')
        .select('id,user_id,nickname,kind,content,created_at,adopted')
        .order('created_at', { ascending: false })
        .limit(30);
      if (full.error) {
        // adopted 列还没建（006 没跑）时降级
        const lite = await supabase
          .from('game_wishes')
          .select('id,user_id,nickname,kind,content,created_at')
          .order('created_at', { ascending: false })
          .limit(30);
        rows = (lite.data || []).map((w) => ({ ...(w as Wish), adopted: false }));
      } else {
        rows = (full.data || []) as Wish[];
      }
      setWishes(rows);
      if (user) {
        const { count } = await supabase
          .from('game_wishes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id);
        setPoints((count || 0) * 10);
      } else {
        setPoints(0);
      }
    } catch {
      /* 忽略 */
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

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
    setPosting(true);
    setMsg('');
    try {
      const name = user ? nickname || '股友' : guestName.trim() || '匿名股友';
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

  const del = async (id: string) => {
    if (confirmDel !== id) {
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
        {!user && <span className="text-slate-400">可匿名留言，登录后留言计贡献值。</span>}
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
              placeholder="昵称（可选）"
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
        {wishes.map((w) => (
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
                <span className="text-[10px] text-amber-400/80">+10 贡献</span>
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
          </div>
        ))}
      </div>
    </section>
  );
}
