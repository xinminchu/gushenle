import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAdminRole } from './admin';

/**
 * 服务端管理员鉴权（/api/admin/* 共用）：
 * 从 Authorization: Bearer <access_token> 验签，邮箱必须在管理员角色表里
 * （Founder / Co-founder 都有管理权限）。
 * 返回 user 或 null。
 */
export async function requireAdmin(req: NextRequest) {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !URL || !ANON) return null;
  const sb = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) return null;
  if (!getAdminRole(data.user.email)) return null;
  return data.user;
}

/** service_role 客户端：绕过 RLS，用于管理员服务端写入 */
export function serviceClient() {
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL || !key) return null;
  return createClient(URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
