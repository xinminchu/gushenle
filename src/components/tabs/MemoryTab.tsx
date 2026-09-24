// src/components/tabs/MemoryTab.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Sparkles, CheckCircle2, XCircle, Send, Trash2, History,
} from 'lucide-react';
import {
  loadOperations,
  saveOperation,
  deleteOperation,
  updateOperation,
  normalizeAction,
  ACTION_LABEL,
  verdictFor,
  todayStr,
  type OperationRecord,
  type OpAction,
} from '@/lib/operations';
import { applyOperationToPositions } from '@/lib/positions';
import { loadPositions } from '@/lib/positions';
import { lastSyncAt, markSynced, SYNC_DUP_WINDOW_MS } from '@/lib/positions';
import { loadWatchlist } from '@/lib/watchlist';
import { findSimilarRecord, findDuplicateGroups, type SimilarHit } from '@/lib/memoryParse';
import PortraitPanel from '@/components/memory/PortraitPanel';

interface Review { r5: number | null; r20: number | null }

interface AdviceCandidate {
  symbol: string;
  name: string;
  price: number;
  score: number;
  status: string;
  reason: string;
  blurb?: string | null;
}

interface AdviceResult {
  candidates: AdviceCandidate[];
  excluded: AdviceCandidate[];
  held: { symbol: string; name: string }[];
  asOf: string;
}

interface SingleAdvice {
  symbol: string;
  name: string;
  price: number;
  score: number;
  status: string;
  side: 'buy' | 'sell';
  verdict: string;
  blurb?: string | null;
}

