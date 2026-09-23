'use client';

import React, { createContext, useContext, useState } from 'react';

type Language = 'zh' | 'en';

// 1. 定义全站字典文本
const translations = {
  zh: {
    // 通用
    title: '股神乐 (Gushenle)',
    subtitle: '理性投资与情绪调节助手',
    testConnection: '点击开始测试连通性',
    testing: '测试运行中...',
    supabaseDb: '1. Supabase 数据库',
    geminiApi: '2. Gemini Flash API',
    
    // 咯咯乐小游戏
    gameTitle: '🎮 沉思乐：【韭菜咯咯乐】',
    slicedCount: '🌱 已割韭菜情绪',
    timeLeft: '⏱️ 冷静倒计时',
    speedLabel: '韭菜飘升速度',
    speedSlow: '🐢 悠闲',
    speedNormal: '🚶 标准',
    speedFast: '⚡ 暴走',
    calmTitle: '理性已回归！',
    calmDesc: '你成功切碎了 {count} 株冲动韭菜！\n“市场永远不缺机会，冷静才是最大的红利。”',
    playAgain: '🔄 再割一把',
    returnDecision: '🚀 返回决策',
    gameTip: '划动光标/手指割断韭菜气泡，冷静 20 秒',
    
    // 情绪词汇
    words: ['追高梭哈', '听小道消息', '割肉离场', '加杠杆', '恐慌抛售', '凭感觉买入', '频繁交易', '盲目跟风'],
  },
  en: {
    // Common
    title: 'Gushenle',
    subtitle: 'Objective Rhythm Analysis & Emotional Regulation Companion',
    testConnection: 'Run Connectivity Test',
    testing: 'Testing...',
    supabaseDb: '1. Supabase DB',
    geminiApi: '2. Gemini Flash API',
    
    // Game
    gameTitle: '🎮 Meditation Zone: Clipper Party',
    slicedCount: '🌱 FOMO Cleared',
    timeLeft: '⏱️ Cool-down',
    speedLabel: 'Rising Speed',
    speedSlow: '🐢 Relaxed',
    speedNormal: '🚶 Normal',
    speedFast: '⚡ Rush',
    calmTitle: 'Rationality Restored!',
    calmDesc: 'You successfully cleared {count} impulsive thoughts!\n"The market never lacks opportunity; remaining calm is your true alpha."',
    playAgain: '🔄 Play Again',
    returnDecision: '🚀 Back to Dashboard',
    gameTip: 'Slash floating FOMO bubbles to enter a 20s calm zone',
    
    // Emotional Words
    words: ['FOMO All-In', 'Rumor Trading', 'Panic Selling', 'Over-Leverage', 'Panic Dump', 'Gut-Buying', 'Over-Trading', 'Blind Herd'],
  },
};

interface LanguageContextType {
  lang: Language;
  toggleLanguage: () => void;
  t: (key: keyof typeof translations['zh'], params?: Record<string, any>) => any;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('zh');

  const toggleLanguage = () => {
    setLang((prev) => (prev === 'zh' ? 'en' : 'zh'));
  };

  const t = (key: keyof typeof translations['zh'], params?: Record<string, any>) => {
    let text = translations[lang][key] || translations['zh'][key] || key;
    if (typeof text === 'string' && params) {
      Object.keys(params).forEach((p) => {
        text = (text as string).replace(`{${p}}`, params[p]);
      });
    }
    return text;
  };

  return (
    <LanguageContext.Provider value={{ lang, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}