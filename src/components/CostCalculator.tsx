'use client';

import { useMemo, useState } from 'react';
import { Calculator, ChevronDown } from 'lucide-react';

/**
 * 真实成本试算器：美股一来一回到底花多少钱。
 * 纯前端计算，不依赖任何接口。券商费率都是"参考值、可手动改"，
 * 避免费率调整后维护负担；监管费率（SEC/FINRA）经常变，默认计入但可关。
 */

interface BrokerPreset {
  id: string;
  name: string;
  commissionPerShare: number; // 佣金 $/股
  commissionMin: number; // 最低佣金 $/笔
  commissionMaxRate: number; // 佣金上限 = 交易额比例（0 表示无上限）
  platformPerShare: number; // 平台费 $/股
  platformMin: number; // 最低平台费 $/笔
}

const BROKERS: BrokerPreset[] = [
  { id: 'futu', name: '富途牛牛', commissionPerShare: 0.0049, commissionMin: 0.99, commissionMaxRate: 0, platformPerShare: 0.005, platformMin: 1 },
  { id: 'tiger', name: '老虎证券', commissionPerShare: 0.0049, commissionMin: 0.99, commissionMaxRate: 0, platformPerShare: 0.005, platformMin: 1 },
  { id: 'longbridge', name: '长桥证券', commissionPerShare: 0.0049, commissionMin: 0.99, commissionMaxRate: 0, platformPerShare: 0, platformMin: 0 },
  { id: 'ibkr', name: '盈透证券（固定式）', commissionPerShare: 0.0035, commissionMin: 0.35, commissionMaxRate: 0.01, platformPerShare: 0, platformMin: 0 },
  { id: 'custom', name: '自定义…', commissionPerShare: 0, commissionMin: 0, commissionMaxRate: 0, platformPerShare: 0, platformMin: 0 },
];

// 美股卖出时监管费（经常调整，仅供参考）
const SEC_RATE = 0.0000278; // 约 $27.8 / $1M
const TAF_PER_SHARE = 0.000166;
const TAF_MAX = 8.3;

