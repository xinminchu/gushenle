// src/lib/mfa.ts
// 动态密码器（TOTP，如 Google Authenticator / 1Password）——Supabase Auth MFA。
//  - 启用：登录状态下 enroll → 扫码 → 输 6 位码确认
//  - 登录：密码通过后若 nextLevel=a a l2，challenge + verify 拿第二步
//  - 关闭：unenroll
'use client';

import { supabase } from './supabase';

export interface TotpFactor {
  id: string;
  friendlyName?: string;
  status: string;
}

/** 当前账号已验证的 TOTP 因子（没有返回 null） */
export async function getVerifiedTotpFactor(): Promise<TotpFactor | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error || !data) return null;
    const list: any[] = (data as any).totp ?? (data as any).all ?? [];
    const f = list.find((x) => x.factor_type === 'totp' && x.status === 'verified') ?? list[0];
    return f ? { id: f.id, friendlyName: f.friendly_name, status: f.status } : null;
  } catch {
    return null;
  }
}

/** 开始启用：返回扫码用的二维码 SVG、手动输入的密钥、factorId */
export async function enrollTotp(): Promise<
  { factorId: string; qrCode: string; secret: string } | { error: string }
> {
  if (!supabase) return { error: '登录功能尚未配置' };
  try {
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator',
    });
    if (error || !data) return { error: error?.message || '启用失败，稍后再试' };
    return {
      factorId: data.id,
      qrCode: (data as any).totp?.qr_code ?? '',
      secret: (data as any).totp?.secret ?? '',
    };
  } catch (e: any) {
    return { error: e?.message || '启用失败，稍后再试' };
  }
}

/** 确认启用：用户输 App 里 6 位码 */
export async function confirmTotpEnrollment(factorId: string, code: string): Promise<string | null> {
  if (!supabase) return '登录功能尚未配置';
  const clean = code.trim().replace(/\D/g, '');
  if (clean.length !== 6) return '输入 6 位数字';
  try {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: clean });
    return error ? '验证码不对，再试一次' : null;
  } catch {
    return '验证失败，稍后再试';
  }
}

/** 登录第二步：密码已过，验证动态密码 */
export async function verifyTotpLogin(factorId: string, code: string): Promise<string | null> {
  if (!supabase) return '登录功能尚未配置';
  const clean = code.trim().replace(/\D/g, '');
  if (clean.length !== 6) return '输入 6 位数字';
  try {
    const ch = await supabase.auth.mfa.challenge({ factorId });
    if (ch.error || !ch.data) return '验证失败，稍后再试';
    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: ch.data.id,
      code: clean,
    });
    return error ? '验证码不对，再试一次' : null;
  } catch {
    return '验证失败，稍后再试';
  }
}

/** 关闭动态密码器 */
export async function unenrollTotp(factorId: string): Promise<string | null> {
  if (!supabase) return '登录功能尚未配置';
  try {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    return error ? '关闭失败，稍后再试' : null;
  } catch {
    return '关闭失败，稍后再试';
  }
}

/** 登录状态下设置 / 修改密码 */
export async function updatePassword(password: string): Promise<string | null> {
  if (!supabase) return '登录功能尚未配置';
  if (password.length < 6) return '密码至少 6 位';
  try {
    const { error } = await supabase.auth.updateUser({ password });
    return error ? '设置失败，稍后再试' : null;
  } catch {
    return '设置失败，稍后再试';
  }
}
