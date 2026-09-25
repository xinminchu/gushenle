/** 站长（Mas）公开回复草稿
 * 只站长可见：选中一条可再修改，复制后去许愿池对应留言下粘贴发布。
 * 草稿本身不会自动发布，发哪条、发不发由站长亲手决定。
 *
 * 2026-09-24 清理：4 条已用草稿（飞镖选股/梭哈总赢/K 线教学/蓝筹股）已粘贴发布，
 * 数组置空。以后有新草稿直接往 REPLY_DRAFTS 里加，两处 UI（站长工具箱轮盘、
 * 许愿池草稿 chips）会自动出现，空数组时自动隐藏。
 */
export interface ReplyDraft {
  label: string;
  text: string;
}

export const REPLY_DRAFTS: ReplyDraft[] = [];
