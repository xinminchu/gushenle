'use client';

import React, { useState, useEffect } from 'react';
import { UserRound, LogOut, Settings, Pencil, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNickname } from '@/hooks/useNickname';
import { isAdminEmail, getAdminRole, ADMIN_ROLE_LABEL } from '@/lib/admin';
import { setNickname, updateMyPostsNickname } from '@/lib/family';
import LoginModal from './modals/LoginModal';
import AdminToolsModal from './modals/AdminToolsModal';
import WorldClock from './WorldClock';
import SloganShow from './SloganShow';
import { OPEN_LOGIN_EVENT } from './games/LoginNudge';

/** 全页面共用顶栏：不论底部切到哪个 tab（今日/持仓/记忆/资讯/娱乐）都显示
 *  Logo 中英常驻；下方一条 slogan 横幅，一行中文，不折行 */
export default function AppHeader() {
  const { user, loading, configured, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [loginOpen, setLoginOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  // 顶栏用户菜单：改昵称 / 退出登录
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingNick, setEditingNick] = useState(false);
  const [nickDraft, setNickDraft] = useState('');

  // 各处（登录提示横幅等）可派发 OPEN_LOGIN_EVENT 打开登录弹窗
  useEffect(() => {
    const open = () => setLoginOpen(true);
    window.addEventListener(OPEN_LOGIN_EVENT, open);
    return () => window.removeEventListener(OPEN_LOGIN_EVENT, open);
  }, []);

  const shortName = useNickname(user?.email);
  const isAdmin = isAdminEmail(user?.email);
  const adminRole = getAdminRole(user?.email);

  const saveNick = async () => {
    const n = nickDraft.trim().slice(0, 12) || shortName;
    setNickname(n); // 广播：顶栏/帖子署名等一起更新
    setEditingNick(false);
    setMenuOpen(false);
    if (user) {
      try {
        await updateMyPostsNickname(user.id, n);
      } catch {
        /* 本地已更新，署名下次加载时同步 */
      }
    }
  };

  return (
    <div className="max-w-md mx-auto">
      <div className="px-4 pt-4 pb-1.5">
        <header className="flex justify-between items-center gap-2">
          {/* 左：Logo 中英常驻，不随语言切换 */}
          <h1 className="text-xl font-bold text-slate-100 whitespace-nowrap">
            股神乐 Gushenle
          </h1>
          {/* 右：操作行 */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 登录态：未配置 Supabase 时不显示，保持游客模式干净 */}
            {configured && !loading && (
              user ? (
                <div className="relative">
                  <button
                    onClick={() => {
                      setMenuOpen((v) => !v);
                      setEditingNick(false);
                    }}
                    title={user.email || ''}
                    className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 active:scale-95 transition"
                  >
                    <UserRound className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="max-w-[72px] truncate">{shortName}</span>
                    {adminRole && (
                      <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold leading-tight">
                        {ADMIN_ROLE_LABEL[adminRole]}
                      </span>
                    )}
                    <ChevronDown className="w-3 h-3 text-slate-500" />
                  </button>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => {
                          setMenuOpen(false);
                          setEditingNick(false);
                        }}
                      />
                      <div className="absolute right-0 top-full mt-1.5 z-50 w-56 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2">
                        {editingNick ? (
                          <div className="p-1">
                            <p className="text-[11px] text-slate-400 mb-1.5 px-1">
                              取一个好听的昵称
                            </p>
                            <input
                              autoFocus
                              value={nickDraft}
                              onChange={(e) => setNickDraft(e.target.value.slice(0, 12))}
                              placeholder="比如：韭菜终结者"
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
                            />
                            <div className="flex gap-1.5 mt-2">
                              <button
                                onClick={saveNick}
                                className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold active:scale-95 transition"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingNick(false)}
                                className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs active:scale-95 transition"
                              >
                                取消
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="px-2.5 py-1.5 text-[10px] text-slate-500 truncate">
                              {user.email}
                            </div>
                            <button
                              onClick={() => {
                                setNickDraft(shortName);
                                setEditingNick(true);
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2 active:scale-95 transition"
                            >
                              <Pencil className="w-3.5 h-3.5 text-slate-500" />
                              改昵称
                            </button>
                            <button
                              onClick={() => {
                                setMenuOpen(false);
                                if (confirm(t('logoutConfirm'))) void signOut();
                              }}
                              className="w-full text-left px-2.5 py-2 rounded-lg text-xs text-rose-300 hover:bg-slate-800 flex items-center gap-2 active:scale-95 transition"
                            >
                              <LogOut className="w-3.5 h-3.5 text-slate-500" />
                              退出登录
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setLoginOpen(true)}
                  className="bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 active:scale-95 transition"
                >
                  <UserRound className="w-3.5 h-3.5" /> {t('login')}
                </button>
              )
            )}
            {/* 语言切换：登录右边 */}
            <div className="flex bg-slate-800 border border-slate-700 rounded-full text-[10px] overflow-hidden">
              {(['zh', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={`px-2 py-1 transition ${
                    lang === l
                      ? 'bg-slate-600 text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {l === 'zh' ? '中' : 'EN'}
                </button>
              ))}
            </div>
            {/* 站长专属：工具箱入口 */}
            {isAdmin && (
              <button
                onClick={() => setToolsOpen(true)}
                title={t('adminTools')}
                className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2 py-1 rounded-full flex items-center active:scale-95 transition"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>
      </div>
      {/* 页头横幅：双时钟 + 五角星/红绿折线 slogan（纯本地动画，零网络请求） */}
      <div className="border-y border-slate-800/80 bg-slate-900/40">
        <WorldClock />
        <SloganShow />
      </div>
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {toolsOpen && <AdminToolsModal onClose={() => setToolsOpen(false)} />}
    </div>
  );
}
