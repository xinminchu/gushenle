'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, MailOpen, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { verifyTotpLogin } from '@/lib/mfa';

/**
 * 登录弹窗：三种方式
 *  1. 邮箱链接（原有）：收邮件点链接
 *  2. 邮箱 + 密码：登录 / 注册，忘记密码可发重置邮件
 *  3. 动态密码器（TOTP）：账号启用后，密码登录自动进入第二步验证
 * 不登录也能玩，登录只为多设备同步战绩。
 */
export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { sendCode, signInPassword, signUpPassword, sendPasswordReset } = useAuth();
  const { t } = useLanguage();
  const [tab, setTab] = useState<'link' | 'password'>('link');

  // —— 邮箱链接（原有逻辑） ——
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  // —— 邮箱 + 密码 ——
  const [pwdMode, setPwdMode] = useState<'login' | 'signup'>('login');
  const [pwdEmail, setPwdEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdErr, setPwdErr] = useState('');
  const [pwdNotice, setPwdNotice] = useState('');
  const [resetBusy, setResetBusy] = useState(false);

  // —— 动态密码器第二步 ——
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaErr, setMfaErr] = useState('');

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

  const handlePwdSubmit = async () => {
    setPwdErr('');
    setPwdNotice('');
    setPwdBusy(true);
    try {
      if (pwdMode === 'login') {
        const r = await signInPassword(pwdEmail, pwd);
        if (r.error === 'WRONG_CREDENTIALS') {
          setPwdErr(t('pwdWrong'));
        } else if (r.error) {
          setPwdErr(r.error);
        } else if (r.mfaFactorId) {
          setMfaFactorId(r.mfaFactorId); // 进动态密码第二步
        } else {
          onClose();
        }
      } else {
        const e = await signUpPassword(pwdEmail, pwd);
        if (e === 'ALREADY_REGISTERED') {
          setPwdErr(t('pwdNoAccount'));
          setPwdMode('login');
        } else if (e) {
          setPwdErr(e);
        } else {
          onClose();
        }
      }
    } finally {
      setPwdBusy(false);
    }
  };

  const handleForgot = async () => {
    setPwdErr('');
    setPwdNotice('');
    setResetBusy(true);
    const e = await sendPasswordReset(pwdEmail);
    setResetBusy(false);
    if (e) setPwdErr(e);
    else setPwdNotice(t('resetSent'));
  };

  const handleMfaVerify = async () => {
    if (!mfaFactorId) return;
    setMfaErr('');
    setMfaBusy(true);
    const e = await verifyTotpLogin(mfaFactorId, mfaCode);
    setMfaBusy(false);
    if (e) setMfaErr(e);
    else onClose();
  };

  const inputCls =
    'bg-transparent outline-none text-sm text-slate-100 w-full placeholder:text-slate-600';

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-100 text-base">{t('loginTitle')}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 动态密码第二步：盖住页签，全屏专注输码 */}
        {mfaFactorId ? (
          <div className="py-2">
            <div className="flex flex-col items-center text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-500 mb-3" />
              <p className="text-sm text-slate-200 font-bold mb-1">{t('totpTitle')}</p>
              <p className="text-xs text-slate-400 leading-relaxed mb-4">{t('totpDesc')}</p>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder={t('totpPlaceholder')}
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && mfaCode.length === 6 && !mfaBusy) handleMfaVerify();
                }}
                className={`${inputCls} tracking-[0.3em] text-center`}
              />
            </div>
            {mfaErr && <p className="text-xs text-red-400 mt-2">{mfaErr}</p>}
            <button
              onClick={handleMfaVerify}
              disabled={mfaBusy || mfaCode.length !== 6}
              className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold active:scale-95 transition"
            >
              {mfaBusy ? t('sending') : t('totpVerifyBtn')}
            </button>
            <button
              onClick={() => {
                setMfaFactorId(null);
                setMfaCode('');
                setMfaErr('');
              }}
              className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-300"
            >
              {t('totpBackToLogin')}
            </button>
          </div>
        ) : (
          <>
            {/* 页签 */}
            <div className="flex bg-slate-800 rounded-xl p-1 mb-4 mt-2">
              {(
                [
                  { k: 'link', icon: Mail, label: t('loginTabLink') },
                  { k: 'password', icon: KeyRound, label: t('loginTabPassword') },
                ] as const
              ).map((tb) => (
                <button
                  key={tb.k}
                  onClick={() => setTab(tb.k)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition ${
                    tab === tb.k ? 'bg-slate-700 text-slate-100' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <tb.icon className="w-3.5 h-3.5" />
                  {tb.label}
                </button>
              ))}
            </div>

            {tab === 'link' ? (
              <>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">{t('loginDesc')}</p>
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
                        className={inputCls}
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
              </>
            ) : (
              <>
                {/* 密码页：登录 / 注册小切换 */}
                <div className="flex gap-1.5 mb-3">
                  {(
                    [
                      { k: 'login', label: t('pwdTabLogin') },
                      { k: 'signup', label: t('pwdTabSignup') },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.k}
                      onClick={() => {
                        setPwdMode(m.k);
                        setPwdErr('');
                        setPwdNotice('');
                      }}
                      className={`text-[11px] px-3 py-1.5 rounded-full border font-medium ${
                        pwdMode === m.k
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'text-slate-500 border-slate-700'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                    <Mail className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder={t('emailPlaceholder')}
                      value={pwdEmail}
                      onChange={(e) => setPwdEmail(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
                    <KeyRound className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="password"
                      autoComplete={pwdMode === 'login' ? 'current-password' : 'new-password'}
                      placeholder={t('passwordPlaceholder')}
                      value={pwd}
                      onChange={(e) => setPwd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !pwdBusy) handlePwdSubmit();
                      }}
                      className={inputCls}
                    />
                  </div>
                </div>
                {pwdErr && <p className="text-xs text-red-400 mt-2">{pwdErr}</p>}
                {pwdNotice && <p className="text-xs text-emerald-400 mt-2">{pwdNotice}</p>}
                <button
                  onClick={handlePwdSubmit}
                  disabled={pwdBusy || !pwdEmail.trim() || pwd.length < 6}
                  className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold active:scale-95 transition"
                >
                  {pwdBusy ? t('sending') : pwdMode === 'login' ? t('passwordLoginBtn') : t('passwordSignupBtn')}
                </button>
                {pwdMode === 'login' && (
                  <button
                    onClick={handleForgot}
                    disabled={resetBusy || !pwdEmail.trim()}
                    className="w-full mt-2 py-2 text-xs text-slate-500 hover:text-slate-300 disabled:opacity-40"
                  >
                    {resetBusy ? t('sending') : t('forgotPassword')}
                  </button>
                )}
                <p className="text-[10px] text-slate-600 leading-relaxed mt-3">
                  {t('pwdNeedPassword')}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
