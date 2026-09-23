import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase 浏览器客户端。
 * 需要在 Vercel（及本地 .env.local）配置：
 *   NEXT_PUBLIC_SUPABASE_URL=https://rscdasmshhoitjmtisnq.supabase.co
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=<piis-db 项目的 publishable key>
 * 未配置时返回 null，App 降级为纯游客模式，不崩溃。
 */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = (): boolean => supabase !== null;