export default function MemoryTab() {
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [ops, setOps] = useState<OperationRecord[]>([]);
  const [reviews, setReviews] = useState<Record<string, Review>>({});
  // 页面内提示（替代 alert，不再触发浏览器 Suppress dialogs）
  const [notice, setNotice] = useState<{ type: 'error' | 'info'; text: string } | null>(null);
  // 闲聊意图：AI 的一句引导回复
  const [chatReply, setChatReply] = useState<string | null>(null);
  // 咨询意图：按律动给出的买入建议
  const [advice, setAdvice] = useState<AdviceResult | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  // 单只咨询：问"今天可以卖IBM吗"这种
  const [singleAdvice, setSingleAdvice] = useState<SingleAdvice | null>(null);
  // 解析后可微调的字段
  const [priceEdit, setPriceEdit] = useState('');
  const [qtyEdit, setQtyEdit] = useState('');
  const [dateEdit, setDateEdit] = useState('');
  const [actionEdit, setActionEdit] = useState<OpAction>('sell');
  // 同步到持仓：展开的记录 id + 股数
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncQty, setSyncQty] = useState('');
  // 防重复：记一笔确认前的相似提醒；查重复的扫描结果
  const [dupWarning, setDupWarning] = useState<SimilarHit | null>(null);
  const [auditGroups, setAuditGroups] = useState<OperationRecord[][] | null>(null);

  const recogRef = useRef<any>(null);
  const speechTextRef = useRef('');

  useEffect(() => {
    setOps(loadOperations());
  }, []);

  // 每条操作记录拉一次 forward-return（+5/+20 天）
  useEffect(() => {
    ops.forEach((op) => {
      if (reviews[op.id] !== undefined) return;
      setReviews((prev) => ({ ...prev, [op.id]: { r5: null, r20: null } })); // 占位防重复
      fetch(`/api/forward-return?symbol=${encodeURIComponent(op.symbol)}&date=${op.date}`)
        .then((r) => r.json())
        .then((j) => {
          setReviews((prev) => ({ ...prev, [op.id]: { r5: j.r5 ?? null, r20: j.r20 ?? null } }));
        })
        .catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ops]);

  const speechSupported =
    typeof window !== 'undefined' &&
    ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const ttsSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;

  /** 语音回读：把解析出的一笔念出来，耳朵比眼睛更容易发现数字错了 */
  const speakTrade = (action: string, symbol: string, qty: string, price: string, date: string) => {
    if (!ttsSupported) return;
    try {
      window.speechSynthesis.cancel();
      const actionWord = action === 'buy' ? '买入' : '卖出';
      const spell = symbol.split('').join(' '); // I B M，避免连读
      const dateWord = /^\d{4}-\d{2}-\d{2}$/.test(date)
        ? `${parseInt(date.slice(5, 7), 10)}月${parseInt(date.slice(8, 10), 10)}日`
        : date;
      const parts = [`${actionWord} ${spell}`];
      if (qty) parts.push(`${qty}股`);
      if (price) parts.push(`单价${price}`);
      parts.push(dateWord);
      const u = new SpeechSynthesisUtterance(parts.join('，') + '，对吗？');
      u.lang = 'zh-CN';
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const stopSpeak = () => {
    try { if (ttsSupported) window.speechSynthesis.cancel(); } catch {}
  };

  const handleAnalyze = async (textToAnalyze: string, fromVoice = false) => {
    if (!textToAnalyze.trim()) return;
    setLoading(true);
    setParsedResult(null);
    setChatReply(null);
    setAdvice(null);
    setSingleAdvice(null);
    setNotice(null);
    setDupWarning(null);
    setAuditGroups(null);
    try {
      const res = await fetch('/api/analyze-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: textToAnalyze }),
      });
      const json = await res.json();
      if (json.success && json.intent === 'record') {
        const d = json.data;
        setParsedResult(d);
        setPriceEdit(d.price != null ? String(d.price) : '');
        setQtyEdit(d.qty != null ? String(d.qty) : '');
        setDateEdit(d.opDate || todayStr());
        setActionEdit(normalizeAction(d.action) ?? 'sell');
        // 语音来的：一遍回读，数字错了耳朵先发现（iOS 可能拦截自动朗读，确认卡上有"再听一遍"按钮兜底）
        if (fromVoice) {
          speakTrade(
            normalizeAction(d.action) ?? 'sell',
            String(d.symbol || '').toUpperCase(),
            d.qty != null ? String(d.qty) : '',
            d.price != null ? String(d.price) : '',
            d.opDate || todayStr(),
          );
        }
        // 记一笔确认前：15 分钟内有没有疑似同一笔（防语音重说、手滑点两次）
        const similar = findSimilarRecord(
          {
            symbol: String(d.symbol || '').toUpperCase(),
            action: normalizeAction(d.action) ?? 'sell',
            price: typeof d.price === 'number' ? d.price : null,
            qty: typeof d.qty === 'number' ? d.qty : null,
            date: d.opDate || todayStr(),
          },
          ops,
        );
        setDupWarning(similar);
      } else if (json.success && json.intent === 'audit') {
        // 查重复：本地扫一遍操作记录，疑似的列出来由用户亲手删
        const groups = findDuplicateGroups(ops);
        setAuditGroups(groups);
        if (groups.length === 0) {
          setNotice({ type: 'info', text: '查过了：操作记录里没有发现疑似重复的 ✓' });
        }
      } else if (json.success && json.intent === 'advice') {
        if (json.symbol) {
          await fetchSingleAdvice(json.symbol, json.side === 'sell' ? 'sell' : 'buy');
        } else {
          await fetchAdvice();
        }
      } else if (json.success && json.intent === 'correct') {
        applyCorrection(json.data);
      } else if (json.success && json.intent === 'chat') {
        setChatReply(json.reply || '这句话记不了一笔，换个说法试试。');
      } else {
        setNotice({ type: 'error', text: json.error || '没能理解这句话，换个说法试试' });
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: '请求失败，请检查网络后重试' });
    } finally {
      setLoading(false);
    }
  };

  /** 单只咨询：问某只股票现在能不能买/卖，按律动给结论 */
  const fetchSingleAdvice = async (symbol: string, side: 'buy' | 'sell') => {
    setAdviceLoading(true);
    try {
      const res = await fetch('/api/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'single', symbol, side }),
      });
      const json = await res.json();
      if (json.success && json.single) {
        setSingleAdvice(json.single);
      } else {
        setNotice({ type: 'info', text: json.error || '没找到这只股票的行情数据' });
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: '律动诊断失败，请检查网络后重试' });
    } finally {
      setAdviceLoading(false);
    }
  };

  /** 咨询意图：按自选列表逐只算律动，给出"买不算追高"的候选 */
  const fetchAdvice = async () => {
    setAdviceLoading(true);
    try {
      const { items } = loadWatchlist();
      const held = new Set(loadPositions().map((p) => p.symbol.toUpperCase()));
      const res = await fetch('/api/advise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbols: items.map((i) => ({ symbol: i.symbol, name: i.name })),
          exclude: [...held],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAdvice(json);
      } else {
        setNotice({ type: 'error', text: json.error || '律动扫描失败' });
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: '律动扫描失败，请检查网络后重试' });
    } finally {
      setAdviceLoading(false);
    }
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      try { recogRef.current?.stop(); } catch {}
      setIsRecording(false);
      return;
    }
    if (!speechSupported) {
      setNotice({ type: 'info', text: '当前浏览器不支持语音识别，请直接在输入框打字' });
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = 'zh-CN';
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    speechTextRef.current = '';
    recog.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      speechTextRef.current = text;
      setInputText(text);
    };
    recog.onend = () => {
      setIsRecording(false);
      const t = speechTextRef.current.trim();
      if (t) handleAnalyze(t, true);
    };
    recog.onerror = () => setIsRecording(false);
    recogRef.current = recog;
    try {
      recog.start();
      setIsRecording(true);
    } catch {
      setIsRecording(false);
    }
  };

  const handleSave = () => {
    if (!parsedResult) return;
    stopSpeak();
    const symbol = String(parsedResult.symbol || '').toUpperCase();
    if (!symbol || symbol === 'UNKNOWN') {
      setNotice({ type: 'error', text: '没识别出股票代码，请说出或输入代码，例如 AAPL' });
      return;
    }
    const price = parseFloat(priceEdit);
    if (!priceEdit || !(price > 0)) {
      setNotice({ type: 'error', text: '请填写成交价格' });
      return;
    }
    const qty = qtyEdit ? parseInt(qtyEdit, 10) : undefined;
    const rec = saveOperation({
      symbol,
      action: actionEdit,
      price,
      qty: qty && qty > 0 ? qty : undefined,
      date: /^\d{4}-\d{2}-\d{2}$/.test(dateEdit) ? dateEdit : todayStr(),
      source: 'voice',
      thesis: parsedResult.thesis || undefined,
      emotion: parsedResult.emotion || undefined,
    });
    setOps(loadOperations());
    setParsedResult(null);
    setInputText('');
    // 新记录立刻拉复盘
    fetch(`/api/forward-return?symbol=${encodeURIComponent(rec.symbol)}&date=${rec.date}`)
      .then((r) => r.json())
      .then((j) => setReviews((prev) => ({ ...prev, [rec.id]: { r5: j.r5 ?? null, r20: j.r20 ?? null } })))
      .catch(() => {});
  };

  const handleCancel = () => {
    stopSpeak();
    setParsedResult(null);
    setDupWarning(null);
  };

  /**
   * 防重复：这次和 15 分钟内那笔只有一个字段不一样（多半是上次说错重说了一遍），
   * 直接改上一笔，不多记一条。
   */
  const applyDupFix = () => {
    if (!dupWarning || dupWarning.kind !== 'field_diff') return;
    const patch: Partial<OperationRecord> = {};
    let label = '';
    if (dupWarning.diffField === 'price') {
      const v = parseFloat(priceEdit);
      if (!(v > 0)) {
        setNotice({ type: 'error', text: '先在下面填好正确的价格，再点「直接改上一笔」' });
        return;
      }
      patch.price = v;
      label = `单价改成 $${v}`;
    } else if (dupWarning.diffField === 'qty') {
      const v = parseInt(qtyEdit, 10);
      if (!(v > 0)) {
        setNotice({ type: 'error', text: '先在下面填好正确的数量，再点「直接改上一笔」' });
        return;
      }
      patch.qty = v;
      label = `数量改成 ${v} 股`;
    } else {
      return;
    }
    const updated = updateOperation(dupWarning.existing.id, patch);
    if (!updated) {
      setNotice({ type: 'error', text: '没找到那条记录' });
      return;
    }
    setOps(loadOperations());
    setParsedResult(null);
    setDupWarning(null);
    setInputText('');
    setNotice({ type: 'info', text: `已更正：${updated.symbol} ${label}，没有多记一笔 ✓` });
  };

  /** 更正意图：说错了，直接改最近一条（或点名股票的最近一条） */
  const applyCorrection = (c: {
    field: 'price' | 'qty' | 'date' | 'action';
    value: number | string | null;
    symbol?: string | null;
  }) => {
    if (ops.length === 0) {
      setNotice({ type: 'error', text: '还没有操作记录，先记一笔吧' });
      return;
    }
    const sym = c.symbol ? String(c.symbol).toUpperCase() : null;
    const target = (sym ? ops.find((o) => o.symbol === sym) : undefined) || ops[0];
    const patch: Partial<OperationRecord> = {};
    let label = '';
    if (c.field === 'price' && typeof c.value === 'number' && c.value > 0) {
      patch.price = c.value;
      label = `单价改成 $${c.value}`;
    } else if (c.field === 'qty' && typeof c.value === 'number' && c.value > 0) {
      patch.qty = Math.round(c.value);
      label = `数量改成 ${Math.round(c.value)} 股`;
    } else if (
      c.field === 'date' &&
      typeof c.value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(c.value)
    ) {
      patch.date = c.value;
      label = `日期改成 ${c.value}`;
    } else if (c.field === 'action' && (c.value === 'buy' || c.value === 'sell')) {
      patch.action = c.value;
      label = `方向改成${ACTION_LABEL[c.value]}`;
    } else {
      setNotice({
        type: 'error',
        text: '没听清要改成什么，再说一遍吧（例如：刚才那笔单价改成 227.92）',
      });
      return;
    }
    const updated = updateOperation(target.id, patch);
    if (!updated) {
      setNotice({ type: 'error', text: '没找到那条记录' });
      return;
    }
    setOps(loadOperations());
    setInputText('');
    setNotice({
      type: 'info',
      text: `已更正：${target.symbol}（${target.date}）${label}`,
    });
    // 改了日期会影响复盘，重拉这条的 forward-return
    if (c.field === 'date') {
      const newDate = (patch.date as string) || target.date;
      fetch(`/api/forward-return?symbol=${encodeURIComponent(target.symbol)}&date=${newDate}`)
        .then((r) => r.json())
        .then((j) =>
          setReviews((prev) => ({ ...prev, [target.id]: { r5: j.r5 ?? null, r20: j.r20 ?? null } })),
        )
        .catch(() => {});
    }
  };

  const handleDelete = (id: string) => {
    if (!confirm('删除这条操作记录？')) return;
    deleteOperation(id);
    setOps(loadOperations());
    setReviews((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    });
  };

  const doSync = (op: OperationRecord) => {
    const qty = parseInt(syncQty, 10);
    if (!(qty > 0)) {
      setNotice({ type: 'error', text: '请填写股数' });
      return;
    }
    // 同一条记录 15 分钟内重复"同步到持仓"：多半是手滑点两次，先拦一下
    const prev = lastSyncAt(op.id);
    if (prev && Date.now() - prev < SYNC_DUP_WINDOW_MS) {
      const m = Math.max(1, Math.round((Date.now() - prev) / 60000));
      if (
        !confirm(`这条记录 ${m} 分钟前刚同步过，再同步会重复加仓。确定还要同步吗？`)
      )
        return;
    }
    const r = applyOperationToPositions({
      symbol: op.symbol,
      action: op.action,
      price: op.price,
      qty,
      date: op.date,
    });
    setNotice({ type: r.ok ? 'info' : 'error', text: r.msg });
    if (r.ok) {
      markSynced(op.id);
      setSyncingId(null);
    }
  };

  // 汇总：卖飞/卖对/买高/买对（用 20 天，没有就用 5 天）
  const summary = { missSell: 0, goodSell: 0, highBuy: 0, goodBuy: 0 };
  ops.forEach((op) => {
    const rv = reviews[op.id];
    if (!rv) return;
    const fwd = rv.r20 ?? rv.r5;
    const v = verdictFor(op.action, fwd);
    if (!v) return;
    if (op.action === 'sell' && !v.good) summary.missSell++;
    if (op.action === 'sell' && v.good && v.label.startsWith('卖对')) summary.goodSell++;
    if (op.action === 'buy' && !v.good) summary.highBuy++;
    if (op.action === 'buy' && v.good && v.label.startsWith('买对')) summary.goodBuy++;
  });
  const totalReviewed = summary.missSell + summary.goodSell + summary.highBuy + summary.goodBuy;

  return (
    <div className="p-4 space-y-6 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">操作记忆</h1>
        <p className="text-xs text-slate-400 mt-0.5">说一句或点一下记一笔，涨跌复盘自动算</p>
      </header>

      {/* 语音与文本输入卡片 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="例如：今天 235 卖了 100 股苹果 AAPL…说错了讲：刚才那笔单价说错了是 227.92；查重复：有没有记重"
            className="w-full h-20 bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <button
            onClick={() => handleAnalyze(inputText)}
            disabled={loading || !inputText.trim()}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> 发送给 AI 整理
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink mx-2 text-[10px] text-slate-500">或语音录入</span>
          <div className="flex-grow border-t border-slate-700"></div>
        </div>

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
            {isRecording
              ? '录音中... 再点击结束并自动整理'
              : speechSupported
                ? '点击开始说话，结束自动整理'
                : '当前浏览器不支持语音，请打字输入'}
          </p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center space-x-2 text-slate-400 py-6 text-xs">
          <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
          <span>AI 正在整理...</span>
        </div>
      )}

      {/* 页面内提示（替代 alert） */}
      {notice && !loading && (
        <div
          className={`border rounded-xl p-3.5 flex items-start gap-2 ${
            notice.type === 'error'
              ? 'border-amber-500/40 bg-amber-500/10'
              : 'border-blue-500/30 bg-blue-500/10'
          }`}
        >
          <p className="flex-1 text-xs leading-relaxed text-slate-200">{notice.text}</p>
          <button
            onClick={() => setNotice(null)}
            className="text-slate-500 hover:text-slate-300 shrink-0"
            aria-label="关闭提示"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 闲聊意图：AI 的一句引导 */}
      {chatReply && !loading && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> AI 说
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{chatReply}</p>
          <button
            onClick={() => setChatReply(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            知道了
          </button>
        </div>
      )}

      {adviceLoading && (
        <div className="flex items-center justify-center space-x-2 text-slate-400 py-6 text-xs">
          <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
          <span>正在按律动诊断…</span>
        </div>
      )}

      {/* 咨询意图：按律动给出的买入候选 */}
      {advice && !adviceLoading && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> 按律动，现在买不算追高的
            </span>
            <span className="text-[10px] text-slate-500">{advice.asOf}</span>
          </div>

          {advice.candidates.length === 0 ? (
            <p className="text-xs text-slate-300 leading-relaxed">
              自选里的股票按律动现在都不适合新开仓，先不追，等回调。
            </p>
          ) : (
            <div className="space-y-2">
              {advice.candidates.map((c) => (
                <div key={c.symbol} className="bg-slate-800/60 border border-slate-800 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-slate-100">
                      {c.symbol}{' '}
                      <span className="text-[11px] font-normal text-slate-400">{c.name}</span>
                    </span>
                    <span className="text-xs text-slate-300">
                      ${c.price.toFixed(2)} ·{' '}
                      <span className="text-emerald-400 font-bold">{c.score}分</span>
                    </span>
                  </div>
                  {c.blurb && (
                    <div className="text-[10px] text-slate-500 mb-1">🏢 {c.blurb}</div>
                  )}
                  <div className="text-[10px] text-slate-500 mb-1">律动诊断：{c.status}</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{c.reason}</p>
                </div>
              ))}
            </div>
          )}

          {advice.excluded.length > 0 && (
            <div className="pt-1">
              <div className="text-[10px] text-slate-500 mb-1">已排除（拦追高 / 不接飞刀）：</div>
              {advice.excluded.map((e) => (
                <p key={e.symbol} className="text-[11px] text-slate-500 leading-relaxed">
                  · {e.symbol} {e.reason}
                </p>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-600 leading-relaxed border-t border-slate-800 pt-2">
            律动只帮你避开追高，不预测涨跌；仅供参考，不构成投资建议。
          </p>
          <button
            onClick={() => setAdvice(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            收起
          </button>
        </div>
      )}

      {/* 单只咨询：按律动给这只股票的买卖结论 */}
      {singleAdvice && !adviceLoading && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {singleAdvice.side === 'sell' ? '按律动，现在能不能卖' : '按律动，这只现在能不能买'}
            </span>
          </div>
          <div className="bg-slate-800/60 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-100">
                {singleAdvice.symbol}{' '}
                <span className="text-[11px] font-normal text-slate-400">{singleAdvice.name}</span>
              </span>
              <span className="text-xs text-slate-300">
                ${singleAdvice.price.toFixed(2)} ·{' '}
                <span className="text-emerald-400 font-bold">{singleAdvice.score}分</span>
              </span>
            </div>
            {singleAdvice.blurb && (
              <div className="text-[10px] text-slate-500 mb-1">🏢 {singleAdvice.blurb}</div>
            )}
            <div className="text-[10px] text-slate-500 mb-1">律动诊断：{singleAdvice.status}</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{singleAdvice.verdict}</p>
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed border-t border-slate-800 pt-2">
            律动只帮你避开追高割肉，不预测涨跌；仅供参考，不构成投资建议。
          </p>
          <button
            onClick={() => setSingleAdvice(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            收起
          </button>
        </div>
      )}

      {/* AI 整理结果：确认后存入 */}
      {parsedResult && !loading && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI 整理结果，确认后存入
            </span>
            <div className="flex items-center gap-2">
              {ttsSupported && (
                <button
                  onClick={() =>
                    speakTrade(
                      actionEdit,
                      String(parsedResult.symbol || '').toUpperCase(),
                      qtyEdit,
                      priceEdit,
                      dateEdit,
                    )
                  }
                  className="text-[10px] bg-slate-700 text-slate-200 px-2 py-0.5 rounded flex items-center gap-1"
                  title="把这笔念出来再核对一遍"
                >
                  🔊 再听一遍
                </button>
              )}
              {parsedResult.emotion && (
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                  情绪：{parsedResult.emotion}
                </span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-100 font-medium">
            {parsedResult.symbol}
            {parsedResult.thesis && (
              <p className="text-slate-400 font-normal mt-1 bg-slate-800/60 p-2 rounded border border-slate-800">
                {parsedResult.thesis}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-slate-500 mb-1">方向</div>
              <div className="flex gap-1">
                {(['buy', 'sell'] as OpAction[]).map((a) => (
                  <button
                    key={a}
                    onClick={() => setActionEdit(a)}
                    className={`flex-1 py-1.5 rounded-lg font-medium transition-colors ${
                      actionEdit === a
                        ? a === 'buy'
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {ACTION_LABEL[a]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">日期</div>
              <input
                type="date"
                value={dateEdit}
                onChange={(e) => setDateEdit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <div className="text-slate-500 mb-1">价格 *</div>
              <input
                type="number"
                inputMode="decimal"
                value={priceEdit}
                onChange={(e) => setPriceEdit(e.target.value)}
                placeholder="成交价"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <div className="text-slate-500 mb-1">数量（可选）</div>
              <input
                type="number"
                inputMode="numeric"
                value={qtyEdit}
                onChange={(e) => setQtyEdit(e.target.value)}
                placeholder="股数"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 防重复提醒：15 分钟内有疑似同一笔，只提醒、不添麻烦 */}
          {dupWarning && (
            <div
              className={`rounded-lg p-3 text-xs leading-relaxed border ${
                dupWarning.kind === 'exact'
                  ? 'border-amber-500/40 bg-amber-500/10 text-slate-200'
                  : 'border-blue-500/30 bg-blue-500/10 text-slate-200'
              }`}
            >
              {dupWarning.kind === 'exact' ? (
                <p>
                  ⚠️ <span className="font-semibold">{dupWarning.minutesAgo} 分钟前</span>
                  你刚记过一模一样的一笔（{dupWarning.existing.symbol}{' '}
                  {ACTION_LABEL[dupWarning.existing.action]} $
                  {dupWarning.existing.price.toFixed(2)}
                  {dupWarning.existing.qty ? ` × ${dupWarning.existing.qty}股` : ''}）。
                  如果是手滑说重了，点「取消」就行；真要记两笔再点「存入记忆」。
                </p>
              ) : (
                <div className="space-y-2">
                  <p>
                    💡 <span className="font-semibold">{dupWarning.minutesAgo} 分钟前</span>
                    记了 {dupWarning.existing.symbol}{' '}
                    {ACTION_LABEL[dupWarning.existing.action]} $
                    {dupWarning.existing.price.toFixed(2)}
                    {dupWarning.existing.qty ? ` × ${dupWarning.existing.qty}股` : ''}，
                    这次
                    {dupWarning.diffField === 'price'
                      ? ` $${priceEdit || '？'}`
                      : ` ${qtyEdit || '？'}股`}
                    ——是上次{dupWarning.diffField === 'price' ? '价格' : '数量'}没说对吗？
                  </p>
                  <button
                    onClick={applyDupFix}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded-lg font-medium transition-colors"
                  >
                    直接改上一笔
                    {dupWarning.diffField === 'price'
                      ? `为 $${priceEdit || '？'}`
                      : `为 ${qtyEdit || '？'}股`}
                    ，不多记
                  </button>
                  <p className="text-[10px] text-slate-500">
                    不是说错、真要记两笔的话，直接点下面的「存入记忆」。
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCancel}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> 取消
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> 存入记忆
            </button>
          </div>
        </div>
      )}

      {/* 查重复：疑似重复的成组列出，多的那条点 🗑 亲手删 */}
      {auditGroups && auditGroups.length > 0 && !loading && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-amber-300 border-b border-slate-700/80 pb-2">
            🔍 疑似重复（{auditGroups.length} 组），确认多余的那条点 🗑 删掉
          </div>
          {auditGroups.map((g, gi) => (
            <div key={gi} className="bg-slate-800/50 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
              {g.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-200">
                    {o.symbol} {ACTION_LABEL[o.action]} ${o.price.toFixed(2)}
                    {o.qty ? <span className="text-slate-500"> × {o.qty}股</span> : null}
                    <span className="text-slate-500">
                      {' '}
                      · {o.date}{' '}
                      {new Date(o.createdAt).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </span>
                  </span>
                  <button
                    onClick={() => {
                      handleDelete(o.id);
                      setAuditGroups(findDuplicateGroups(loadOperations()));
                    }}
                    className="text-slate-600 hover:text-rose-400 transition-colors shrink-0"
                    aria-label="删除这条"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ))}
          <button
            onClick={() => setAuditGroups(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            知道了
          </button>
        </div>
      )}

      {/* 我的投资画像：卖飞率 + 买高率，只给自己看 */}
      <PortraitPanel ops={ops} reviews={reviews} />

      {/* 汇总 */}
      {totalReviewed > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1">
            <History className="w-3.5 h-3.5 text-slate-400" /> 复盘小结（{totalReviewed} 笔已出结果）
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-emerald-400">{summary.goodSell}</div>
              <div className="text-[10px] text-slate-500">卖对了</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-amber-400">{summary.missSell}</div>
              <div className="text-[10px] text-slate-500">卖飞了</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-emerald-400">{summary.goodBuy}</div>
              <div className="text-[10px] text-slate-500">买对了</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-rose-400">{summary.highBuy}</div>
              <div className="text-[10px] text-slate-500">买高了</div>
            </div>
          </div>
        </div>
      )}

      {/* 操作记录列表 */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-200">操作记录（{ops.length}）</div>
        {ops.length === 0 && (
          <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            还没有记录。语音说一句，或在今日页点「记一笔」。
          </div>
        )}
        {ops.map((op) => {
          const rv = reviews[op.id];
          const fwd = rv ? (rv.r20 ?? rv.r5) : undefined;
          const winLabel = rv && rv.r20 != null ? '20天' : rv && rv.r5 != null ? '5天' : null;
          const v = fwd === undefined ? undefined : verdictFor(op.action, fwd);
          return (
            <div key={op.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-100">{op.symbol}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      op.action === 'buy' ? 'bg-rose-500/15 text-rose-400' : 'bg-emerald-500/15 text-emerald-400'
                    }`}
                  >
                    {ACTION_LABEL[op.action]}
                  </span>
                  <span className="text-[10px] text-slate-500">{op.date}</span>
                </div>
                <button
                  onClick={() => handleDelete(op.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors"
                  aria-label="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-slate-300">
                ${op.price.toFixed(2)}
                {op.qty ? <span className="text-slate-500"> × {op.qty}股</span> : null}
                {op.adviceSnapshot && (
                  <span className="text-slate-500"> · 当时建议：{op.adviceSnapshot}</span>
                )}
              </div>
              {op.thesis && <div className="text-[11px] text-slate-500 leading-relaxed">{op.thesis}</div>}
              <div className="text-[11px] pt-0.5">
                {v ? (
                  <span className={v.good ? 'text-emerald-400' : 'text-amber-400'}>
                    {winLabel}后 {v.label}
                  </span>
                ) : (
                  <span className="text-slate-600">
                    {rv ? '数据不足，还没法复盘' : '复盘计算中...'}
                  </span>
                )}
                {rv && rv.r5 != null && rv.r20 != null && (
                  <span className="text-slate-600">（5天 {rv.r5 >= 0 ? '+' : ''}{rv.r5.toFixed(1)}%）</span>
                )}
              </div>
              {/* 同步到持仓：记忆是流水，持仓是余额 */}
              <div className="pt-1">
                {syncingId === op.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={syncQty}
                      onChange={(e) => setSyncQty(e.target.value)}
                      placeholder="股数"
                      className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => doSync(op)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-3 py-1.5 rounded-lg font-medium"
                    >
                      确认同步
                    </button>
                    <button
                      onClick={() => setSyncingId(null)}
                      className="text-slate-500 hover:text-slate-300 text-[11px] px-2 py-1.5"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setSyncingId(op.id);
                      setSyncQty(op.qty ? String(op.qty) : '');
                    }}
                    className="text-[11px] text-blue-400/90 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    同步到持仓
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
