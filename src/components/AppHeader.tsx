'use client';

import React from 'react';
import { Smile } from 'lucide-react';

/** 全页面共用顶栏：不论底部切到哪个 tab（今日/持仓/记忆/家人/娱乐）都显示 */
export default function AppHeader() {
  return (
    <div className="p-4 pb-1 max-w-md mx-auto">
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">股神乐 Gushenle</h1>
          <p className="text-xs text-slate-400 mt-0.5">快乐炒股，轻松投资。不赌，不堵。</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full flex items-center gap-1 shrink-0">
          <Smile className="w-3.5 h-3.5" /> 安心享受生活
        </div>
      </header>
    </div>
  );
}
