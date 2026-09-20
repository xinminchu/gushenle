'use client';

import { useState } from 'react';
import ClipperGame from '@/components/games/Clipper';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

function MainContent() {
  const { lang, toggleLanguage } = useLanguage();
  const [showTest, setShowTest] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start p-3 sm:p-6 overflow-x-hidden touch-none select-none">
      {/* 顶部 Header：适配移动端宽度 */}
      <header className="w-full max-w-md flex items-center justify-between mb-4 pt-1 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
            股神乐 <span className="text-[10px] font-normal text-slate-400">(Gushenle)</span>
          </h1>
          <p className="text-[11px] text-slate-400">理性投资与情绪调节助手</p>
        </div>

        <div className="flex items-center gap-2">
          {/* 可随时展开/收起的测试入口 */}
          <button
            onClick={() => setShowTest(!showTest)}
            className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition"
          >
            {showTest 
              ? (lang === 'zh' ? '收起诊断' : 'Hide Test') 
              : (lang === 'zh' ? '系统诊断' : 'Diagnostic')}
          </button>

          {/* 语言切换 */}
          <button
            onClick={toggleLanguage}
            className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700"
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      {/* 可折叠的测试面板 */}
      {showTest && (
        <div className="w-full max-w-md mb-4 p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 font-semibold text-slate-200">
            <span>系统连接诊断</span>
            <span className="text-[10px] text-emerald-400">● 运行中</span>
          </div>
          <p>• Supabase 状态: 未连接 (需要在 .env 配置)</p>
          <p>• Gemini Flash API: 未配置</p>
        </div>
      )}

      {/* 主体部分：完美适配手机宽度的游戏区域 */}
      <main className="w-full max-w-md flex flex-col items-center justify-center">
        <ClipperGame />
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <MainContent />
    </LanguageProvider>
  );
}