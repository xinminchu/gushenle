'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Mail, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/** 邮箱验证码登录弹窗：不登录也能玩，登录只为多设备同步战绩 */
export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { sendCode, verifyCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
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
      setStep('code');
      startCooldown();
    }
  };

  const handleVerify = async () => {
    setErr('');
    setBusy(true);
    const e = await verifyCode(email, code);
    setBusy(false);
    if (e) {
      setErr(e);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xs rounded-2xl p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-slate-100 text-base">登录股神乐</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          邮箱收验证码登录，游戏积分多设备同步。不登录也能玩。
        </p>

        {step === 'email' ? (
          <>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
              <Mail className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="你的邮箱"
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
              {busy ? '发送中…' : '发送验证码'}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-2">
              验证码已发到 <b className="text-slate-200">{email.trim()}</b>
            </p>
            <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5">
              <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0" />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6 位验证码"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className="bg-transparent outline-none text-sm text-slate-100 w-full tracking-[0.3em] placeholder:text-slate-600 placeholder:tracking-normal"
              />
            </div>
            {err && <p className="text-xs text-red-400 mt-2">{err}</p>}
            <button
              onClick={handleVerify}
              disabled={busy || code.length < 6}
              className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-sm font-bold active:scale-95 transition"
            >
              {busy ? '验证中…' : '验证登录'}
            </button>
            <button
              onClick={() => (cooldown > 0 ? null : handleSend())}
              disabled={cooldown > 0}
              className="w-full mt-2 py-2 text-xs text-slate-400 hover:text-slate-200 disabled:opacity-50"
            >
              {cooldown > 0 ? `重新发送 (${cooldown}s)` : '没收到？重新发送'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
