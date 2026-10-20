'use client';

import React from 'react';
import { Coffee } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import { TIP_PRESETS, TIP_CUSTOM_URL, tipsEnabled } from '@/lib/tips';

/**
 * 打赏卡（自愿支持）：娱乐页许愿池下方。
 * 链接未配置时不渲染；结账在 Stripe 托管页完成，本站不经手支付信息。
 */
export default function SupportCard() {
  const { lang } = useLanguage();
  if (!tipsEnabled()) return null;

  const presets = TIP_PRESETS.filter((p) => p.url);

  return (
    <div className="border border-amber-500/30 bg-amber-500/5 rounded-xl py-4 px-4 text-center">
      <p className="text-sm text-amber-200 flex items-center justify-center gap-1.5">
        <Coffee size={16} />
        {tx(lang, 'Buy the builder a coffee', '请站长喝杯咖啡')}
      </p>
      <p className="text-xs text-slate-400 mt-2 leading-relaxed">
        {tx(
          lang,
          'Gushenle is a free one-person project. If it helped you stay calm and skip an impulsive trade, you can chip in toward the server bills below.',
          '股神乐是站长一个人业余时间做的小站，一直免费。如果它帮你稳住过心态、少冲动了一回，可以随手支持一下服务器费用。'
        )}
      </p>
      <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
        {presets.map((p) => (
          <a
            key={p.usd}
            href={p.url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-sm font-semibold transition-colors"
          >
            ${p.usd}
          </a>
        ))}
        {TIP_CUSTOM_URL && (
          <a
            href={TIP_CUSTOM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-full border border-amber-500/50 text-amber-200 text-sm hover:bg-amber-500/10 transition-colors"
          >
            {tx(lang, 'Any amount', '随心金额')}
          </a>
        )}
      </div>
      <p className="text-[10px] text-slate-500 mt-3">
        {tx(
          lang,
          'Secure checkout by Stripe · Tips are voluntary support with no perks attached, and never investment advice.',
          '经 Stripe 安全支付 · 打赏纯属自愿支持，不附带任何权益，更不是投资建议；不打赏不影响任何功能。'
        )}
      </p>
    </div>
  );
}
