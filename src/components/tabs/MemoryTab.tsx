'use client';

import React, { useState } from 'react';
import { Mic, Square, Sparkles, CheckCircle2 } from 'lucide-react';

export default function MemoryTab() {
  const [isRecording, setIsRecording] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 模拟语音转文字与 Gemini 2.5 Flash 结构化抽取
  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setLoading(true);
      setTimeout(() => {
        setParsedResult({
          symbol: 'NVDA',
          action: 'SELL (减仓 33%)',
          reason: '冲高回落，短线回调预期',
          emotion: '谨慎',
          rawText: '今天 NVDA 冲高回落，觉得短线可能回调，先减仓三分之一。',
        });
        setLoading(false);
      }, 1200);
    } else {
      setIsRecording(true);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">回忆乐 Memory Play</h1>
        <p className="text-xs text-slate-400 mt-0.5">记录 Thesis 与 Lesson，让昨天的自己教会今天的自己</p>
      </header>

      {/* 语音录入主卡片 */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-6 text-center space-y-4">
        <p className="text-sm text-slate-300">按住/点击说话，AI 将自动归纳交易决策</p>
        
        <button
          onClick={handleToggleRecord}
          className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all ${
            isRecording
              ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400 animate-pulse scale-105'
              : 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 hover:scale-105'
          }`}
        >
          {isRecording ? <Square className="w-8 h-8 fill-current" /> : <Mic className="w-8 h-8" />}
        </button>

        <p className="text-xs text-slate-400">
          {isRecording ? '正在倾听中... 再点一次结束' : '点击开始语音记录'}
        </p>
      </div>

      {/* Gemini 结构化抽取结果展示 */}
      {loading && (
        <div className="flex items-center justify-center space-x-2 text-slate-400 py-6 text-sm">
          <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Gemini 2.5 Flash 正在结构化解析...</span>
        </div>
      )}

      {parsedResult && !loading && (
        <div className="bg-slate-800/90 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI 结构化解析成功
            </span>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
              情绪：{parsedResult.emotion}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-400">标的：</span><span className="font-bold text-slate-200">{parsedResult.symbol}</span></div>
            <div><span className="text-slate-400">动作：</span><span className="font-bold text-amber-400">{parsedResult.action}</span></div>
          </div>

          <div className="text-xs">
            <span className="text-slate-400">买卖逻辑 / 理由：</span>
            <p className="text-slate-200 mt-1 bg-slate-900/50 p-2 rounded border border-slate-800">{parsedResult.reason}</p>
          </div>

          <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> 存入决策记忆库
          </button>
        </div>
      )}
    </div>
  );
}