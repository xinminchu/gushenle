/**
 * 管理员角色：邮箱 → 角色。Founder 与 Co-founder 都有管理权限
 * （站长工具箱、数据库迁移、许愿池公开回复）。
 */
export const ADMIN_ROLES: Record<string, 'founder' | 'cofounder'> = {
  'ecfollower@gmail.com': 'founder',
  'icey.bulbasaur@gmail.com': 'cofounder',
};

/** 兼容旧引用：站长主邮箱 */
export const ADMIN_EMAIL = 'ecfollower@gmail.com';

export type AdminRole = 'founder' | 'cofounder';

export function getAdminRole(email: string | null | undefined): AdminRole | null {
  if (!email) return null;
  return ADMIN_ROLES[email.toLowerCase()] ?? null;
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return getAdminRole(email) !== null;
}

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  founder: 'Founder',
  cofounder: 'Co-founder',
};
