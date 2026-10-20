'use client';

import React from 'react';
import Link from 'next/link';
import { Coffee } from 'lucide-react';
import { LanguageProvider, useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';

function TippedContent() {
  const { lang } = useLanguage();
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full border border-amber-500/30 bg-amber-500/5 rounded-2xl py-10 px-6 text-center">
        <Coffee size={40} className="mx-auto text-amber-300" />
        <h1 className="text-xl font-semibold text-amber-200 mt-4">
          {tx(lang, 'Got it — thank you!', '收到啦，谢谢你！')}
        </h1>
        <p className="text-sm text-slate-400 mt-3 leading-relaxed">
          {tx(
            lang,
            'Your coffee is on its way to keeping Gushenle free for everyone. No perks, no promises — just thanks.',
            '你的心意站长收到了。股神乐会继续免费做下去——不附带权益、不承诺回报，只有谢谢。'
          )}
        </p>
        <Link
          href="/"
          className="inline-block mt-6 px-5 py-2 rounded-full bg-amber-500/90 hover:bg-amber-400 text-slate-900 text-sm font-semibold transition-colors"
        >
          {tx(lang, 'Back to Gushenle', '回到股神乐')}
        </Link>
      </div>
    </main>
  );
}

export default function TippedPage() {
  return (
    <LanguageProvider>
      <TippedContent />
    </LanguageProvider>
  );
}
