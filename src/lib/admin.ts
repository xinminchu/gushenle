/** 站长（管理员）身份：只有这个邮箱登录后才能看到「管理」入口、执行数据库迁移。 */
export const ADMIN_EMAIL = 'ecfollwer@gmail.com';

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === ADMIN_EMAIL;
}
