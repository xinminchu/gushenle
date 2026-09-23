'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mergeCloudStats } from '@/lib/gameStats';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  /** 发邮箱验证码，返回错误信息（无错误返回 null） */
  sendCode: (email: string) => Promise<string | null>;
  /** 校验验证码完成登录，返回错误信息（无错误返回 null） */
  verifyCode: (email: string, code: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: false,
  sendCode: async () => '未配置',
  verifyCode: async () => '未配置',
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function friendlyError(msg: string): string {
  if (/invalid/i.test(msg) && /otp|token|code/i.test(msg)) return '验证码不对或已过期，重试一次';
  if (/expired/i.test(msg)) return '验证码已过期，请重新发送';
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
      // 登录成功：把云端战绩合并到本地
      if (event === 'SIGNED_IN') {
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
      options: { shouldCreateUser: true },
    });
    return error ? friendlyError(error.message) : null;
  };

  const verifyCode = async (email: string, code: string): Promise<string | null> => {
    if (!supabase) return '登录功能尚未配置';
    const clean = email.trim().toLowerCase();
    const token = code.trim();
    if (token.length < 6) return '验证码是 6 位数字';
    const { error } = await supabase.auth.verifyOtp({
      email: clean,
      token,
      type: 'email',
    });
    return error ? friendlyError(error.message) : null;
  };

  const signOut = async (): Promise<void> => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, configured, sendCode, verifyCode, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
