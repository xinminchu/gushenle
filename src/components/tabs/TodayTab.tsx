'use client';

import React, { useState } from 'react';
import { ShieldAlert, Smile, Flame, ArrowUpRight } from 'lucide-react';

export default function TodayTab() {
  // 模拟数据：谷峰动能打分 (0-100)
  const holdings = [
    { symbol: 'NVDA', name: '英伟达', score: 88, status: '主升加速', thesis: 'AI 算力需求持续释放', targetAlert: false, overHeat: true },
    { symbol: 'AAPL', name: '苹果', score: 45, status: '蓄势震荡', thesis: '等待新机发布周期', targetAlert: false, overHeat: false },
    { symbol: 'TSLA', name: '特斯拉', score: 92, status: '冲高过热', thesis: 'Robotaxi 预期拉满', targetAlert: true, overHeat: true },
  ];

  const [showZenModal, setShowZenModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<any>(null);

  const handleStockClick = (stock: any) => {
    if (stock.overHeat) {
      setSelectedStock(stock);
      setShowZenModal(true);
    }
  };

  return (
    <div className="p-4 space-y-6 pb-24 max-w-md mx-auto">
      {/* 顶栏 Slogan */}
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">股神乐 Gushenle</h1>
          <p className="text-xs text-slate-400 mt-0.5">快乐炒股，轻松投资。不赌，不堵。</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-2.5 py-1 rounded-full flex items-center gap-1">
          <Smile className="w-3.5 h-3.5" /> 安心享受生活
        </div>
      </header>

      {/* 律动乐看板 (Rhythm Play) */}
      <section className="space-y-3">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-slate-200">谷峰律动动能看板</h2>
          <span className="text-xs text-slate-500">0-100 动能打分</span>
        </div>

        <div className="space-y-3">
          {holdings.map((item) => (
            <div
              key={item.symbol}
              onClick={() => handleStockClick(item)}
              className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between cursor-pointer hover:border-slate-600 transition-all"
            >
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-slate-100 text-lg">{item.symbol}</span>
                  <span className="text-xs text-slate-400">{item.name}</span>
                  {item.overHeat && (
                    <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Flame className="w-3 h-3" /> 过热
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">Thesis: {item.thesis}</p>
              </div>

              {/* 动能得分 Display */}
              <div className="text-right">
                <div className={`text-2xl font-extrabold ${item.score >= 80 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {item.score}
                </div>
                <div className="text-[10px] text-slate-400">{item.status}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 沉思乐 (Zen Play) 冷静拦截弹窗 */}
      {showZenModal && selectedStock && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
            <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-100">【沉思乐】过热风险提示</h3>
            <p className="text-sm text-slate-300">
              <span className="font-semibold text-amber-400">{selectedStock.symbol}</span> 律动得分达到 <span className="font-bold">{selectedStock.score}</span>，市场情绪处于高位。
            </p>
            <div className="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-400 text-left space-y-1">
              <p className="font-medium text-slate-300">反例检查清单：</p>
              <p>• 是否因为害怕错过（FOMO）而想追加仓位？</p>
              <p>• 是否符合最初设定的买入逻辑（Thesis）？</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowZenModal(false)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 py-2.5 rounded-xl text-xs font-medium"
              >
                深呼吸，保持冷静
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}