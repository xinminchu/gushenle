'use client';

import React, { useState, useEffect } from 'react';
import { X, KeyRound, ShieldCheck, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import {
  getVerifiedTotpFactor,
  enrollTotp,
  confirmTotpEnrollment,
  unenrollTotp,
  updatePassword,
  type TotpFactor,
} from '@/lib/mfa';

/** 账号安全：设置登录密码 + 启用/关闭动态密码器（Google Authenticator 等） */
export default function SecurityModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage();
  const [factor, setFactor] = useState<TotpFactor | null>(null);
  const [checking, setChecking] = useState(true);

  // 密码
  const [pwd1, setPwd1] = useState('');
  const [pwd2, setPwd2] = useState('');
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // 启用 TOTP
  const [enrolling, setEnrolling] = useState(false);
  const [enrollInfo, setEnrollInfo] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [enrollErr, setEnrollErr] = useState('');
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getVerifiedTotpFactor()
      .then(setFactor)
      .finally(() => setChecking(false));
  }, []);

  const handleSetPassword = async () => {
    setPwdMsg(null);
    if (pwd1.length < 6) {
      setPwdMsg({ ok: false, text: tx(lang, 'At least 6 characters.', '密码至少 6 位') });
      return;
    }
    if (pwd1 !== pwd2) {
      setPwdMsg({ ok: false, text: tx(lang, 'The two passwords don’t match.', '两次输入的密码不一致') });
      return;
    }
    setPwdBusy(true);
    const e = await updatePassword(pwd1);
    setPwdBusy(false);
    if (e) {
      setPwdMsg({ ok: false, text: e });
    } else {
      setPwdMsg({
        ok: true,
        text: tx(lang, 'Done — you can now sign in with email + password.', '已设置，以后可以用邮箱 + 密码登录了'),
      });
      setPwd1('');
      setPwd2('');
    }
  };

  const handleEnroll = async () => {
    setEnrollErr('');
    setEnrolling(true);
    const r = await enrollTotp();
    setEnrolling(false);
    if ('error' in r) {
      setEnrollErr(r.error);
    } else {
      setEnrollInfo(r);
    }
  };

  const handleConfirmEnroll = async () => {
    if (!enrollInfo) return;
    setCodeBusy(true);
    const e = await confirmTotpEnrollment(enrollInfo.factorId, code);
    setCodeBusy(false);
    if (e) {
      setEnrollErr(e);
    } else {
      setFactor({ id: enrollInfo.factorId, status: 'verified' });
      setEnrollInfo(null);
      setCode('');
      setEnrollErr('');
    }
  };

  const handleUnenroll = async () => {
    if (!factor) return;
    if (!window.confirm(tx(lang, 'Turn off the authenticator? Password-only sign-in from now on.', '确定关闭动态密码器？以后只用密码登录。')))
      return;
    const e = await unenrollTotp(factor.id);
    if (e) setEnrollErr(e);
    else setFactor(null);
  };

  const copySecret = async () => {
    if (!enrollInfo) return;
    try {
      await navigator.clipboard.writeText(enrollInfo.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 忽略 */
    }
  };

  const inputCls =
    'bg-transparent outline-none text-sm text-slate-100 w-full placeholder:text-slate-600';

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-2xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-100 text-base">{tx(lang, 'Account security', '账号安全')}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* —— 登录密码 —— */}
        <div className="mb-5">
          <p className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
            {tx(lang, 'Sign-in password', '登录密码')}
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
            {tx(
              lang,
              'Set a password to sign in without email links. Already have one? This changes it.',
              '设置密码后，不用再收邮件点链接。之前设过？这里直接改成新的。',
            )}
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
              <input
                type="password"
                autoComplete="new-password"
                placeholder={tx(lang, 'New password (min 6 chars)', '新密码（至少 6 位）')}
                value={pwd1}
                onChange={(e) => setPwd1(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
              <input
                type="password"
                autoComplete="new-password"
                placeholder={tx(lang, 'Type it again', '再输入一次') }
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>
          {pwdMsg && (
            <p className={`text-xs mt-2 ${pwdMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{pwdMsg.text}</p>
          )}
          <button
            onClick={handleSetPassword}
            disabled={pwdBusy || !pwd1 || !pwd2}
            className="w-full mt-2.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-sm font-bold active:scale-95 transition"
          >
            {pwdBusy ? tx(lang, 'Saving…', '保存中…') : tx(lang, 'Set password', '设置密码')}
          </button>
        </div>

        {/* —— 动态密码器 —— */}
        <div>
          <p className="text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            {tx(lang, 'Authenticator app', '动态密码器')}
          </p>
          <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
            {tx(
              lang,
              'Extra step at sign-in: a 6-digit code from Google Authenticator / 1Password, etc. More secure, slightly more effort.',
              '登录时多一步：用 Google Authenticator / 1Password 等 App 里的 6 位动态码。更安全，稍微麻烦一点。',
            )}
          </p>

          {checking ? (
            <p className="text-xs text-slate-500">{tx(lang, 'Checking…', '查询中…')}</p>
          ) : factor ? (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
              <p className="text-xs text-emerald-300 font-bold mb-1">
                ✓ {tx(lang, 'Enabled', '已启用')}
              </p>
              <p className="text-[11px] text-slate-400 mb-2.5">
                {tx(lang, 'Password sign-in will ask for the 6-digit code.', '密码登录时会要求输入 6 位动态码。')}
              </p>
              <button
                onClick={handleUnenroll}
                className="text-[11px] px-3 py-1.5 rounded-full border border-rose-500/40 text-rose-300 hover:bg-rose-500/10"
              >
                {tx(lang, 'Turn off', '关闭')}
              </button>
            </div>
          ) : enrollInfo ? (
            <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-3">
              <p className="text-[11px] text-slate-300 mb-2">
                {tx(lang, '1. Scan with your authenticator app:', '1. 用动态密码 App 扫码：')}
              </p>
              {enrollInfo.qrCode ? (
                <div
                  className="bg-white rounded-lg p-2 w-fit mx-auto mb-2 [&_svg]:block [&_svg]:w-36 [&_svg]:h-36"
                  dangerouslySetInnerHTML={{ __html: enrollInfo.qrCode }}
                />
              ) : (
                <p className="text-[11px] text-amber-300 mb-2">
                  {tx(lang, 'QR code missing — enter the secret manually below.', '二维码没拿到，用下面的密钥手动添加。')}
                </p>
              )}
              <p className="text-[11px] text-slate-300 mb-1">
                {tx(lang, '2. Or enter this secret manually:', '2. 或手动输入密钥：')}
              </p>
              <button
                onClick={copySecret}
                className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-200 break-all text-left w-full"
              >
                <span className="flex-1">{enrollInfo.secret}</span>
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Copy className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
              </button>
              <p className="text-[11px] text-slate-300 mt-3 mb-1.5">
                {tx(lang, '3. Enter the 6-digit code from the app:', '3. 输入 App 里的 6 位动态码：')}
              </p>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className={`${inputCls} tracking-[0.3em] text-center`}
                />
              </div>
              {enrollErr && <p className="text-xs text-red-400 mt-2">{enrollErr}</p>}
              <div className="flex gap-2 mt-2.5">
                <button
                  onClick={handleConfirmEnroll}
                  disabled={codeBusy || code.length !== 6}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold active:scale-95 transition"
                >
                  {codeBusy ? tx(lang, 'Verifying…', '验证中…') : tx(lang, 'Enable', '启用')}
                </button>
                <button
                  onClick={() => {
                    setEnrollInfo(null);
                    setCode('');
                    setEnrollErr('');
                  }}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-400 text-xs"
                >
                  {tx(lang, 'Cancel', '取消')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {enrollErr && <p className="text-xs text-red-400 mb-2">{enrollErr}</p>}
              <button
                onClick={handleEnroll}
                disabled={enrolling}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-100 text-sm font-bold active:scale-95 transition"
              >
                {enrolling ? tx(lang, 'Preparing…', '准备中…') : tx(lang, 'Enable authenticator', '启用动态密码器')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
