'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, MailOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';

/** 邮箱链接登录弹窗：不登录也能玩，登录只为多设备同步战绩 */
export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { sendCode } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  const startCooldown = () => {
    setCooldown(60);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((v) => {
        if (v <= 1) {
          if (timer.current) clearInterval(timer.current);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    setErr('');
    setBusy(true);
    const e = await sendCode(email);
    setBusy(false);
    if (e) {
      setErr(e);
    } else {
      setSent(true);
      startCooldown();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-100 text-base">{t('loginTitle')}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          {t('loginDesc')}
        </p>

        {!sent ? (
          <>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-transparent outline-none text-sm text-slate-100 w-full placeholder:text-slate-600"
              />
            </div>
            {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
            <button
              onClick={handleSend}
              disabled={busy || !email.trim()}
              className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold active:scale-95 transition"
            >
              {busy ? t('sending') : t('sendLink')}
            </button>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center text-center py-2">
              <MailOpen className="w-10 h-10 text-emerald-500 mb-3" />
              <p className="text-sm text-slate-200 font-bold mb-1">{t('sentTitle')}</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {t('sentTo')} <b className="text-slate-200">{email.trim()}</b>
                <br />
                {t('sentHint')}
              </p>
            </div>
            {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
            <button
              onClick={() => (cooldown > 0 ? null : handleSend())}
              disabled={cooldown > 0 || busy}
              className="w-full mt-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-sm font-bold active:scale-95 transition"
            >
              {cooldown > 0 ? t('resendIn', { s: cooldown }) : t('resend')}
            </button>
            <button
              onClick={() => {
                setSent(false);
                setErr('');
              }}
              className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-300"
            >
              {t('changeEmail')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
