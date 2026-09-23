// 全局昵称 hook：读 localStorage，改昵称时所有用到的地方一起更新
'use client';

import { useState, useEffect } from 'react';
import { getNickname, NICKNAME_EVENT } from '@/lib/family';

export function useNickname(email?: string | null): string {
  const [nick, setNick] = useState(() => getNickname(email));
  useEffect(() => {
    setNick(getNickname(email));
    const handler = () => setNick(getNickname(email));
    window.addEventListener(NICKNAME_EVENT, handler);
    return () => window.removeEventListener(NICKNAME_EVENT, handler);
  }, [email]);
  return nick;
}
