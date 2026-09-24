'use client';

import React, { useState } from 'react';
import { Smile, UserRound, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNickname } from '@/hooks/useNickname';
import { isAdminEmail } from '@/lib/admin';
import LoginModal from './modals/LoginModal';
import AdminToolsModal from './modals/AdminToolsModal';

/** 全页面共用顶栏：不论底部切到哪个 tab（今日/持仓/记忆/家人/娱乐）都显示 */
export default function AppHeader() {
  const { user, loading, configured, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  const shortName = useNickname(user?.email);
  const isAdmin = isAdminEmail(user?.email);

  return (
    <div className="p-4 pb-1 max-w-md mx-auto">
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">股神乐 Gushenle</h1>
          <p className="text-xs text-slate-400 mt-0.5">快乐炒股 轻松投资</p>
          <p className="text-xs text-slate-500 mt-0.5">不赌不堵 不气不弃</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* 登录态：未配置 Supabase 时不显示，保持游客模式干净 */}
          {configured && !loading && (
            user ? (
              <button
                onClick={() => {
                  if (confirm('退出登录？本地战绩不受影响。')) void signOut();
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
                <UserRound className="w-3.5 h-3.5" /> 登录
              </button>
            )
          )}
          {/* 站长专属：工具箱入口 */}
          {isAdmin && (
            <button
              onClick={() => setToolsOpen(true)}
              title="站长工具"
              className="bg-slate-800 border border-slate-700 text-slate-400 text-xs px-2 py-1 rounded-full flex items-center active:scale-95 transition"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
            <Smile className="w-3.5 h-3.5" /> 安心享受生活
          </div>
        </div>
      </header>
      {loginOpen && <LoginModal onClose={() => setLoginOpen(false)} />}
      {toolsOpen && <AdminToolsModal onClose={() => setToolsOpen(false)} />}
    </div>
  );
}
