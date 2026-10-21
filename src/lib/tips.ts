// 打赏（自愿支持）支付链接 — 单一数据源。
// 链接由 Stripe Payment Links 托管（站外安全结账，本站不经手卡号）。
// url 为空时 SupportCard 自动不渲染，填入真实链接即全站生效。

export interface TipPreset {
  usd: number;
  url: string;
}

export const TIP_PRESETS: TipPreset[] = [
  { usd: 2, url: '' },
  { usd: 3, url: '' },
  { usd: 5, url: '' },
  { usd: 8, url: '' },
  { usd: 10, url: '' },
];

/** 自定义金额的打赏链接（金额由用户在 Stripe 页填写） */
export const TIP_CUSTOM_URL = '';

export function tipsEnabled(): boolean {
  return TIP_PRESETS.some((p) => p.url) || Boolean(TIP_CUSTOM_URL);
}
