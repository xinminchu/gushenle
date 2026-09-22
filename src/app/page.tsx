'use client';

import React, { useState } from 'react';
// 相对路径导入组件
import BottomNav from '../components/BottomNav';
import TodayTab from '../components/tabs/TodayTab';
import PortfolioTab from '../components/tabs/PortfolioTab';
import MemoryTab from '../components/tabs/MemoryTab';
import CommunityTab from '../components/tabs/CommunityTab';
import FunTab from '../components/tabs/FunTab';

// 导入谷峰律动看板组件
import RhythmDashboard from '@/components/RhythmDashboard';
import AppHeader from '@/components/AppHeader';

export default function Home() {
  // 当前激活的页签状态：'today' | 'portfolio' | 'memory' | 'community' | 'fun'
  const [activeTab, setActiveTab] = useState<string>('today');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 selection:bg-emerald-500/30 relative pb-32">
      {/* 全页面共用顶栏：所有 tab 顶部都显示 */}
      <AppHeader />

      {/* 动态渲染当前选中的 Tab 页面 */}
      <div className="w-full">
        {activeTab === 'today' && (
          <div className="space-y-6">
            {/* 嵌入谷峰律动看板 */}
            <section className="p-4 md:p-6">
              <RhythmDashboard />
            </section>
            
            {/* 原有的 TodayTab 内容 */}
            <TodayTab />
          </div>
        )}
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