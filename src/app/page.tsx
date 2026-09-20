'use client';

import Link from 'next/link';
import ClipperGame from '@/components/games/Clipper';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

function MainContent() {
  const { lang, toggleLanguage } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start p-4 sm:p-8">
      {/* 顶部 Header：标题、测试入口与语言切换 */}
      <header className="w-full max-w-xl flex items-center justify-between mb-6 pt-2 pb-4 border-b border-slate-800/80">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            股神乐 <span className="text-xs font-normal text-slate-400">(Gushenle)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">理性投资与情绪调节助手</p>
        </div>

        <div className="flex items-center gap-3">
          {/* 轻量级测试页面入口链接 */}
          <Link
            href="/test"
            className="text-xs text-slate-400 hover:text-emerald-400 underline underline-offset-4 transition"
          >
            {lang === 'zh' ? '系统诊断/测试' : 'System Diagnostic'}
          </Link>

          {/* 语言切换按钮 */}
          <button
            onClick={toggleLanguage}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-md transition border border-slate-700"
          >
            {lang === 'zh' ? 'English' : '中文'}
          </button>
        </div>
      </header>

      {/* 主体部分：游戏区域 */}
      <main className="w-full max-w-xl flex flex-col items-center">
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