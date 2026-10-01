import React, { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { isSpeechSupported, speakText, stopSpeech } from '@/lib/speech';
import type { Lang } from '@/lib/i18n';
import { tx } from '@/lib/hant';

/**
 * 小喇叭：点一下朗读传入的文本，再点停掉。
 * 不自动播——只在用户手势下发声（iOS 要求），也避免在外面突然出声。
 */
export default function SpeakButton({ text, lang }: { text: string; lang: Lang }) {
  const [speaking, setSpeaking] = useState(false);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopSpeech(); // 离开页面/卡片消失时停掉，不留半句话
    };
  }, []);

  // 文本变了（新的 AI 回复）：停掉上一句
  useEffect(() => {
    stopSpeech();
    setSpeaking(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  if (!isSpeechSupported()) return null;

  const toggle = () => {
    if (speaking) {
      stopSpeech();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speakText(text, lang, () => {
      if (aliveRef.current) setSpeaking(false);
    });
  };

  return (
    <button
      onClick={toggle}
      aria-label={tx(lang, 'Read aloud', '朗读')}
      title={tx(lang, 'Read aloud', '朗读')}
      className={`p-1.5 rounded-full transition-colors ${
        speaking ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 hover:text-slate-200'
      }`}
    >
      {speaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
    </button>
  );
}
