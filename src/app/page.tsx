'use client';

import React, { useState } from 'react';
// 相对路径导入组件
import BottomNav from '../components/BottomNav';
import SiteFooter from '../components/SiteFooter';
import { useSiteInfo } from '../components/modals/SiteInfoModal';
import PortfolioTab from '../components/tabs/PortfolioTab';
import MemoryTab from '../components/tabs/MemoryTab';
import CommunityTab from '../components/tabs/CommunityTab';
import FunTab from '../components/tabs/FunTab';

// 导入谷峰律动看板组件
import RhythmDashboard from '@/components/RhythmDashboard';
import AppHeader from '@/components/AppHeader';
import { WatchlistProvider, useWatchlist } from '@/components/WatchlistContext';
import { AuthProvider } from '@/context/AuthContext';

export default function Home() {
  return (
    <AuthProvider>
      <WatchlistProvider>
        <HomeInner />
      </WatchlistProvider>
    </AuthProvider>
  );
}

function HomeInner() {
  // 当前激活的页签状态：'today' | 'portfolio' | 'memory' | 'community' | 'fun'
  const [activeTab, setActiveTab] = useState<string>('today');
  const { setFocusSymbol } = useWatchlist();
  const { openSection, modal } = useSiteInfo();

  // 持仓页点某只 -> 跳到今日页看它的律动诊断
  const viewSymbol = (symbol: string) => {
    setFocusSymbol(symbol);
    setActiveTab('today');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 relative pb-32">
      {/* 全页面共用顶栏：所有 tab 顶部都显示 */}
      <AppHeader />

      {/* 动态渲染当前选中的 Tab 页面（全站统一手机宽度：max-w-md 居中，电脑上不拉宽） */}
      <div className="w-full">
        {activeTab === 'today' && (
          <section className="p-4 max-w-md mx-auto">
            <RhythmDashboard onGoPortfolio={() => setActiveTab('portfolio')} />
          </section>
        )}
        {activeTab === 'portfolio' && <PortfolioTab onViewSymbol={viewSymbol} />}
        {activeTab === 'memory' && <MemoryTab />}
        {activeTab === 'community' && <CommunityTab />}
        {activeTab === 'fun' && <FunTab />}
      </div>

      {/* 站点页脚：简介 / 用法 / 版权法律 / 时间轴 */}
      <SiteFooter onOpen={openSection} />
      {modal}

      {/* 底部导航栏 */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </main>
  );
}
