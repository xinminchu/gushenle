'use client';

import React, { useState } from 'react';
import { Search, SlidersHorizontal, TrendingUp, ShieldAlert, Eye } from 'lucide-react';

export default function PortfolioTab() {
  const [scope, setScope] = useState<'holding' | 'sector' | 'custom'>('holding');
  const [searchQuery, setSearchQuery] = useState('');

  // 模拟股票池数据 (捉影乐 + 随心乐)
  const stocks = [
    { symbol: 'NVDA', name: '英伟达', score: 88, trend: '抬头上涨', price: '$128.50', change: '+3.4%', isHolding: true },
    { symbol: 'AAPL', name: '苹果', score: 45, trend: '底部蓄势', price: '$224.20', change: '-0.2%', isHolding: true },
    { symbol: 'TSLA', name: '特斯拉', score: 92, trend: '冲高过热', price: '$248.00', change: '+6.8%', isHolding: true },
    { symbol: 'MSFT', name: '微软', score: 62, trend: '趋势起步', price: '$448.10', change: '+1.1%', isHolding: false },
    { symbol: 'AMD', name: '超威半导体', score: 71, trend: '谷底抬头', price: '$156.30', change: '+2.5%', isHolding: false },
  ];

  const filteredStocks = stocks.filter((stock) => {
    if (scope === 'holding' && !stock.isHolding) return false;
    if (searchQuery) {
      return stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || stock.name.includes(searchQuery);
    }
    return true;
  });

  return (
    <div className="p-4 space-y-5 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">持仓宇宙 Portfolio</h1>
        <p className="text-xs text-slate-400 mt-0.5">【捉影乐】捕捉趋势影子 + 【随心乐】自由选择监控范围</p>
      </header>

      {/* 随心乐：范围切换卡片 */}
      <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
        <button
          onClick={() => setScope('holding')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
            scope === 'holding' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          个人持仓
        </button>
        <button
          onClick={() => setScope('sector')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
            scope === 'sector' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          选定板块
        </button>
        <button
          onClick={() => setScope('custom')}
          className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
            scope === 'custom' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          1000只名单
        </button>
      </div>

      {/* 搜索框 */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索代码或名称 (如 NVDA, 苹果)..."
          className="w-full bg-slate-800/80 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* 捉影乐列表 */}
      <div className="space-y-3">
        {filteredStocks.map((item) => (
          <div
            key={item.symbol}
            className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between hover:border-slate-600 transition-all"
          >
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-100 text-base">{item.symbol}</span>
                <span className="text-xs text-slate-400">{item.name}</span>
                {item.isHolding && (
                  <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[9px] px-1.5 py-0.2 rounded">
                    持仓中
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-200 font-medium">{item.price}</span>
                <span className={item.change.startsWith('+') ? 'text-emerald-400' : 'text-rose-400'}>
                  {item.change}
                </span>
              </div>
            </div>

            <div className="text-right space-y-1">
              <div className="flex items-center gap-1 justify-end">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-xs text-slate-300 font-medium">{item.trend}</span>
              </div>
              <div className="text-[10px] text-slate-500">动能打分: <span className="font-bold text-slate-200">{item.score}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}