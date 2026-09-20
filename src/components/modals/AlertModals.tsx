'use client';

import React from 'react';
import { PartyPopper, HeartHandshake } from 'lucide-react';

interface ContentmentModalProps {
  isOpen: boolean;
  symbol: string;
  targetPrice: number;
  currentPrice: number;
  onClose: () => void;
}

// 知足乐 (Contentment Play) 弹窗
export function ContentmentModal({ isOpen, symbol, targetPrice, currentPrice, onClose }: ContentmentModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
          <PartyPopper className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-100">【知足乐】目标达成提醒</h3>
        <p className="text-xs text-slate-300">
          持仓 <span className="font-bold text-emerald-400">{symbol}</span> 当前价格 (${currentPrice}) 已达到当初设立的目标价 (${targetPrice})。
        </p>
        <div className="bg-slate-800/80 p-3 rounded-lg text-xs text-slate-400 flex items-center gap-2 text-left border border-slate-700">
          <HeartHandshake className="w-8 h-8 text-emerald-400 flex-shrink-0" />
          <span>知足常乐！达到了当初的投资目标，开心落袋为安，不赚最后一个铜板。</span>
        </div>
        <button
          onClick={onClose}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-100 text-xs py-2.5 rounded-xl font-medium transition-colors"
        >
          知足常乐，收到！
        </button>
      </div>
    </div>
  );
}