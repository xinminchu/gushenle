'use client';

import React, { useState } from 'react';
import BottomNav from '@/components/BottomNav';
import TodayTab from '@/components/tabs/TodayTab';
import MemoryTab from '@/components/tabs/MemoryTab';

export default function Home() {
  const [activeTab, setActiveTab] = useState('today');

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* 根据当前 Tab 切换内容 */}
      {activeTab === 'today' && <TodayTab />}
      {activeTab === 'memory' && <MemoryTab />}
      {/* 剩余 Tab 按照需求引入 */}

      {/* 底部导航栏 */}
      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </main>
  );
}