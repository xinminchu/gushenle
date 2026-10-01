'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { mergeCloudStats } from '@/lib/gameStats';
import { mergeUserData } from '@/lib/userSync';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  configured: boolean;
  /** 发登录邮件（magic link），返回错误信息（无错误返回 null） */
  sendCode: (email: string) => Promise<string | null>;
  /** 邮箱 + 密码登录；若账号启用了动态密码器，返回 mfaFactorId（前端再走 TOTP 验证） */
  signInPassword: (email: string, password: string) => Promise<{ error: string | null; mfaFactorId: string | null }>;
  /** 邮箱 + 密码注册（本站关了 Confirm email，注册即登录） */
  signUpPassword: (email: string, password: string) => Promise<string | null>;
  /** 发密码重置邮件，返回错误信息（无错误返回 null） */
  sendPasswordReset: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  configured: false,
  sendCode: async () => '未配置',
  signInPassword: async () => ({ error: '未配置', mfaFactorId: null }),
  signUpPassword: async () => '未配置',
  sendPasswordReset: async () => '未配置',
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function friendlyError(msg: string): string {
  if (/rate/i.test(msg)) return '发送太频繁，稍后再试';
  if (/email/i.test(msg) && /invalid/i.test(msg)) return '邮箱格式不对，检查一下';
  if (/password/i.test(msg) && /weak|common|leak|breach|known/i.test(msg)) return '这个密码太常见了，换一个更特别的吧';
  return '出了点小问题，稍后再试';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();
  const userRef = useRef<User | null>(null);
  const lastMergeRef = useRef(0);

  /** 已登录时做一次用户数据合并（节流 30s，避免切 tab 反复跑） */
  const mergeIfLoggedIn = (u: User | null) => {
    if (!u) return;
    const now = Date.now();
    if (now - lastMergeRef.current < 30_000) return;
    lastMergeRef.current = now;
    mergeUserData().catch(() => {});
  };

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      userRef.current = u;
      setUser(u);
      setLoading(false);
      // 已经是登录态（比如之前没关页面）：打开 app 也合并一次
      mergeIfLoggedIn(u);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const u = session?.user ?? null;
      userRef.current = u;
      setUser(u);
      if (event === 'SIGNED_IN') {
        lastMergeRef.current = Date.now();
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
        // 登录成功：持仓/自选/资金/昵称与云端合并
        try {
          await mergeUserData();
        } catch {
          /* 忽略 */
        }
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // 邮件链接总是在新标签页打开：用户切回本页面时自动刷新登录态
  useEffect(() => {
    if (!supabase) return;
    const sb = supabase; // 闭包内 TS 无法保持上行的非空收窄，抓一个局部常量
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        sb.auth.getSession().then(({ data }) => {
          const u = data.session?.user ?? null;
          userRef.current = u;
          setUser(u);
          // 切回页面时也合并一次：另一台设备刚改过的数据能自动拿过来
          mergeIfLoggedIn(u);
        });
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
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

  /** 邮箱 + 密码登录。成功后查 AAL：若动态密码器已启用，返回 factorId 让前端走 TOTP。 */
  const signInPassword = async (
    email: string,
    password: string,
  ): Promise<{ error: string | null; mfaFactorId: string | null }> => {
    if (!supabase) return { error: '登录功能尚未配置', mfaFactorId: null };
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return { error: '邮箱格式不对，检查一下', mfaFactorId: null };
    if (password.length < 6) return { error: '密码至少 6 位', mfaFactorId: null };
    const { error } = await supabase.auth.signInWithPassword({ email: clean, password });
    if (error) {
      const m = error.message || '';
      if (/invalid login credentials/i.test(m)) return { error: 'WRONG_CREDENTIALS', mfaFactorId: null };
      return { error: friendlyError(m), mfaFactorId: null };
    }
    // 密码过了：看要不要第二步动态密码
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal && aal.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const list = (factors as any)?.totp ?? (factors as any)?.all ?? [];
        const totp = Array.isArray(list)
          ? list.find((f: any) => f.factor_type === 'totp' && f.status === 'verified') ?? list[0]
          : null;
        if (totp?.id) return { error: null, mfaFactorId: totp.id as string };
      }
    } catch {
      /* 查不到就当没启用，不挡登录 */
    }
    return { error: null, mfaFactorId: null };
  };

  const signUpPassword = async (email: string, password: string): Promise<string | null> => {
    if (!supabase) return '登录功能尚未配置';
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return '邮箱格式不对，检查一下';
    if (password.length < 6) return '密码至少 6 位';
    const { data, error } = await supabase.auth.signUp({ email: clean, password });
    if (error) {
      if (/already registered|already exists/i.test(error.message)) return 'ALREADY_REGISTERED';
      return friendlyError(error.message);
    }
    // 本站关了 Confirm email：正常应直接拿到 session；拿不到说明邮箱已存在（防枚举的模糊返回）
    if (!data.session) return 'ALREADY_REGISTERED';
    return null;
  };

  const sendPasswordReset = async (email: string): Promise<string | null> => {
    if (!supabase) return '登录功能尚未配置';
    const clean = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) return '邮箱格式不对，检查一下';
    const { error } = await supabase.auth.resetPasswordForEmail(clean, {
      redirectTo: typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined,
    });
    return error ? friendlyError(error.message) : null;
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, configured, sendCode, signInPassword, signUpPassword, sendPasswordReset, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
