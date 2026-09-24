'use client';

import React from 'react';
import { Home, Briefcase, Mic, Newspaper, Gamepad2 } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const { t } = useLanguage();
  const navItems = [
    { id: 'today', label: t('navToday'), icon: Home },
    { id: 'portfolio', label: t('navPortfolio'), icon: Briefcase },
    { id: 'memory', label: t('navMemory'), icon: Mic },
    { id: 'community', label: t('navCommunity'), icon: Newspaper },
    { id: 'fun', label: t('navFun'), icon: Gamepad2 },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-slate-900/95 backdrop-blur-md border-t border-slate-800 text-slate-400 select-none"
      style={{
        WebkitTransform: 'translateZ(0)',
        transform: 'translateZ(0)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))', // 抬高底部间距，规避手机底部工具栏遮挡
      }}
    >
      <div className="flex justify-around items-center h-14 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full py-1 touch-manipulation cursor-pointer transition-colors ${
                isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400 active:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform pointer-events-none`} />
              <span className="text-[11px] leading-none mt-1 pointer-events-none">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}