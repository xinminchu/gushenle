'use client';

import React, { useState } from 'react';
// 使用相对路径确保打包与 Turbopack 解析 100% 准确
import BottomNav from '../components/BottomNav';
import TodayTab from '../components/tabs/TodayTab';
import PortfolioTab from '../components/tabs/PortfolioTab';
import MemoryTab from '../components/tabs/MemoryTab';
import CommunityTab from '../components/tabs/CommunityTab';
import FunTab from '../components/tabs/FunTab';

export default function Home() {
  // 当前激活的页签状态：'today' | 'portfolio' | 'memory' | 'community' | 'fun'
  const [activeTab, setActiveTab] = useState<string>('today');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 relative pb-32">
      {/* 动态渲染当前选中的 Tab 页面 */}
      <div className="w-full">
        {activeTab === 'today' && <TodayTab />}
        {activeTab === 'portfolio' && <PortfolioTab />}
        {activeTab === 'memory' && <MemoryTab />}
        {activeTab === 'community' && <CommunityTab />}
        {activeTab === 'fun' && <FunTab />}
      </div>

      {/* 底部导航栏 */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </main>
  );
}