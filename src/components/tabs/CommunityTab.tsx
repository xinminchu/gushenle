'use client';

import React from 'react';
import { Users, ShieldAlert, Sparkles, HeartHandshake, Share2 } from 'lucide-react';

export default function CommunityTab() {
  // 模拟亲友圈分享卡片 (大家乐)
  const posts = [
    {
      id: 1,
      author: '老爸',
      avatar: '👨‍💼',
      time: '2小时前',
      type: 'Thesis',
      symbol: 'AAPL',
      content: '苹果新手机发布前夕，逻辑是硬件换机潮 + AI 功能落地，计划分批建仓不追高。',
      likes: 3,
    },
    {
      id: 2,
      author: '小明 (表弟)',
      avatar: '👦',
      time: '昨天',
      type: 'Lesson',
      symbol: 'TSLA',
      content: '避坑总结：昨天冲高时因为 FOMO 情绪加仓，结果直接吃回调。以后动能打分>90绝对不盲目追高！',
      likes: 5,
    },
  ];

  return (
    <div className="p-4 space-y-5 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">大家乐 Community Play</h1>
        <p className="text-xs text-slate-400 mt-0.5">与家人和朋友共享逻辑与避坑经验，理性交流共同成长[cite: 1]</p>
      </header>

      {/* 顶部交流倡议卡片 */}
      <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-2xl p-4 flex items-center gap-3">
        <Users className="w-8 h-8 text-emerald-400 flex-shrink-0" />
        <div className="text-xs text-slate-300 space-y-0.5">
          <p className="font-semibold text-emerald-400">独乐乐不如大家乐！[cite: 1]</p>
          <p className="text-slate-400">这里只分享“买入逻辑”与“避坑指南”，不喊单、不荐股[cite: 1]。</p>
        </div>
      </div>

      {/* 亲友分享列表 */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 space-y-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <span className="text-xl">{post.avatar}</span>
                <div>
                  <div className="text-xs font-semibold text-slate-200">{post.author}</div>
                  <div className="text-[10px] text-slate-500">{post.time}</div>
                </div>
              </div>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                  post.type === 'Thesis'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}
              >
                {post.type === 'Thesis' ? '💡 买入逻辑' : '⚠️ 避坑经验'}
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-bold text-slate-100">标的：{post.symbol}</div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                {post.content}
              </p>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-1 border-t border-slate-700/50">
              <button className="flex items-center gap-1 hover:text-emerald-400">
                <HeartHandshake className="w-3.5 h-3.5" /> 觉得有启发 ({post.likes})
              </button>
              <button className="flex items-center gap-1 hover:text-slate-200">
                <Share2 className="w-3.5 h-3.5" /> 分享到微信群
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}