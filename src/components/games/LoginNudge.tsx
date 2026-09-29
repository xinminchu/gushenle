'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { zh2hant } from '@/lib/hant';
import { useLanguage } from '@/context/LanguageContext';

/**
 * 🌱 登录提示横幅：只在未登录时出现在娱乐页顶部。
 * 卖的不是"登录功能"，是"所有权"：贡献归你、创意署名、树长大有所有者回报。
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
        aria-label={zh2hant(lang, '关闭提示')}
        className="absolute right-2 top-2 p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800/60 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <p className="text-[15px] font-bold text-emerald-200 pr-6">{zh2hant(lang, '🌱 这棵树，差你一个名字')}</p>
      <p className="text-[11px] text-slate-400 mt-1">
        {zh2hant(lang, '登录只要 ')}<span className="text-slate-200 font-semibold">{zh2hant(lang, '1 分钟')}</span>{zh2hant(lang, '，3 步：点下面按钮 → 输邮箱 → 去邮箱点一下链接')}
      </p>

      <ul className="mt-2.5 space-y-1.5 text-[11px] leading-relaxed text-slate-300">
        <li>
          <span className="text-emerald-300 font-semibold">{zh2hant(lang, '✅ 归你所有：')}</span>
          {zh2hant(lang, '你的建议、游戏战绩——全记在你名下，谁也拿不走')}
        </li>
        <li>
          <span className="text-emerald-300 font-semibold">{zh2hant(lang, '💡 小参与，大认同：')}</span>
          {zh2hant(lang, '好创意被采纳，署你的名、发贡献值，被更多人看到、用上')}
        </li>
        <li>
          <span className="text-emerald-300 font-semibold">{zh2hant(lang, '🌳 所有者回报：')}</span>
          {zh2hant(lang, '等这棵树长大了，第一批浇水的人，有所有者回报')}
        </li>
        <li>
          <span className="text-emerald-300 font-semibold">{zh2hant(lang, '🔒 隐私放心：')}</span>
          {zh2hant(lang, '持仓、自选只存你本机，不上传；只有你主动发出的贡献，才会被大家看到')}
        </li>
      </ul>

      <button
        onClick={requestOpenLogin}
        className="mt-3 w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.99] text-white text-sm font-bold transition shadow-lg shadow-emerald-900/40"
      >
        {zh2hant(lang, '🌱 1 分钟登录，占个位置')}
      </button>
      <p className="text-[10px] text-slate-500 mt-2 text-center">
        {zh2hant(lang, '登录后点顶栏你的名字，随时取一个好听的昵称～')}
      </p>
    </div>
  );
}
