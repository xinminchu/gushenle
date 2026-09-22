'use client';

import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import ClipperGame from '@/components/games/ClipperGame';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';

function TestContent() {
  const { lang, toggleLanguage, t } = useLanguage();
  const [supabaseStatus, setSupabaseStatus] = useState<string>('未测试');
  const [geminiStatus, setGeminiStatus] = useState<string>('未测试');
  const [loading, setLoading] = useState(false);

  const runTests = async () => {
    setLoading(true);
    setSupabaseStatus('测试中...');
    setGeminiStatus('测试中...');

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

      if (!supabaseUrl || !supabaseAnonKey) {
        setSupabaseStatus('❌ .env.local missing parameters');
      } else {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data, error } = await supabase.from('test').select('*').limit(1);
        if (error) {
          setSupabaseStatus(`❌ ${error.message}`);
        } else {
          setSupabaseStatus(`🟢 Connected! (${data?.[0]?.name || 'Success'})`);
        }
      }
    } catch (err: any) {
      setSupabaseStatus(`❌ ${err.message}`);
    }

    try {
      const res = await fetch('/api/test-gemini');
      const data = await res.json();
      if (res.ok && data.success) {
        setGeminiStatus(`🟢 Reply: "${data.reply}"`);
      } else {
        setGeminiStatus(`❌ ${data.error || 'Error'}`);
      }
    } catch (err: any) {
      setGeminiStatus(`❌ ${err.message}`);
    }

    setLoading(false);
  };

  return (
    <main className="p-8 max-w-xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-slate-500">{t('subtitle')}</p>
        </div>
        {/* 🌐 中英文切换按钮 */}
        <button
          onClick={toggleLanguage}
          className="border border-slate-300 dark:border-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          🌐 {lang === 'zh' ? 'English' : '中文'}
        </button>
      </div>

      <button
        onClick={runTests}
        disabled={loading}
        className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition mb-8 w-full"
      >
        {loading ? t('testing') : t('testConnection')}
      </button>

      <div className="space-y-4 mb-10">
        <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-800">
          <h2 className="font-semibold text-lg mb-1">{t('supabaseDb')}</h2>
          <p className="text-sm font-mono">{supabaseStatus}</p>
        </div>

        <div className="p-4 border rounded-xl bg-gray-50 dark:bg-gray-800">
          <h2 className="font-semibold text-lg mb-1">{t('geminiApi')}</h2>
          <p className="text-sm font-mono">{geminiStatus}</p>
        </div>
      </div>

      <div className="border-t pt-8">
        <h2 className="text-xl font-bold mb-4">{t('gameTitle')}</h2>
        <ClipperGame />
      </div>
    </main>
  );
}

export default function TestPage() {
  return (
    <LanguageProvider>
      <TestContent />
    </LanguageProvider>
  );
}
