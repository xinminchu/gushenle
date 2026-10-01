/**
 * 语音播出：用浏览器/系统自带的 speechSynthesis，本机合成发声。
 * - 零成本：不调任何云 TTS，不花钱
 * - 不走流量：用的是手机自带嗓音（iOS 自带中文嗓音），离线也能念
 * - 必须由用户手势触发（点小喇叭），iOS 才允许发声；不做自动播
 */

import type { Lang } from '@/lib/i18n';

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** 按语言挑嗓音：中文优先 zh-CN，繁体优先 zh-HK/zh-TW，英文优先 en-US */
function pickVoice(lang: Lang): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const prefs: Record<Lang, string[]> = {
      zh: ['zh-CN', 'zh'],
      hant: ['zh-HK', 'zh-TW', 'zh'],
      en: ['en-US', 'en'],
    };
    for (const p of prefs[lang]) {
      const v = voices.find((x) => x.lang.toLowerCase().startsWith(p.toLowerCase()));
      if (v) return v;
    }
    return voices.find((x) => x.default) || voices[0];
  } catch {
    return null;
  }
}

export function speakText(text: string, lang: Lang, onDone?: () => void): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel(); // 先停掉上一句，避免叠着念
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'en' ? 'en-US' : lang === 'hant' ? 'zh-HK' : 'zh-CN';
    const voice = pickVoice(lang);
    if (voice) u.voice = voice;
    u.rate = 1;
    if (onDone) {
      u.onend = onDone;
      u.onerror = onDone;
    }
    window.speechSynthesis.speak(u);
  } catch {
    onDone?.();
  }
}

export function stopSpeech(): void {
  try {
    if (isSpeechSupported()) window.speechSynthesis.cancel();
  } catch {}
}
