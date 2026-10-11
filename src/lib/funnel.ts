/**
 * 投资习惯漏斗 v1：轻量行为事件打点。
 *
 * 只记"做了什么"（看了诊断 / 记了一笔 / 看了复盘），不记金额、价格等财务细节。
 * 事件走 POST /api/funnel/track，fire-and-forget，不阻塞 UI。
 * 登录用户用 user_id 归因，游客用 localStorage 匿名 ID（gushenle_anon_id_v1）。
 */

export type FunnelEvent = 'diagnosis_view' | 'operation_log' | 'review_view';

const ANON_KEY = 'gushenle_anon_id_v1';

export function getAnonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return 'unknown';
  }
}

export function trackFunnelEvent(
  event: FunnelEvent,
  opts?: { symbol?: string; userId?: string | null; meta?: Record<string, unknown> },
): void {
  try {
    const actor_type = opts?.userId ? 'user' : 'anon';
    const actor_id = opts?.userId || getAnonId();
    fetch('/api/funnel/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        actor_id,
        actor_type,
        symbol: opts?.symbol ? String(opts.symbol).toUpperCase() : null,
        meta: opts?.meta ?? {},
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* 打点失败静默，不影响主流程 */
  }
}
