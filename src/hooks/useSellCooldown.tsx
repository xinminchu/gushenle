'use client';

import { useCallback, useState } from 'react';
import { useLanguage } from '@/context/LanguageContext';
import { checkSellCooldown, type CooldownData } from '@/lib/sellCooldown';
import SellCooldownModal from '@/components/SellCooldownModal';

/**
 * 卖出冷静 hook：记"卖出"前调 guardSell(symbol, price, proceed)。
 * 触发条件满足时弹三眼 modal；否则直接 proceed。
 */
export function useSellCooldown() {
  const { lang } = useLanguage();
  const [pending, setPending] = useState<{ data: CooldownData; proceed: () => void } | null>(null);
  const [checking, setChecking] = useState(false);

  const guardSell = useCallback(
    async (symbol: string, price: number, proceed: () => void) => {
      setChecking(true);
      try {
        const data = await checkSellCooldown(symbol, price, lang);
        if (data) setPending({ data, proceed });
        else proceed();
      } finally {
        setChecking(false);
      }
    },
    [lang],
  );

  const modal = pending ? (
    <SellCooldownModal
      data={pending.data}
      onCancel={() => setPending(null)}
      onProceed={() => {
        const p = pending.proceed;
        setPending(null);
        p();
      }}
    />
  ) : null;

  return { guardSell, sellCooldownModal: modal, sellChecking: checking };
}
