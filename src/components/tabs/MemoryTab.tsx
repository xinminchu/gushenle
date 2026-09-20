'use client';

import React, { useState } from 'react';
import { Mic, Square, Sparkles, CheckCircle2, XCircle, Send } from 'lucide-react';

export default function MemoryTab() {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // 1. 调用真实的后端 Gemini API 进行解析
  const handleAnalyze = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) return;
    setLoading(true);
    setParsedResult(null);

    try {
      const res = await fetch('/api/analyze-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: textToAnalyze }),
      });

      const json = await res.json();
      if (json.success) {
        setParsedResult(json.data);
      } else {
        alert('解析失败：' + (json.error || '未知错误'));
      }
    } catch (err) {
      console.error(err);
      alert('请求失败，请检查网络或 API Key');
    } finally {
      setLoading(false);
    }
  };

  // 模拟语音录制（也可直接使用输入框文本测试）
  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      if (inputText) {
        handleAnalyze(inputText);
      } else {
        alert('请先输入或说出一段交易想法');
      }
    } else {
      setIsRecording(true);
    }
  };

  // 2. 取消/清除解析结果
  const handleCancel = () => {
    setParsedResult(null);
    setInputText('');
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">回忆乐 Memory Play</h1>
        <p className="text-xs text-slate-400 mt-0.5">记录 Thesis 与 Lesson，让昨天的自己教会今天的自己[cite: 1]</p>
      </header>

      {/* 语音与文本输入卡片 */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-4">
        {/* 手动文本输入（方便测试真实 AI 解析） */}
        <div className="space-y-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="输入或语音记录例如：今天 180 块买了苹果 AAPL，看好下周发布会..."
            className="w-full h-20 bg-slate-900/80 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <button
            onClick={() => handleAnalyze(inputText)}
            disabled={loading || !inputText.trim()}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> 发送给 AI 结构化解析
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink mx-2 text-[10px] text-slate-500">或通过语音录入</span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

        {/* 语音按键 */}
        <div className="text-center space-y-2">
          <button
            onClick={handleToggleRecord}
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto transition-all ${
              isRecording
                ? 'bg-rose-500/20 border-2 border-rose-500 text-rose-400 animate-pulse scale-105'
                : 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 hover:scale-105'
            }`}
          >
            {isRecording ? <Square className="w-6 h-6 fill-current" /> : <Mic className="w-6 h-6" />}
          </button>
          <p className="text-[10px] text-slate-400">
            {isRecording ? '录音中... 再点击结束并解析' : '按住/点击开始说话'}
          </p>
        </div>
      </div>

      {/* 加载状态 */}
      {loading && (
        <div className="flex items-center justify-center space-x-2 text-slate-400 py-6 text-xs">
          <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
          <span>Gemini 2.5 Flash 正在结构化解析...</span>
        </div>
      )}

      {/* 真实 AI 解析结果与操作按钮 */}
      {parsedResult && !loading && (
        <div className="bg-slate-800/90 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI 结构化解析成功
            </span>
            <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
              情绪：{parsedResult.emotion || '未提供'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-slate-400">标的：</span><span className="font-bold text-slate-100">{parsedResult.symbol}</span></div>
            <div><span className="text-slate-400">动作：</span><span className="font-bold text-amber-400">{parsedResult.action}</span></div>
          </div>

          <div className="text-xs">
            <span className="text-slate-400">买卖逻辑 / 理由：</span>
            <p className="text-slate-200 mt-1 bg-slate-900/50 p-2 rounded border border-slate-800">{parsedResult.thesis || '无明显逻辑'}</p>
          </div>

          {/* 保存与取消按钮 */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancel}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> 取消 / 重试
            </button>
            <button
              onClick={() => {
                alert('成功存入决策记忆库！');
                handleCancel();
              }}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> 存入决策库
            </button>
          </div>
        </div>
      )}
    </div>
  );
}