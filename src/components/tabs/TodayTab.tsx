'use client';

import React, { useState, useEffect} from 'react';
import { ShieldAlert, Smile, Flame, Loader2} from 'lucide-react';
import type { RhythmResponse} from '@/lib/rhythm';
import { statusForScore, scoreGradient} from '@/lib/rhythm';

/** 持仓配置：分数来自实时接口，thesis 是用户自己的投资逻辑备注 */
const HOLDINGS = [
{ symbol: 'NVDA', name: '英伟达', thesis: 'AI 算力需求持续释放'},
{ symbol: 'AAPL', name: '苹果', thesis: '等待新机发布周期'},
{ symbol: 'TSLA', name: '特斯拉', thesis: 'Robotaxi 预期拉满'},
];

interface MomentumCard {
symbol: string;
name: string;
thesis: string;
score: number;
status: string;
price: number;
changePct: number;
overHeat: boolean;
simulated: boolean;
}

export default function TodayTab() {
const [cards, setCards] = useState<MomentumCard[] | null>(null);
const [loadError, setLoadError] = useState<string | null>(null);
const [showZenModal, setShowZenModal] = useState(false);
const [selectedStock, setSelectedStock] = useState<MomentumCard | null>(null);

// 从 /api/rhythm 拉取真实动能分数（rhythmPos 即 0-100 动能打分）
useEffect(() => {
let cancelled = false;
async function load() {
try {
const results = await Promise.all(
HOLDINGS.map(async (h) => {
const res = await fetch(`/api/rhythm?symbol=${h.symbol}&range=1M`);
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const data = (await res.json()) as RhythmResponse;
const score = data.rhythmPos;
return {
...h,
score,
status: statusForScore(score),
price: data.price,
changePct: data.changePct,
overHeat: score >= 80,
simulated: data.source === 'simulated',
} as MomentumCard;
}),
);
if (!cancelled) setCards(results);
} catch (e) {
if (!cancelled) setLoadError(e instanceof Error? e.message: '加载失败');
}
}
load();
return () => {
cancelled = true;
};
}, []);

const handleStockClick = (stock: MomentumCard) => {
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
<span className="text-xs text-slate-500">0-100 动能打分 · Yahoo 实时</span>
</div>

{loadError? (
<div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm rounded-xl p-4 text-center">
动能数据加载失败：{loadError}，请下拉或稍后重试
</div>
): cards === null? (
<div className="space-y-3">
{[0, 1, 2].map((i) => (
<div
key={i}
className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between animate-pulse"
>
<div className="space-y-2">
<div className="h-5 w-24 bg-slate-700 rounded" />
<div className="h-3 w-40 bg-slate-700/70 rounded" />
</div>
<Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
</div>
))}
</div>
): (
<div className="space-y-3">
{cards.map((item) => (
<div
key={item.symbol}
onClick={() => handleStockClick(item)}
className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 cursor-pointer hover:border-slate-600 transition-all"
>
<div className="flex items-center justify-between">
<div className="space-y-1">
<div className="flex items-center space-x-2">
<span className="font-bold text-slate-100 text-lg">{item.symbol}</span>
<span className="text-xs text-slate-400">{item.name}</span>
{item.overHeat && (
<span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5">
<Flame className="w-3 h-3" /> 过热
</span>
)}
{item.simulated && (
<span className="text-[10px] text-slate-500">演示数据</span>
)}
</div>
<p className="text-xs text-slate-400 line-clamp-1">Thesis: {item.thesis}</p>
</div>

{/* 动能得分 Display */}
<div className="text-right shrink-0">
<div
className={`text-2xl font-extrabold ${
item.score >= 80? 'text-amber-400': 'text-emerald-400'
}`}
>
{item.score}
</div>
<div className="text-[10px] text-slate-400">{item.status}</div>
</div>
</div>

{/* 价格与动能条 */}
<div className="mt-3 flex items-center gap-3">
<span className="text-sm font-semibold text-slate-200 shrink-0">
${item.price.toFixed(2)}
</span>
<span
className={`text-xs shrink-0 ${
item.changePct >= 0? 'text-emerald-400': 'text-rose-400'
}`}
>
{item.changePct >= 0? '+': ''}
{item.changePct}%/月
</span>
<div className="flex-1 h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
<div
className={`h-full rounded-full bg-gradient-to-r ${scoreGradient(item.score)} transition-all duration-700`}
style={{ width: `${item.score}%`}}
/>
</div>
</div>
</div>
))}
</div>
)}
</section>

{/* 沉思乐 (Zen Play) 冷静拦截弹窗 */}
{showZenModal && selectedStock && (
<div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
<div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl">
<div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-full flex items-center justify-center mx-auto text-amber-400">
<ShieldAlert className="w-6 h-6" />
</div>
<h3 className="text-lg font-bold text-slate-100">过热风险提示</h3>
<p className="text-sm text-slate-300">
<span className="font-semibold text-amber-400">{selectedStock.symbol}</span>{' '}
律动得分达到 <span className="font-bold">{selectedStock.score}</span>
，市场情绪处于高位。
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