const BROKER_KEY = 'gushenle-cost-broker';

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const fmt$ = (n: number) =>
  `$${n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;

const inputCls =
  'mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500';
const labelCls = 'text-[11px] text-slate-400';

export default function CostCalculator() {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [brokerId, setBrokerId] = useState<string>(() => {
    try {
      return localStorage.getItem(BROKER_KEY) || 'futu';
    } catch {
      return 'futu';
    }
  });
  const preset = BROKERS.find((b) => b.id === brokerId) ?? BROKERS[0];

  const [buyPrice, setBuyPrice] = useState('');
  const [shares, setShares] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [days, setDays] = useState('');
  const [marginAmt, setMarginAmt] = useState('');
  const [marginRate, setMarginRate] = useState('');
  const [fxSpread, setFxSpread] = useState('');
  const [withRegFee, setWithRegFee] = useState(true);
  // 费率可手动微调，初始值来自券商预设
  const [commPS, setCommPS] = useState<string | null>(null);
  const [commMin, setCommMin] = useState<string | null>(null);
  const [platPS, setPlatPS] = useState<string | null>(null);
  const [platMin, setPlatMin] = useState<string | null>(null);

  const pickBroker = (id: string) => {
    setBrokerId(id);
    try {
      localStorage.setItem(BROKER_KEY, id);
    } catch {}
    setCommPS(null);
    setCommMin(null);
    setPlatPS(null);
    setPlatMin(null);
  };

  const cPS = commPS ?? String(preset.commissionPerShare);
  const cMin = commMin ?? String(preset.commissionMin);
  const pPS = platPS ?? String(preset.platformPerShare);
  const pMin = platMin ?? String(preset.platformMin);

  const r = useMemo(() => {
    const bp = num(buyPrice);
    const sh = num(shares);
    if (bp <= 0 || sh <= 0) return null;
    const sp = num(sellPrice);
    const dys = num(days);
    const mAmt = num(marginAmt);
    const mRate = num(marginRate);
    const fx = num(fxSpread);

    const commission = (notional: number) => {
      let c = Math.max(num(cPS) * sh, num(cMin));
      if (preset.commissionMaxRate > 0) c = Math.min(c, notional * preset.commissionMaxRate);
      return c;
    };
    const platform = () => Math.max(num(pPS) * sh, num(pMin));
    // 卖出端监管费
    const regFee = (notional: number) =>
      withRegFee ? notional * SEC_RATE + Math.min(TAF_PER_SHARE * sh, TAF_MAX) : 0;

    const buyNotional = bp * sh;
    const buyFees = commission(buyNotional) + platform();
    const fxBuy = buyNotional * (fx / 100);
    const interest = mAmt > 0 && mRate > 0 && dys > 0 ? (mAmt * (mRate / 100) * dys) / 360 : 0;
    const totalIn = buyNotional + buyFees + fxBuy + interest;

    // 卖出端费用随卖出价变化；保本价用不动点迭代求解
    const sellFeesAt = (price: number) => {
      const n = price * sh;
      return commission(n) + platform() + regFee(n) + n * (fx / 100);
    };
    let be = bp; // 保本卖出价初值
    for (let i = 0; i < 50; i++) {
      const refined = (totalIn + sellFeesAt(be)) / sh;
      if (Math.abs(refined - be) < 1e-6) {
        be = refined;
        break;
      }
      be = refined;
    }

    const out: {
      buyNotional: number;
      buyFees: number;
      fxBuy: number;
      interest: number;
      totalIn: number;
      feeRatio: number;
      breakeven: number;
      sell?: {
        net: number;
        pnl: number;
        nominal: number;
        nominalPct: number;
        truePct: number;
        feeDrag: number;
        profitEaten: number | null;
      };
    } = {
      buyNotional,
      buyFees,
      fxBuy,
      interest,
      totalIn,
      feeRatio: buyNotional > 0 ? ((buyFees + fxBuy) / buyNotional) * 100 : 0,
      breakeven: be,
    };

    if (sp > 0) {
      const sellNotional = sp * sh;
      const sFees = sellFeesAt(sp);
      const net = sellNotional - sFees;
      const pnl = net - totalIn;
      const nominal = (sp - bp) * sh;
      out.sell = {
        net,
        pnl,
        nominal,
        nominalPct: buyNotional > 0 ? (nominal / buyNotional) * 100 : 0,
        truePct: totalIn > 0 ? (pnl / totalIn) * 100 : 0,
        feeDrag: buyNotional > 0 ? (nominal / buyNotional) * 100 - (totalIn > 0 ? (pnl / totalIn) * 100 : 0) : 0,
        profitEaten: nominal > 0 ? ((nominal - pnl) / nominal) * 100 : null,
      };
    }
    return out;
  }, [buyPrice, shares, sellPrice, days, marginAmt, marginRate, fxSpread, withRegFee, cPS, cMin, pPS, pMin, preset]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
      >
        <Calculator className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="flex-1">
          <span className="text-sm font-semibold text-slate-100">真实成本试算</span>
          <span className="block text-[10px] text-slate-500 mt-0.5">
            别让佣金、平台费、换汇悄悄吃掉利润
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3">
          <div>
            <label className={labelCls}>券商（费率仅供参考，可在下方微调）</label>
            <select
              value={brokerId}
              onChange={(e) => pickBroker(e.target.value)}
              className={`${inputCls} appearance-none`}
            >
              {BROKERS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className={labelCls}>买入价 $</label>
              <input value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} inputMode="decimal" placeholder="如 150.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>股数</label>
              <input value={shares} onChange={(e) => setShares(e.target.value)} inputMode="decimal" placeholder="如 100" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>卖出价 $（可选）</label>
              <input value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} inputMode="decimal" placeholder="不填只算保本价" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>持有天数（可选）</label>
              <input value={days} onChange={(e) => setDays(e.target.value)} inputMode="decimal" placeholder="算融资利息用" className={inputCls} />
            </div>
          </div>

          <button
            onClick={() => setAdvanced((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
          >
            高级：费率微调 / 换汇 / 融资
            <ChevronDown className={`w-3 h-3 transition-transform ${advanced ? 'rotate-180' : ''}`} />
          </button>
          {advanced && (
            <div className="space-y-2 bg-slate-800/50 rounded-lg p-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>佣金 $/股</label>
                  <input value={cPS} onChange={(e) => setCommPS(e.target.value)} inputMode="decimal" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>最低佣金 $/笔</label>
                  <input value={cMin} onChange={(e) => setCommMin(e.target.value)} inputMode="decimal" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>平台费 $/股</label>
                  <input value={pPS} onChange={(e) => setPlatPS(e.target.value)} inputMode="decimal" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>最低平台费 $/笔</label>
                  <input value={pMin} onChange={(e) => setPlatMin(e.target.value)} inputMode="decimal" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>换汇点差 %</label>
                  <input value={fxSpread} onChange={(e) => setFxSpread(e.target.value)} inputMode="decimal" placeholder="如 0.3" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>融资年利率 %</label>
                  <input value={marginRate} onChange={(e) => setMarginRate(e.target.value)} inputMode="decimal" placeholder="如 6.8" className={inputCls} />
                </div>
              </div>
              <div>
                <label className={labelCls}>融资金额 $（配合天数+利率算利息）</label>
                <input value={marginAmt} onChange={(e) => setMarginAmt(e.target.value)} inputMode="decimal" placeholder="不融资不填" className={inputCls} />
              </div>
              <label className="flex items-center gap-2 text-[11px] text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withRegFee}
                  onChange={(e) => setWithRegFee(e.target.checked)}
                  className="accent-emerald-500"
                />
                计入美股卖出监管费（SEC + FINRA，约数）
              </label>
            </div>
          )}

          {!r ? (
            <p className="text-[11px] text-slate-500 py-2">填一下买入价和股数，就算出这一笔的真实成本。</p>
          ) : (
            <div className="space-y-2 bg-slate-800/50 rounded-lg p-3 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">买入金额</span>
                <span className="text-slate-200 font-medium">{fmt$(r.buyNotional)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">买入端费用（佣金+平台费）</span>
                <span className="text-slate-200 font-medium">{fmt$(r.buyFees)}</span>
              </div>
              {r.fxBuy > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">换汇成本</span>
                  <span className="text-slate-200 font-medium">{fmt$(r.fxBuy)}</span>
                </div>
              )}
              {r.interest > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-400">融资利息</span>
                  <span className="text-slate-200 font-medium">{fmt$(r.interest)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-700 pt-2">
                <span className="text-slate-300 font-medium">保本卖出价</span>
                <span className="text-amber-400 font-bold text-sm">{fmt$(r.breakeven)}</span>
              </div>
              <p className="text-slate-500 leading-relaxed">
                这一来一回，费用占买入金额的 {r.feeRatio.toFixed(2)}%。卖到 {fmt$(r.breakeven)} 才真正回本。
              </p>
              {r.sell && (
                <>
                  <div className="border-t border-slate-700 pt-2 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-400">看着赚了（名义）</span>
                      <span className={`font-medium ${r.sell.nominal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r.sell.nominal >= 0 ? '+' : ''}{fmt$(r.sell.nominal)}（{r.sell.nominalPct >= 0 ? '+' : ''}{r.sell.nominalPct.toFixed(2)}%）
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">实际到手（扣完所有费用）</span>
                      <span className={`font-bold ${r.sell.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {r.sell.pnl >= 0 ? '+' : ''}{fmt$(r.sell.pnl)}（{r.sell.pnl >= 0 ? '+' : ''}{r.sell.truePct.toFixed(2)}%）
                      </span>
                    </div>
                  </div>
                  {r.sell.profitEaten !== null && r.sell.profitEaten > 0 && (
                    <p className="text-slate-500 leading-relaxed">
                      费用吃掉了 {r.sell.profitEaten < 1 ? r.sell.profitEaten.toFixed(1) : r.sell.profitEaten.toFixed(0)}% 的利润。
                      {r.feeRatio > 1 ? '小资金短线进出的话，券商赚得比你稳。' : ''}
                    </p>
                  )}
                  {r.sell.pnl < 0 && r.sell.nominal >= 0 && (
                    <p className="text-amber-400/90 leading-relaxed">
                      注意：股价涨了，但扣完费用你还是亏的 —— 这就是只看涨跌幅的坑。
                    </p>
                  )}
                </>
              )}
            </div>
          )}
          <p className="text-[10px] text-slate-600 leading-relaxed">
            费率为公开资料整理的参考值，券商随时可能调整，下单前以官方最新公布为准；监管费率经常变动，此处为约数。
          </p>
        </div>
      )}
    </div>
  );
}
