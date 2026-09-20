'use client';

import React from 'react';
import { Home, Briefcase, Mic, Users, Gamepad2 } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const navItems = [
    { id: 'today', label: '今日', icon: Home },
    { id: 'portfolio', label: '持仓', icon: Briefcase },
    { id: 'memory', label: '记忆', icon: Mic },
    { id: 'community', label: '大家乐', icon: Users },
    { id: 'fun', label: '娱乐', icon: Gamepad2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 text-slate-400">
      <div className="flex justify-around items-center h-16 max-w-md mx-auto px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors ${
                isActive ? 'text-emerald-400 font-medium' : 'hover:text-slate-200'
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'scale-110' : ''} transition-transform`} />
              <span className="text-xs">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}