'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mergeCloudStats } from '@/lib/gameStats';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  /** 发登录邮件（magic link），返回错误信息（无错误返回 null） */
  sendCode: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: false,
  sendCode: async () => '未配置',
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function friendlyError(msg: string): string {
  if (/rate/i.test(msg)) return '发送太频繁，稍后再试';
  if (/email/i.test(msg) && /invalid/i.test(msg)) return '邮箱格式不对，检查一下';
  return '出了点小问题，稍后再试';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (event === 'SIGNED_IN') {
        // 点邮件链接回来后，地址栏会带上 token 参数，清掉它
        if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
        // 登录成功：把云端战绩合并到本地
        try {
          await mergeCloudStats();
        } catch {
          /* 忽略 */
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const sendCode = async (email: string): Promise<string | null> => {
    if (!supabase) return '登录功能尚未配置';
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return '邮箱格式不对，检查一下';
    const { error } = await supabase.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: true,
        // 点邮件里的链接后回到当前页面（需在 Supabase Redirect URLs 里允许）
        emailRedirectTo:
          typeof window !== 'undefined'
            ? window.location.origin + window.location.pathname
            : undefined,
      },
    });
    return error ? friendlyError(error.message) : null;
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, configured, sendCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
