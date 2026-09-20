'use client';

import { useState } from 'react';
import ClipperGame from '@/components/games/Clipper';
import PeakTroughCard from '@/components/cards/PeakTroughCard';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

function MainContent() {
  const { lang, toggleLanguage } = useLanguage();
  const [showTest, setShowTest] = useState(false);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-start p-3 sm:p-6 overflow-x-hidden touch-none select-none">
      {/* 顶部 Header */}
      <header className="w-full max-w-4xl flex items-center justify-between mb-6 pt-1 pb-3 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-1.5">
            股神乐 <span className="text-xs font-normal text-slate-400">(Gushenle)</span>
          </h1>
          <p className="text-xs text-slate-400">理性投资与情绪调节助手</p>
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
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded border border-slate-700 transition"
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      {/* 可折叠的测试面板 */}
      {showTest && (
        <div className="w-full max-w-4xl mb-6 p-3 bg-slate-900/90 rounded-lg border border-slate-800 text-xs text-slate-300 space-y-2 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-slate-800 pb-1.5 font-semibold text-slate-200">
            <span>系统连接诊断</span>
            <span className="text-[10px] text-emerald-400">● 运行中</span>
          </div>
          <p>• Supabase 状态: 未连接 (需要在 .env 配置)</p>
          <p>• Gemini Flash API: 未配置</p>
        </div>
      )}

      {/* 看板主体区域 */}
      <main className="w-full max-w-4xl flex flex-col gap-6">
        {/* 1. 核心数据与分析卡片：波峰波谷分析 */}
        <section className="w-full">
          <PeakTroughCard />
        </section>

        {/* 2. 交互/游戏体验区 */}
        <section className="w-full flex justify-center">
          <div className="w-full max-w-md">
            <ClipperGame />
          </div>
        </section>
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