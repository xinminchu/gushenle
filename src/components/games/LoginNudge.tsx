'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { tx } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 🌱 登录提示横幅：只在未登录时出现在娱乐页顶部。
 * 卖的不是"登录功能"，是"归属感"：贡献归你、创意署名、一起把树养大。
 * 本次访问可关闭（X），下次进娱乐页再出现——保证到达率。
 * 点按钮通过自定义事件让 AppHeader 打开登录弹窗（弹窗状态是 AppHeader 私有的）。
 */
export const OPEN_LOGIN_EVENT = 'gushenle:open-login';

export function requestOpenLogin() {
  window.dispatchEvent(new CustomEvent(OPEN_LOGIN_EVENT));
}

export default function LoginNudge() {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const [dismissed, setDismissed] = useState(false);

  if (user || dismissed) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-emerald-950/80 via-slate-900 to-slate-900 p-4 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
      {/* 背景装饰：小树苗 */}
      <div className="pointer-events-none absolute -right-2 -top-4 text-[64px] opacity-15 select-none">
        🌱
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label={tx(lang, 'Dismiss', '关闭提示')}
        className="absolute right-2 top-2 p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <p className="text-[15px] font-bold text-emerald-200 pr-6">{tx(lang, '🌱 This tree is missing one name — yours', '🌱 这棵树，差你一个名字')}</p>
      <p className="text-[11px] text-slate-400 mt-1">
        {tx(lang, 'Sign in takes ', '登录只要 ')}<span className="text-slate-200 font-semibold">{tx(lang, '1 minute', '1 分钟')}</span>{tx(lang, ': tap the button below → enter your email → click the link in your inbox', '，3 步：点下面按钮 → 输邮箱 → 去邮箱点一下链接')}
      </p>

      <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-slate-300">
        <li>
          <span className="text-emerald-300 font-semibold">{tx(lang, '✅ Yours, truly: ', '✅ 归你所有：')}</span>
          {tx(lang, 'your ideas and game scores — all under your name, nobody can take them', '你的建议、游戏战绩——全记在你名下，谁也拿不走')}
        </li>
        <li>
          <span className="text-emerald-300 font-semibold">{tx(lang, '💡 Small part, big belonging: ', '💡 小参与，大认同：')}</span>
          {tx(lang, 'good ideas get adopted with your name on them, earn contribution points, and get seen and used by more people', '好创意被采纳，署你的名、发贡献值，被更多人看到、用上')}
        </li>
        <li>
          <span className="text-emerald-300 font-semibold">{tx(lang, '🌳 Grow together: ', '🌳 一起长大：')}</span>
          {tx(lang, 'when this tree grows tall, the first ones who watered it will have their names carved on it', '等这棵树长大了，第一批浇水的人，名字都刻在树上')}
        </li>
        <li>
          <span className="text-emerald-300 font-semibold">{tx(lang, '🔒 Privacy, promised: ', '🔒 隐私放心：')}</span>
          {tx(lang, 'holdings and watchlist stay on your device, never uploaded; only what you choose to share is seen by others', '持仓、自选只存你本机，不上传；只有你主动发出的贡献，才会被大家看到')}
        </li>
      </ul>

      <button
        onClick={requestOpenLogin}
        className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-sm font-bold transition shadow-lg shadow-emerald-900/40"
      >
        {tx(lang, '🌱 Sign in in 1 minute, claim your spot', '🌱 1 分钟登录，占个位置')}
      </button>
      <p className="text-[10px] text-slate-500 mt-2 text-center">
        {tx(lang, 'After signing in, tap your name in the header to pick a nice nickname anytime~', '登录后点顶栏你的名字，随时取一个好听的昵称～')}
      </p>
    </div>
  );
}
