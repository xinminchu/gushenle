'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { STRINGS, LEGACY_WORDS, type Lang } from '@/lib/i18n';

const KEY = 'gushenle_lang_v1';

interface LanguageContextType {
  lang: Lang;
  /** 旧 API（/test 调试页在用）：中英互切 */
  toggleLanguage: () => void;
  setLang: (l: Lang) => void;
  /** t('login')，支持 {s} 占位：t('resendIn', { s: 60 })；未知 key 原样返回 */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** 旧 API：情绪词数组（/test 调试页在用） */
  words: string[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('zh');

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === 'en' || v === 'zh' || v === 'hant') setLangState(v);
    } catch {
      /* 忽略 */
    }
  }, []);

  useEffect(() => {
    try {
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang === 'hant' ? 'zh-Hant' : 'en';
      document.title =
        lang === 'zh'
          ? '股神乐 (Gushenle) - 个人与家庭投资伴侣'
          : lang === 'hant'
            ? '股神樂 (Gushenle) - 個人與家庭投資伴侶'
            : 'Gushenle - Personal & family investment companion';
    } catch {
      /* 忽略 */
    }
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(KEY, l);
    } catch {
      /* 忽略 */
    }
  };

  const toggleLanguage = () => setLang(lang === 'zh' ? 'en' : 'zh');

  const t = (key: string, params?: Record<string, string | number>) => {
    const dict = STRINGS[lang] as Record<string, string>;
    let text: string = dict[key] ?? (STRINGS.zh as Record<string, string>)[key] ?? key;
    if (params) {
      for (const p of Object.keys(params)) {
        text = text.replace(`{${p}}`, String(params[p]));
      }
    }
    return text;
  };

  const title =
    lang === 'zh'
      ? '股神乐 (Gushenle) - 个人与家庭投资伴侣'
      : lang === 'hant'
        ? '股神樂 (Gushenle) - 個人與家庭投資伴侶'
        : 'Gushenle - Personal & family investment companion';

  return (
    <>
      {/* React 19 会把这个 <title> hoist 到 head 最前面（先于 metadata 的 title），
          浏览器取第一个 <title>，且 Next 的 head 管理也会以它为准同步 document.title。
          之前只用 document.title 赋值会被 Next 的 head 管理覆盖回去，故改走声明式。 */}
      <title>{title}</title>
      <LanguageContext.Provider
        value={{ lang, toggleLanguage, setLang, t, words: LEGACY_WORDS[lang] }}
      >
        {children}
      </LanguageContext.Provider>
    </>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
