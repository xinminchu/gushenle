'use client';

import React, { useState } from 'react';
import { UserRound, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useNickname } from '@/hooks/useNickname';
import { isAdminEmail } from '@/lib/admin';
import LoginModal from './modals/LoginModal';
import AdminToolsModal from './modals/AdminToolsModal';

/** 全页面共用顶栏：不论底部切到哪个 tab（今日/持仓/记忆/资讯/娱乐）都显示 */
export default function AppHeader() {
  const { user, loading, configured, signOut } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [loginOpen, setLoginOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const shortName = useNickname(user?.email);
  const isAdmin = isAdminEmail(user?.email);

  return (
    <div className="p-4 pb-1 max-w-md mx-auto">
      <header className="flex justify-between items-start gap-2 pt-2">
        {/* 左：标题一行，不折行 */}
        <h1 className="text-xl font-bold text-slate-100 whitespace-nowrap pt-1.5">
          {t('appName')}
        </h1>
        {/* 右：两句 tagline + 操作行 */}
        <div className="flex flex-col items-end gap-1.5 min-w-0">
          <div className="text-right leading-tight">
            <p className="text-[10px] text-slate-400">{t('tagline1')}</p>
            <p className="text-[10px] text-slate-500">{t('tagline2')}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {/* 登录态：未配置 Supabase 时不显示，保持游客模式干净 */}
            {configured && !loading && (
              user ? (
                <button
                  onClick={() => {
                    if (confirm(t('logoutConfirm'))) void signOut();
                  }}
                  title={user.email || ''}
                  className="bg-slate-800 border border-slate-700 text-slate-300 text-xs px-2.5 py-1 rounded-full flex items-center gap-1"
                >
                  <UserRound className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="max-w-[72px] truncate">{shortName}</span>
                  <LogOut className="w-3 h-3 text-slate-500" />
                </button>
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
        </div>
      </header>
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {toolsOpen && <AdminToolsModal onClose={() => setToolsOpen(false)} />}
    </div>
  );
}
