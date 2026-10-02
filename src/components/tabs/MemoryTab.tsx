// src/components/tabs/MemoryTab.tsx
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic, Square, Sparkles, CheckCircle2, XCircle, Send, Trash2, History,
} from 'lucide-react';
import {
  loadOperations,
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
import { lastSyncAt, markSynced, SYNC_DUP_WINDOW_MS, saveOperationAndSync, undoSaveAndSync, type SaveAndSyncResult } from '@/lib/positions';
import { loadWatchlist } from '@/lib/watchlist';
import { findSimilarRecord, findDuplicateGroups, type SimilarHit } from '@/lib/memoryParse';
import PortraitPanel from '@/components/memory/PortraitPanel';
import SymbolReview from '@/components/memory/SymbolReview';
import SpeakButton from '@/components/SpeakButton';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { useNickname } from '@/hooks/useNickname';
import { tx } from '@/lib/hant';
import { isSupabaseConfigured } from '@/lib/supabase';
import { createPost, fetchPosts, splitSymbols, type FamilyPost } from '@/lib/family';

/** 已分享到资讯圈的操作 id（防重复分享，localStorage） */
const SHARED_OPS_KEY = 'gushenle:shared_ops:v1';
function loadSharedOpIds(): Set<string> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(SHARED_OPS_KEY) : null;
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

interface Review { r5: number | null; r20: number | null }

interface AdviceCandidate {
  symbol: string;
  name: string;
  price: number;
  /** true=实时/盘后/盘前报价，false/缺失=日线收盘价 */
  priceLive?: boolean;
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
  priceLive?: boolean;
  score: number;
  status: string;
  side: 'buy' | 'sell';
  verdict: string;
  blurb?: string | null;
}

export default function MemoryTab({ prefillSymbol }: { prefillSymbol?: string | null }) {
  const { lang } = useLanguage();
  // 方向标签：zh 分支走 ACTION_LABEL 原文（买入/卖出）
  const actName = (a: OpAction) => tx(lang, a === 'buy' ? 'Buy' : 'Sell', ACTION_LABEL[a]);
  const [inputText, setInputText] = useState('');
  // 从持仓故事"补一笔"跳过来：输入框预填"买入XXX"，用户补个数和价即可
  useEffect(() => {
    if (prefillSymbol) setInputText((t) => (t ? t : `买入${prefillSymbol} `));
  }, [prefillSymbol]);
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
  // 语音免确认自动记入：刚记入的一笔（8 秒内可撤销），持仓快照一起带
  const [justSaved, setJustSaved] = useState<SaveAndSyncResult | null>(null);
  const justSavedTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (justSavedTimerRef.current) window.clearTimeout(justSavedTimerRef.current);
  }, []);
  // 资讯联动：登录 + 自己的帖子（复盘区用）
  const { user } = useAuth();
  const nickname = useNickname(user?.email);
  const [myPosts, setMyPosts] = useState<FamilyPost[]>([]);
  // 分享到资讯圈：已分享的操作 id（防重复）
  const [sharedOpIds, setSharedOpIds] = useState<Set<string>>(() => loadSharedOpIds());
  const [sharingId, setSharingId] = useState<string | null>(null);

  const recogRef = useRef<any>(null);
  const speechTextRef = useRef('');
  /** 静音自动结束：最后一次出字后 N 秒没新语音，自动 stop 走整理（不用再点一次） */
  const SILENCE_MS = 2800;
  const silenceTimerRef = useRef<number | null>(null);
  /** 防连点：上一次 start 还没起来时不再 new 新会话 */
  const startingRef = useRef(false);
  /** 切后台时停语音：这时候不做自动整理，回来用户自己看输入框 */
  const autoParseRef = useRef(true);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current != null) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  useEffect(() => {
    setOps(loadOperations());
  }, []);

  // 自己的资讯帖子：登录后拉取，供复盘区按标的归类
  useEffect(() => {
    if (!user || !isSupabaseConfigured()) {
      setMyPosts([]);
      return;
    }
    let cancelled = false;
    fetchPosts(user.id)
      .then((all) => {
        if (!cancelled) setMyPosts(all.filter((p) => p.user_id === user.id));
      })
      .catch(() => {
        if (!cancelled) setMyPosts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  /**
   * 切后台/锁屏/关页面：自动停语音、释放麦克风。
   * 之前不处理的话，iOS 状态栏左上角的小话筒会一直亮着（麦克风还被占着）。
   */
  useEffect(() => {
    const stopForHide = () => {
      if (!recogRef.current) return;
      autoParseRef.current = false;
      clearSilenceTimer();
      try { recogRef.current.stop(); } catch {}
    };
    const onVis = () => { if (document.hidden) stopForHide(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', stopForHide);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pagehide', stopForHide);
      stopForHide();
    };
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
  const speakTrade = (action: string, symbol: string, qty: string, price: string, date: string, announced = false) => {
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
      // announced=true：已经记入，播报确认；否则是记入前回读核对
      const u = new SpeechSynthesisUtterance(parts.join('，') + (announced ? '，已记入' : '，对吗？'));
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
    // 新的一轮整理：上一笔的"已记入/撤销"条收掉
    if (justSavedTimerRef.current) window.clearTimeout(justSavedTimerRef.current);
    setJustSaved(null);
    try {
      const res = await fetch('/api/analyze-memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawText: textToAnalyze, lang }),
      });
      const json = await res.json();
      if (json.success && json.intent === 'record') {
        const d = json.data;
        const symbol = String(d.symbol || '').toUpperCase();
        const price = typeof d.price === 'number' ? d.price : null;
        // 动作必须明确识别出买/卖才允许自动记入；识别不清时走确认卡，绝不默认当卖出自动执行
        const parsedAction = normalizeAction(d.action);
        const action = parsedAction ?? 'sell';
        const opDate = d.opDate || todayStr();
        // 记一笔确认前：15 分钟内有没有疑似同一笔（防语音重说、手滑点两次）
        const similar = findSimilarRecord(
          {
            symbol,
            action,
            price,
            qty: typeof d.qty === 'number' ? d.qty : null,
            date: opDate,
          },
          ops,
        );
        // 语音来的、解析干净（股票+价格都有、无疑似重复）：直接记入并自动同步持仓，
        // 不再弹确认卡；8 秒内可撤销（记录删除 + 持仓按快照精确恢复），听错了也不怕
        const cleanVoice = fromVoice && symbol && symbol !== 'UNKNOWN' && price != null && price > 0 && !similar && parsedAction != null;
        if (cleanVoice) {
          const res = saveOperationAndSync({
            symbol,
            action,
            price,
            qty: typeof d.qty === 'number' && d.qty > 0 ? d.qty : undefined,
            date: /^\d{4}-\d{2}-\d{2}$/.test(opDate) ? opDate : todayStr(),
            source: 'voice',
            thesis: d.thesis || undefined,
            emotion: d.emotion || undefined,
          });
          setOps(loadOperations());
          setInputText('');
          setJustSaved(res);
          // 记入后播报一遍，耳朵做最后的核对
          speakTrade(action, symbol, res.rec.qty != null ? String(res.rec.qty) : '', String(price), opDate, true);
          if (justSavedTimerRef.current) window.clearTimeout(justSavedTimerRef.current);
          justSavedTimerRef.current = window.setTimeout(() => setJustSaved(null), 8000);
        } else {
          setParsedResult(d);
          setPriceEdit(price != null ? String(price) : '');
          setQtyEdit(typeof d.qty === 'number' ? String(d.qty) : '');
          setDateEdit(opDate);
          setActionEdit(action);
          // 语音来的：一遍回读，数字错了耳朵先发现（iOS 可能拦截自动朗读，确认卡上有"再听一遍"按钮兜底）
          if (fromVoice) {
            speakTrade(
              action,
              symbol,
              typeof d.qty === 'number' ? String(d.qty) : '',
              price != null ? String(price) : '',
              opDate,
            );
          }
          setDupWarning(similar);
        }
      } else if (json.success && json.intent === 'audit') {
        // 查重复：本地扫一遍操作记录，疑似的列出来由用户亲手删
        const groups = findDuplicateGroups(ops);
        setAuditGroups(groups);
        if (groups.length === 0) {
          setNotice({ type: 'info', text: tx(lang, 'Checked: no likely duplicates in your log ✓', '查过了：操作记录里没有发现疑似重复的 ✓') });
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
        setChatReply(json.reply || tx(lang, "That doesn't read as a trade — try rephrasing.", '这句话记不了一笔，换个说法试试。'));
      } else {
        setNotice({ type: 'error', text: json.error || tx(lang, "Couldn't catch that — try rephrasing", '没能理解这句话，换个说法试试') });
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: tx(lang, 'Request failed — check your connection and try again', '请求失败，请检查网络后重试') });
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
        body: JSON.stringify({ mode: 'single', symbol, side, lang }),
      });
      const json = await res.json();
      if (json.success && json.single) {
        setSingleAdvice(json.single);
      } else {
        setNotice({ type: 'info', text: json.error || tx(lang, "Couldn't find market data for this symbol", '没找到这只股票的行情数据') });
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: tx(lang, 'Rhythm check failed — check your connection and try again', '律动诊断失败，请检查网络后重试') });
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
          lang,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAdvice(json);
      } else {
        setNotice({ type: 'error', text: json.error || tx(lang, 'Rhythm scan failed', '律动扫描失败') });
      }
    } catch (err) {
      console.error(err);
      setNotice({ type: 'error', text: tx(lang, 'Rhythm scan failed — check your connection and try again', '律动扫描失败，请检查网络后重试') });
    } finally {
      setAdviceLoading(false);
    }
  };

  /** 把"买什么"建议拼成一句口语，给小喇叭念 */
  const adviceSpeech = (a: AdviceResult): string => {
    if (a.candidates.length === 0) {
      return tx(lang,
        "Per rhythm, none of your watchlist stocks are good fresh entries right now. Don't chase, wait for a pullback.",
        '按律动，自选里的股票现在都不适合新开仓，先不追，等回调。');
    }
    const head = tx(lang, 'Per rhythm, fine to buy without chasing: ', '按律动，现在买不算追高的有：');
    const items = a.candidates.slice(0, 3).map((c) =>
      tx(lang, `${c.symbol}, rhythm ${c.score} points. ${c.reason}`, `${c.name}，律动${c.score}分，${c.reason}`));
    return head + items.join(tx(lang, ' ', '；')) + '。';
  };

  /** 把单只结论拼成一句口语，给小喇叭念 */
  const singleSpeech = (s: SingleAdvice): string =>
    tx(lang, `${s.name} ${s.symbol}, rhythm ${s.score} points, ${s.status}. ${s.verdict}`,
      `${s.name}，律动${s.score}分，${s.status}。${s.verdict}`);

  const handleToggleRecord = () => {
    // 录音中再点：手动结束，直接走整理（静音计时器也会做这件事，所以平时不用点第二次）
    if (isRecording) {
      clearSilenceTimer();
      try { recogRef.current?.stop(); } catch {}
      return; // onend 里关状态并自动整理
    }
    if (startingRef.current) return; // 防连点
    if (!speechSupported) {
      setNotice({ type: 'info', text: tx(lang, "This browser doesn't support voice input — type it in instead", '当前浏览器不支持语音识别，请直接在输入框打字') });
      return;
    }
    // 先清掉可能残留的上一个会话：iOS 上旧会话没释放会导致 start 静默失败，
    // 现象就是"点一次没反应、再点一次才开始"。
    try { recogRef.current?.abort?.(); } catch {}
    recogRef.current = null;

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recog = new SR();
    recog.lang = 'zh-CN';
    recog.interimResults = true;
    recog.continuous = true; // 句子间停顿不断连，iOS 说半句就掐话的毛病能缓一些
    recog.maxAlternatives = 1;
    speechTextRef.current = '';
    autoParseRef.current = true;
    recog.onresult = (e: any) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      speechTextRef.current = text;
      setInputText(text);
      // 每次出字都把静音计时器续上：2.8 秒没新字就自动结束并整理
      clearSilenceTimer();
      silenceTimerRef.current = window.setTimeout(() => {
        try { recog.stop(); } catch {}
      }, SILENCE_MS);
    };
    recog.onend = () => {
      clearSilenceTimer();
      recogRef.current = null;
      startingRef.current = false;
      setIsRecording(false);
      const t = speechTextRef.current.trim();
      if (t && autoParseRef.current) handleAnalyze(t, true);
    };
    recog.onerror = (e: any) => {
      clearSilenceTimer();
      const err = e?.error || '';
      // aborted：手动停/切后台停，不打扰；no-speech：一般随后就 onend，不单独提示
      if (err === 'aborted' || err === 'no-speech') return;
      startingRef.current = false;
      recogRef.current = null;
      setIsRecording(false);
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setNotice({ type: 'error', text: tx(lang, 'Microphone/speech recognition is blocked — allow it in iPhone Settings → Safari, then tap again', '麦克风或语音识别没允许：去 iPhone 设置 → Safari 里打开，再点一次试试') });
      } else if (err === 'network') {
        setNotice({ type: 'error', text: tx(lang, 'Speech recognition needs network — check your connection', '语音识别需要联网，检查一下网络再试') });
      } else if (err === 'audio-capture') {
        setNotice({ type: 'error', text: tx(lang, "Couldn't access the microphone", '麦克风被占用或不可用，稍后再试') });
      }
    };
    recogRef.current = recog;
    startingRef.current = true;
    setNotice(null);
    try {
      recog.start();
      setIsRecording(true);
    } catch {
      // iOS 偶发 InvalidStateError：等一拍重试一次，还不行就明说
      window.setTimeout(() => {
        try {
          recog.start();
          setIsRecording(true);
        } catch {
          startingRef.current = false;
          recogRef.current = null;
          setIsRecording(false);
          setNotice({ type: 'error', text: tx(lang, "Voice didn't start — tap once more", '语音没启动，再点一次试试') });
        }
      }, 350);
    }
  };

  const handleSave = () => {
    if (!parsedResult) return;
    stopSpeak();
    const symbol = String(parsedResult.symbol || '').toUpperCase();
    if (!symbol || symbol === 'UNKNOWN') {
      setNotice({ type: 'error', text: tx(lang, "Couldn't pick up a ticker — say or type one, e.g. AAPL", '没识别出股票代码，请说出或输入代码，例如 AAPL') });
      return;
    }
    const price = parseFloat(priceEdit);
    if (!priceEdit || !(price > 0)) {
      setNotice({ type: 'error', text: tx(lang, 'Please enter the fill price', '请填写成交价格') });
      return;
    }
    const qty = qtyEdit ? parseInt(qtyEdit, 10) : undefined;
    // 存记录 + 自动同步到持仓（有股数才同步；没填股数/同步失败时手动按钮仍可补救）
    const { rec, syncMsg, syncOk } = saveOperationAndSync({
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
    if (syncMsg) {
      setNotice({
        type: syncOk ? 'info' : 'error',
        text: syncOk
          ? tx(lang, `Logged and auto-synced to holdings: ${syncMsg}`, `已记入，持仓已自动同步：${syncMsg}`)
          : syncMsg,
      });
    } else {
      setNotice({
        type: 'info',
        text: tx(lang, 'Logged (no share count — tap "Sync to holdings" on the entry to update positions)', '已记入记忆（没填股数）；如需更新持仓，点这条记录下的「同步到持仓」'),
      });
    }
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

  /** 撤销刚自动记入的一笔：删记录 + 持仓按快照精确恢复 */
  const handleUndoSaved = () => {
    if (!justSaved) return;
    stopSpeak();
    undoSaveAndSync(justSaved);
    if (justSavedTimerRef.current) window.clearTimeout(justSavedTimerRef.current);
    setJustSaved(null);
    setOps(loadOperations());
    setNotice({ type: 'info', text: tx(lang, 'Undone — entry removed and holdings restored', '已撤销：这条记录删掉了，持仓也恢复原样') });
  };

  /**
   * 防重复：这次和 15 分钟内那笔只有一个字段不一样（多半是上次说错重说了一遍），
   * 直接改上一笔，不多记一条。
   */
  const applyDupFix = () => {
    if (!dupWarning || dupWarning.kind !== 'field_diff') return;
    const patch: Partial<OperationRecord> = {};
    let label = '';
    let labelEn = '';
    if (dupWarning.diffField === 'price') {
      const v = parseFloat(priceEdit);
      if (!(v > 0)) {
        setNotice({ type: 'error', text: tx(lang, 'Fill in the correct price below first, then hit "Edit last entry"', '先在下面填好正确的价格，再点「直接改上一笔」') });
        return;
      }
      patch.price = v;
      label = `单价改成 $${v}`;
      labelEn = `price → $${v}`;
    } else if (dupWarning.diffField === 'qty') {
      const v = parseInt(qtyEdit, 10);
      if (!(v > 0)) {
        setNotice({ type: 'error', text: tx(lang, 'Fill in the correct quantity below first, then hit "Edit last entry"', '先在下面填好正确的数量，再点「直接改上一笔」') });
        return;
      }
      patch.qty = v;
      label = `数量改成 ${v} 股`;
      labelEn = `qty → ${v} shares`;
    } else {
      return;
    }
    const updated = updateOperation(dupWarning.existing.id, patch);
    if (!updated) {
      setNotice({ type: 'error', text: tx(lang, "Couldn't find that entry", '没找到那条记录') });
      return;
    }
    setOps(loadOperations());
    setParsedResult(null);
    setDupWarning(null);
    setInputText('');
    setNotice({ type: 'info', text: tx(lang, `Fixed: ${updated.symbol} ${labelEn} — no duplicate entry ✓`, `已更正：${updated.symbol} ${label}，没有多记一笔 ✓`) });
  };

  /** 更正意图：说错了，直接改最近一条（或点名股票的最近一条） */
  const applyCorrection = (c: {
    field: 'price' | 'qty' | 'date' | 'action';
    value: number | string | null;
    symbol?: string | null;
  }) => {
    if (ops.length === 0) {
      setNotice({ type: 'error', text: tx(lang, 'No entries yet — log your first trade', '还没有操作记录，先记一笔吧') });
      return;
    }
    const sym = c.symbol ? String(c.symbol).toUpperCase() : null;
    const target = (sym ? ops.find((o) => o.symbol === sym) : undefined) || ops[0];
    const patch: Partial<OperationRecord> = {};
    let label = '';
    let labelEn = '';
    if (c.field === 'price' && typeof c.value === 'number' && c.value > 0) {
      patch.price = c.value;
      label = `单价改成 $${c.value}`;
      labelEn = `price → $${c.value}`;
    } else if (c.field === 'qty' && typeof c.value === 'number' && c.value > 0) {
      patch.qty = Math.round(c.value);
      label = `数量改成 ${Math.round(c.value)} 股`;
      labelEn = `qty → ${Math.round(c.value)} shares`;
    } else if (
      c.field === 'date' &&
      typeof c.value === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(c.value)
    ) {
      patch.date = c.value;
      label = `日期改成 ${c.value}`;
      labelEn = `date → ${c.value}`;
    } else if (c.field === 'action' && (c.value === 'buy' || c.value === 'sell')) {
      patch.action = c.value;
      label = `方向改成${ACTION_LABEL[c.value]}`;
      labelEn = `side → ${c.value === 'buy' ? 'Buy' : 'Sell'}`;
    } else {
      setNotice({
        type: 'error',
        text: tx(lang, 'Didn\'t catch what to change — say it again (e.g. "change the last trade\'s price to 227.92")', '没听清要改成什么，再说一遍吧（例如：刚才那笔单价改成 227.92）'),
      });
      return;
    }
    const updated = updateOperation(target.id, patch);
    if (!updated) {
      setNotice({ type: 'error', text: tx(lang, "Couldn't find that entry", '没找到那条记录') });
      return;
    }
    setOps(loadOperations());
    setInputText('');
    setNotice({
      type: 'info',
      text: tx(lang, `Fixed: ${target.symbol} (${target.date}) — ${labelEn}`, `已更正：${target.symbol}（${target.date}）${label}`),
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
    if (!confirm(tx(lang, 'Delete this entry?', '删除这条操作记录？'))) return;
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
      setNotice({ type: 'error', text: tx(lang, 'Please enter the number of shares', '请填写股数') });
      return;
    }
    // 同一条记录 15 分钟内重复"同步到持仓"：多半是手滑点两次，先拦一下
    const prev = lastSyncAt(op.id);
    if (prev && Date.now() - prev < SYNC_DUP_WINDOW_MS) {
      const m = Math.max(1, Math.round((Date.now() - prev) / 60000));
      if (
        !confirm(tx(lang, `This entry was synced ${m} min ago — syncing again would double-count it. Sync anyway?`, `这条记录 ${m} 分钟前刚同步过，再同步会重复加仓。确定还要同步吗？`))
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

  // 分享到资讯圈：只带操作和逻辑，情绪/成本不公开
  const handleShare = async (op: OperationRecord) => {
    if (!isSupabaseConfigured()) {
      setNotice({ type: 'error', text: tx(lang, 'Community is not available', '资讯功能暂不可用') });
      return;
    }
    if (!user) {
      setNotice({ type: 'info', text: tx(lang, 'Log in from the Community tab first, then share', '先去资讯页登录，回来就能分享给家人了') });
      return;
    }
    if (sharedOpIds.has(op.id)) return;
    setSharingId(op.id);
    try {
      const tradeLine = `${actName(op.action)} ${op.symbol}${op.qty ? ` ${op.qty}${tx(lang, ' sh', '股')}` : ''} @ $${op.price.toFixed(2)}`;
      await createPost({
        user_id: user.id,
        nickname,
        post_type: op.action === 'buy' ? 'thesis' : 'lesson',
        symbol: op.symbol,
        content: op.thesis ? `${tradeLine}\n${op.thesis}` : tradeLine,
      });
      const next = new Set(sharedOpIds);
      next.add(op.id);
      setSharedOpIds(next);
      try {
        window.localStorage.setItem(SHARED_OPS_KEY, JSON.stringify([...next]));
      } catch {}
      // 刷新自己的帖子，复盘区同步
      fetchPosts(user.id)
        .then((all) => setMyPosts(all.filter((p) => p.user_id === user.id)))
        .catch(() => {});
      setNotice({
        type: 'info',
        text: tx(lang, 'Shared to the community ✓ (only the trade and your logic — emotions stay private)', '已分享到资讯圈 ✓（只分享操作和逻辑，情绪不会公开）'),
      });
    } catch (e) {
      console.error(e);
      setNotice({ type: 'error', text: tx(lang, 'Share failed — try again later', '分享失败，稍后再试') });
    } finally {
      setSharingId(null);
    }
  };

  // 汇总：卖飞/卖对/买高/买对（用 20 天，没有就用 5 天）
  const summary = { missSell: 0, goodSell: 0, highBuy: 0, goodBuy: 0 };
  ops.forEach((op) => {
    const rv = reviews[op.id];
    if (!rv) return;
    const fwd = rv.r20 ?? rv.r5;
    const v = verdictFor(op.action, fwd, lang);
    if (!v) return;
    if (op.action === 'sell' && !v.good) summary.missSell++;
    // v.good 为 true 时包含"基本持平"：只有 |fwd|>=0.05% 的真实涨跌才计入卖对/买对
    const real = fwd != null && Math.abs(fwd) >= 0.05;
    if (op.action === 'sell' && v.good && real) summary.goodSell++;
    if (op.action === 'buy' && !v.good) summary.highBuy++;
    if (op.action === 'buy' && v.good && real) summary.goodBuy++;
  });
  const totalReviewed = summary.missSell + summary.goodSell + summary.highBuy + summary.goodBuy;

  return (
    <div className="p-4 space-y-6 pb-24 max-w-md mx-auto">
      <header className="pt-2">
        <h1 className="text-xl font-bold text-slate-100">{tx(lang, 'Trade Journal', '操作记忆')}</h1>
        <p className="text-xs text-slate-400 mt-0.5">{tx(lang, 'Say it or tap it to log a trade — review is automatic', '说一句或点一下记一笔，涨跌复盘自动算')}</p>
      </header>

      {/* 语音与文本输入卡片 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="space-y-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={tx(lang, 'e.g. "sold 100 AAPL at 235 today"… fix it: "that price was wrong, it\'s 227.92"; check dupes: "any duplicates"', '例如：今天 235 卖了 100 股苹果 AAPL…说错了讲：刚才那笔单价说错了是 227.92；查重复：有没有记重')}
            className="w-full h-20 bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
          />
          <button
            onClick={() => handleAnalyze(inputText)}
            disabled={loading || !inputText.trim()}
            className="w-full bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <Send className="w-3.5 h-3.5" /> {tx(lang, 'Send to AI', '发送给 AI 整理')}
          </button>
        </div>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-700"></div>
          <span className="flex-shrink mx-2 text-[10px] text-slate-500">{tx(lang, 'or voice input', '或语音录入')}</span>
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
              ? tx(lang, 'Listening… pause a moment and it parses automatically (or tap to stop)', '聆听中…说完停顿一下自动整理，也可再点结束')
              : speechSupported
                ? tx(lang, 'Tap to speak — pause when done and it parses automatically', '点击开始说话，说完停顿一下自动整理')
                : tx(lang, 'Voice input not supported here — please type', '当前浏览器不支持语音，请打字输入')}
          </p>
        </div>
      </div>

      {/* 整理结果区：整理中 / 确认卡 / 已记入提示都在这一个位置切换，不再两次弹出 */}
      {(loading || parsedResult || justSaved) && (
        <>
          {loading ? (
            <div className="flex items-center justify-center space-x-2 text-slate-400 py-6 text-xs">
              <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
              <span>{tx(lang, 'AI is parsing…', 'AI 正在整理...')}</span>
            </div>
          ) : justSaved ? (
            <div className="bg-emerald-950/50 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div className="flex-1 text-xs text-slate-200 leading-relaxed">
                <span className="font-semibold text-emerald-300">{tx(lang, 'Logged \u2713', '已记入 \u2713')}</span>{' '}
                {actName(justSaved.rec.action)} {justSaved.rec.symbol}
                {justSaved.rec.qty ? ` \u00d7 ${justSaved.rec.qty}${tx(lang, ' shares', '股')}` : ''}
                {' @ $'}{justSaved.rec.price.toFixed(2)}
                {justSaved.syncMsg && <span className="text-slate-400"> · {justSaved.syncMsg}</span>}
                <div className="text-slate-500 text-[10px] mt-0.5">{tx(lang, 'Undo within 8s if anything is wrong', '有误 8 秒内可撤销')}</div>
              </div>
              <button
                onClick={handleUndoSaved}
                className="shrink-0 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              >
                {tx(lang, 'Undo', '撤销')}
              </button>
            </div>
          ) : (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> {tx(lang, 'AI parsed result — confirm to save', 'AI 整理结果，确认后存入')}
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
                  title={tx(lang, 'Read this trade aloud to double-check', '把这笔念出来再核对一遍')}
                >
                  {tx(lang, '🔊 Listen again', '🔊 再听一遍')}
                </button>
              )}
              {parsedResult.emotion && (
                <span className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                  {tx(lang, 'Mood: ', '情绪：')}{parsedResult.emotion}
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
              <div className="text-slate-500 mb-1">{tx(lang, 'Side', '方向')}</div>
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
                    {actName(a)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-slate-500 mb-1">{tx(lang, 'Date', '日期')}</div>
              <input
                type="date"
                value={dateEdit}
                onChange={(e) => setDateEdit(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <div className="text-slate-500 mb-1">{tx(lang, 'Price *', '价格 *')}</div>
              <input
                type="number"
                inputMode="decimal"
                value={priceEdit}
                onChange={(e) => setPriceEdit(e.target.value)}
                placeholder={tx(lang, 'Fill price', '成交价')}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <div className="text-slate-500 mb-1">{tx(lang, 'Shares (optional)', '数量（可选）')}</div>
              <input
                type="number"
                inputMode="numeric"
                value={qtyEdit}
                onChange={(e) => setQtyEdit(e.target.value)}
                placeholder={tx(lang, 'Shares', '股数')}
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
                  ⚠️ <span className="font-semibold">{tx(lang, `${dupWarning.minutesAgo} min ago`, `${dupWarning.minutesAgo} 分钟前`)}</span>
                  {tx(lang,
                    ` you just logged the exact same trade (${dupWarning.existing.symbol} ${dupWarning.existing.action === 'buy' ? 'buy' : 'sell'} $${dupWarning.existing.price.toFixed(2)}${dupWarning.existing.qty ? ` × ${dupWarning.existing.qty} shares` : ''}).`,
                    `你刚记过一模一样的一笔（${dupWarning.existing.symbol} ${ACTION_LABEL[dupWarning.existing.action]} $${dupWarning.existing.price.toFixed(2)}${dupWarning.existing.qty ? ` × ${dupWarning.existing.qty}股` : ''}）。`)}
                  {tx(lang,
                    ' If you repeated it by mistake, just hit "Cancel"; to log it as a separate trade, hit "Save".',
                    '如果是手滑说重了，点「取消」就行；真要记两笔再点「存入记忆」。')}
                </p>
              ) : (
                <div className="space-y-2">
                  <p>
                    💡 <span className="font-semibold">{tx(lang, `${dupWarning.minutesAgo} min ago`, `${dupWarning.minutesAgo} 分钟前`)}</span>
                    {tx(lang,
                      ` logged ${dupWarning.existing.symbol} ${dupWarning.existing.action === 'buy' ? 'buy' : 'sell'} $${dupWarning.existing.price.toFixed(2)}${dupWarning.existing.qty ? ` × ${dupWarning.existing.qty} shares` : ''} — and this time ${dupWarning.diffField === 'price' ? `$${priceEdit || '?'}` : `${qtyEdit || '?'} shares`}. Was the ${dupWarning.diffField === 'price' ? 'price' : 'quantity'} wrong last time?`,
                      `记了 ${dupWarning.existing.symbol} ${ACTION_LABEL[dupWarning.existing.action]} $${dupWarning.existing.price.toFixed(2)}${dupWarning.existing.qty ? ` × ${dupWarning.existing.qty}股` : ''}，这次${dupWarning.diffField === 'price' ? ` $${priceEdit || '？'}` : ` ${qtyEdit || '？'}股`}——是上次${dupWarning.diffField === 'price' ? '价格' : '数量'}没说对吗？`)}
                  </p>
                  <button
                    onClick={applyDupFix}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-2 rounded-lg font-medium transition-colors"
                  >
                    {tx(lang,
                      `Edit last entry${dupWarning.diffField === 'price' ? ` to $${priceEdit || '?'}` : ` to ${qtyEdit || '?'} shares`} — no new entry`,
                      `直接改上一笔${dupWarning.diffField === 'price' ? `为 $${priceEdit || '？'}` : `为 ${qtyEdit || '？'}股`}，不多记`)}
                  </button>
                  <p className="text-[10px] text-slate-500">
                    {tx(lang, 'If it\'s not a mistake and you really mean two trades, hit "Save" below.', '不是说错、真要记两笔的话，直接点下面的「存入记忆」。')}
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
              <XCircle className="w-3.5 h-3.5" /> {tx(lang, 'Cancel', '取消')}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> {tx(lang, 'Save', '存入记忆')}
            </button>
          </div>
        </div>
          )}
        </>
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
            aria-label={tx(lang, 'Dismiss', '关闭提示')}
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 闲聊意图：AI 的一句引导 */}
      {chatReply && !loading && (
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-200 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> {tx(lang, 'AI says', 'AI 说')}
            </span>
            <SpeakButton text={chatReply} lang={lang} />
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">{chatReply}</p>
          <button
            onClick={() => setChatReply(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            {tx(lang, 'Got it', '知道了')}
          </button>
        </div>
      )}

      {adviceLoading && (
        <div className="flex items-center justify-center space-x-2 text-slate-400 py-6 text-xs">
          <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
          <span>{tx(lang, 'Checking rhythm…', '正在按律动诊断…')}</span>
        </div>
      )}

      {/* 咨询意图：按律动给出的买入候选 */}
      {advice && !adviceLoading && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> {tx(lang, 'Per rhythm — fine to buy without chasing', '按律动，现在买不算追高的')}
            </span>
            <span className="flex items-center gap-1">
              <SpeakButton text={adviceSpeech(advice)} lang={lang} />
              <span className="text-[10px] text-slate-500">{advice.asOf}</span>
            </span>
          </div>

          {advice.candidates.length === 0 ? (
            <p className="text-xs text-slate-300 leading-relaxed">
              {tx(lang, "Per rhythm, none of your watchlist stocks are good fresh entries right now — don't chase, wait for a pullback.", '自选里的股票按律动现在都不适合新开仓，先不追，等回调。')}
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
                      ${c.price.toFixed(2)}{' '}
                      {c.priceLive && <span className="text-emerald-400">●{tx(lang, 'live', '实时')}</span>}{' '}·{' '}
                      <span className="text-emerald-400 font-bold">{tx(lang, `${c.score} pts`, `${c.score}分`)}</span>
                    </span>
                  </div>
                  {c.blurb && (
                    <div className="text-[10px] text-slate-500 mb-1">🏢 {c.blurb}</div>
                  )}
                  <div className="text-[10px] text-slate-500 mb-1">{tx(lang, 'Rhythm: ', '律动诊断：')}{c.status}</div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">{c.reason}</p>
                </div>
              ))}
            </div>
          )}

          {advice.excluded.length > 0 && (
            <div className="pt-1">
              <div className="text-[10px] text-slate-500 mb-1">{tx(lang, 'Excluded (no chasing / no falling knives):', '已排除（拦追高 / 不接飞刀）：')}</div>
              {advice.excluded.map((e) => (
                <p key={e.symbol} className="text-[11px] text-slate-500 leading-relaxed">
                  · {e.symbol} {e.reason}
                </p>
              ))}
            </div>
          )}

          <p className="text-[10px] text-slate-600 leading-relaxed border-t border-slate-800 pt-2">
            {tx(lang, "Rhythm only helps you avoid chasing highs — it never predicts moves. Reference only, not investment advice.", '律动只帮你避开追高，不预测涨跌；仅供参考，不构成投资建议。')}
          </p>
          <button
            onClick={() => setAdvice(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            {tx(lang, 'Collapse', '收起')}
          </button>
        </div>
      )}

      {/* 单只咨询：按律动给这只股票的买卖结论 */}
      {singleAdvice && !adviceLoading && (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/80 pb-2">
            <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              {tx(lang, singleAdvice.side === 'sell' ? 'Per rhythm — OK to sell now?' : 'Per rhythm — OK to buy this now?', singleAdvice.side === 'sell' ? '按律动，现在能不能卖' : '按律动，这只现在能不能买')}
            </span>
            <SpeakButton text={singleSpeech(singleAdvice)} lang={lang} />
          </div>
          <div className="bg-slate-800/60 border border-slate-800 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-bold text-slate-100">
                {singleAdvice.symbol}{' '}
                <span className="text-[11px] font-normal text-slate-400">{singleAdvice.name}</span>
              </span>
              <span className="text-xs text-slate-300">
                ${singleAdvice.price.toFixed(2)}{' '}
                {singleAdvice.priceLive && <span className="text-emerald-400">●{tx(lang, 'live', '实时')}</span>}{' '}·{' '}
                <span className="text-emerald-400 font-bold">{tx(lang, `${singleAdvice.score} pts`, `${singleAdvice.score}分`)}</span>
              </span>
            </div>
            {singleAdvice.blurb && (
              <div className="text-[10px] text-slate-500 mb-1">🏢 {singleAdvice.blurb}</div>
            )}
            <div className="text-[10px] text-slate-500 mb-1">{tx(lang, 'Rhythm: ', '律动诊断：')}{singleAdvice.status}</div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{singleAdvice.verdict}</p>
          </div>
          <p className="text-[10px] text-slate-600 leading-relaxed border-t border-slate-800 pt-2">
            {tx(lang, "Rhythm only helps you avoid chasing highs and selling the bottom — it never predicts moves. Reference only, not investment advice.", '律动只帮你避开追高割肉，不预测涨跌；仅供参考，不构成投资建议。')}
          </p>
          <button
            onClick={() => setSingleAdvice(null)}
            className="text-[11px] text-slate-500 hover:text-slate-300"
          >
            {tx(lang, 'Collapse', '收起')}
          </button>
        </div>
      )}


      {/* 查重复：疑似重复的成组列出，多的那条点 🗑 亲手删 */}
      {auditGroups && auditGroups.length > 0 && !loading && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
          <div className="text-xs font-semibold text-amber-300 border-b border-slate-700/80 pb-2">
            {tx(lang, `🔍 Possible duplicates (${auditGroups.length} groups) — tap 🗑 on the extra one to remove`, `🔍 疑似重复（${auditGroups.length} 组），确认多余的那条点 🗑 删掉`)}
          </div>
          {auditGroups.map((g, gi) => (
            <div key={gi} className="bg-slate-800/50 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
              {g.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-200">
                    {o.symbol} {actName(o.action)} ${o.price.toFixed(2)}
                    {o.qty ? <span className="text-slate-500"> × {o.qty}{tx(lang, ' shares', '股')}</span> : null}
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
                    aria-label={tx(lang, 'Delete this entry', '删除这条')}
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
            {tx(lang, 'Got it', '知道了')}
          </button>
        </div>
      )}

      {/* 我的投资画像：卖飞率 + 买高率，只给自己看 */}
      <PortraitPanel ops={ops} reviews={reviews} />

      {/* 汇总 */}
      {totalReviewed > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="text-xs font-semibold text-slate-200 mb-2 flex items-center gap-1">
            <History className="w-3.5 h-3.5 text-slate-400" /> {tx(lang, `Review (${totalReviewed} settled)`, `复盘小结（${totalReviewed} 笔已出结果）`)}
          </div>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-emerald-400">{summary.goodSell}</div>
              <div className="text-[10px] text-slate-500">{tx(lang, 'Sold right', '卖对了')}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-amber-400">{summary.missSell}</div>
              <div className="text-[10px] text-slate-500">{tx(lang, 'Sold too early', '卖飞了')}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-emerald-400">{summary.goodBuy}</div>
              <div className="text-[10px] text-slate-500">{tx(lang, 'Bought right', '买对了')}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg py-2">
              <div className="text-base font-bold text-rose-400">{summary.highBuy}</div>
              <div className="text-[10px] text-slate-500">{tx(lang, 'Bought high', '买高了')}</div>
            </div>
          </div>
        </div>
      )}

      {/* 按标的复盘：操作记录 + 我的资讯分享，一只一只看 */}
      <SymbolReview ops={ops} reviews={reviews} myPosts={myPosts} lang={lang} loggedIn={!!user} />

      {/* 操作记录列表 */}
      <div className="space-y-2">
        <div className="text-sm font-semibold text-slate-200">{tx(lang, `Trade log (${ops.length})`, `操作记录（${ops.length}）`)}</div>
        {ops.length === 0 && (
          <div className="text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            {tx(lang, 'Nothing logged yet. Speak a trade, or tap "Log a trade" on the Today tab.', '还没有记录。语音说一句，或在今日页点「记一笔」。')}
          </div>
        )}
        {ops.map((op) => {
          const rv = reviews[op.id];
          const fwd = rv ? (rv.r20 ?? rv.r5) : undefined;
          const winLabel = rv && rv.r20 != null ? tx(lang, '20 days', '20天') : rv && rv.r5 != null ? tx(lang, '5 days', '5天') : null;
          const v = fwd === undefined ? undefined : verdictFor(op.action, fwd, lang);
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
                    {actName(op.action)}
                  </span>
                  <span className="text-[10px] text-slate-500">{op.date}</span>
                </div>
                <button
                  onClick={() => handleDelete(op.id)}
                  className="text-slate-600 hover:text-rose-400 transition-colors"
                  aria-label={tx(lang, 'Delete', '删除')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-xs text-slate-300">
                ${op.price.toFixed(2)}
                {op.qty ? <span className="text-slate-500"> × {op.qty}{tx(lang, ' shares', '股')}</span> : null}
                {op.adviceSnapshot && (
                  <span className="text-slate-500"> · {tx(lang, 'advice at the time: ', '当时建议：')}{op.adviceSnapshot}</span>
                )}
              </div>
              {op.thesis && <div className="text-[11px] text-slate-500 leading-relaxed">{op.thesis}</div>}
              <div className="text-[11px] pt-0.5">
                {v ? (
                  <span className={v.good ? 'text-emerald-400' : 'text-amber-400'}>
                    {tx(lang, `${rv && rv.r20 != null ? '20-day' : '5-day'} later: ${v.label}`, `${winLabel}后 ${v.label}`)}
                  </span>
                ) : (
                  <span className="text-slate-600">
                    {rv ? tx(lang, 'Not enough data to review yet', '数据不足，还没法复盘') : tx(lang, 'Review calculating…', '复盘计算中...')}
                  </span>
                )}
                {rv && rv.r5 != null && rv.r20 != null && (
                  <span className="text-slate-600">{tx(lang, `(5-day ${rv.r5 >= 0 ? '+' : ''}${rv.r5.toFixed(1)}%)`, `（5天 ${rv.r5 >= 0 ? '+' : ''}${rv.r5.toFixed(1)}%）`)}</span>
                )}
              </div>
              {/* 同步到持仓：记忆是流水，持仓是余额；分享到资讯圈：只带操作和逻辑 */}
              <div className="pt-1 flex items-center gap-2 flex-wrap">
                {syncingId === op.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={syncQty}
                      onChange={(e) => setSyncQty(e.target.value)}
                      placeholder={tx(lang, 'Shares', '股数')}
                      className="w-24 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      onClick={() => doSync(op)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] px-3 py-1.5 rounded-lg font-medium"
                    >
                      {tx(lang, 'Confirm sync', '确认同步')}
                    </button>
                    <button
                      onClick={() => setSyncingId(null)}
                      className="text-slate-500 hover:text-slate-300 text-[11px] px-2 py-1.5"
                    >
                      {tx(lang, 'Cancel', '取消')}
                    </button>
                  </div>
                ) : lastSyncAt(op.id) ? (
                  <button
                    onClick={() => {
                      setSyncingId(op.id);
                      setSyncQty(op.qty ? String(op.qty) : '');
                    }}
                    title={tx(lang, 'Already synced — tap to sync again', '这条已同步过，再点会重复同步')}
                    className="text-[11px] text-emerald-400/80 hover:text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/40 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    {tx(lang, '✓ Synced', '✓ 已同步')}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSyncingId(op.id);
                      setSyncQty(op.qty ? String(op.qty) : '');
                    }}
                    className="text-[11px] text-blue-400/90 hover:text-blue-300 border border-blue-500/30 hover:border-blue-500/50 rounded-lg px-2.5 py-1 transition-colors"
                  >
                    {tx(lang, 'Sync to holdings', '同步到持仓')}
                  </button>
                )}
                {sharedOpIds.has(op.id) ? (
                  <span className="text-[11px] text-emerald-400/70">✓ {tx(lang, 'Shared', '已分享')}</span>
                ) : (
                  <button
                    onClick={() => handleShare(op)}
                    disabled={sharingId === op.id}
                    className="text-[11px] text-violet-400/90 hover:text-violet-300 border border-violet-500/30 hover:border-violet-500/50 rounded-lg px-2.5 py-1 transition-colors disabled:opacity-50"
                  >
                    {sharingId === op.id ? tx(lang, 'Sharing…', '分享中…') : tx(lang, 'Share to community', '分享到资讯圈')}
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
