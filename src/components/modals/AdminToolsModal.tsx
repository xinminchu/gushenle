'use client';

import React, { useEffect, useState } from 'react';
import {
  X,
  Database,
  Play,
  CheckCircle2,
  CircleDashed,
  AlertTriangle,
  Sparkles,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Radar,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { REPLY_DRAFTS } from '@/lib/replyDrafts';

interface MigStatus {
  version: string;
  name: string;
  applied: boolean | null;
}

interface RunResult {
  version: string;
  name: string;
  status: 'applied' | 'skipped' | 'failed';
  error?: string;
}

type Tab = 'migrate' | 'reply' | 'scan';

/** 站长专属工具箱：数据库迁移 + Mas 回复草稿轮盘 + 市场扫描 */
export default function AdminToolsModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<Tab>('migrate');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setTab('migrate')}
              className={`flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-lg ${
                tab === 'migrate' ? 'text-slate-100 bg-slate-800' : 'text-slate-500'
              }`}
            >
              <Database className="w-4 h-4 text-emerald-400" />
              数据库迁移
            </button>
            <button
              onClick={() => setTab('reply')}
              className={`flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-lg ${
                tab === 'reply' ? 'text-slate-100 bg-slate-800' : 'text-slate-500'
              }`}
            >
              <Sparkles className="w-4 h-4 text-sky-400" />
              回复草稿
            </button>
            <button
              onClick={() => setTab('scan')}
              className={`flex items-center gap-1.5 text-sm font-semibold px-2.5 py-1.5 rounded-lg ${
                tab === 'scan' ? 'text-slate-100 bg-slate-800' : 'text-slate-500'
              }`}
            >
              <Radar className="w-4 h-4 text-amber-400" />
              市场扫描
            </button>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 overflow-y-auto">
          {tab === 'migrate' ? (
            <MigratePane />
          ) : tab === 'reply' ? (
            <ReplyDraftsPane />
          ) : (
            <ScanPane />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- 数据库迁移 ---------------- */

function MigratePane() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [hint, setHint] = useState('');
  const [list, setList] = useState<MigStatus[]>([]);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<RunResult[] | null>(null);
  const [error, setError] = useState('');

  async function token(): Promise<string> {
    const { data } = await supabase!.auth.getSession();
    return data.session?.access_token ?? '';
  }

  async function refresh() {
    setLoading(true);
    setError('');
    setLoadFailed(false);
    try {
      const res = await fetch('/api/admin/migrate', {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) throw new Error((j && j.error) || `读取失败（${res.status}）`);
      setConfigured(j.configured !== false);
      setHint(j.hint || '');
      setList(j.migrations || []);
    } catch (e) {
      setLoadFailed(true);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run() {
    setRunning(true);
    setResults(null);
    setError('');
    try {
      const res = await fetch('/api/admin/migrate', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j) throw new Error((j && j.error) || `执行失败（${res.status}）`);
      setResults(j.results || []);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const pending = list.filter((m) => m.applied === false).length;
  // 只展示待执行的迁移：已执行的收成一行小字。查不到执行状态（applied 全为 null）
  // 时降级为全列出，别把列表搞没。
  const statusKnown = list.some((m) => m.applied !== null);
  const visibleMigrations = statusKnown ? list.filter((m) => !m.applied) : list;
  const appliedCount = list.filter((m) => m.applied === true).length;

  return (
    <>
      {loading && <p className="text-slate-400 text-sm py-4 text-center">读取迁移状态…</p>}

      {!loading && !configured && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 leading-relaxed">
          <div className="font-semibold mb-1 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> 还差一步配置
          </div>
          {hint || '服务端未配置数据库连接串。'}
        </div>
      )}

      {!loading && loadFailed && (
        <div>
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 leading-relaxed break-words mb-3">
            {error || '读取迁移状态失败'}
          </div>
          <button
            onClick={refresh}
            className="w-full bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-semibold rounded-xl py-2.5 active:scale-[0.98] transition"
          >
            重试
          </button>
        </div>
      )}

      {!loading && configured && !loadFailed && (
        <>
          <div className="space-y-1.5 mb-3">
            {visibleMigrations.map((m) => (
              <div
                key={m.version}
                className="flex items-center gap-2 text-xs bg-slate-800/60 rounded-lg px-2.5 py-2"
              >
                {m.applied ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <CircleDashed className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
                <span className="text-slate-300 font-mono">{m.version}</span>
                <span className="text-slate-400 truncate">{m.name}</span>
                <span className={`ml-auto shrink-0 ${m.applied ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {m.applied ? '已执行' : '待执行'}
                </span>
              </div>
            ))}
            {statusKnown && visibleMigrations.length === 0 && (
              <p className="text-xs text-emerald-400 text-center py-2">✓ 全部迁移已是最新</p>
            )}
          </div>
          {statusKnown && appliedCount > 0 && (
            <p className="text-[11px] text-slate-500 text-center mb-3">
              ✓ 已执行 {appliedCount} 个迁移
            </p>
          )}

          {results && (
            <div className="mb-3 space-y-1.5">
              {results.map((r) => (
                <div
                  key={r.version}
                  className={`text-xs rounded-lg px-2.5 py-2 border ${
                    r.status === 'failed'
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : r.status === 'applied'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : 'bg-slate-800/60 border-slate-700 text-slate-500'
                  }`}
                >
                  <span className="font-mono">{r.version}</span> {r.name}：
                  {r.status === 'applied' ? '执行成功' : r.status === 'skipped' ? '已跳过' : '失败'}
                  {r.error && <div className="mt-1 break-words opacity-80">{r.error}</div>}
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 leading-relaxed mb-3 break-words">
              {error}
            </div>
          )}

          <button
            onClick={run}
            disabled={running || loadFailed || pending === 0}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition"
          >
            <Play className="w-4 h-4" />
            {running
              ? '执行中…'
              : loadFailed
                ? '状态读取失败，重试'
                : pending === 0
                  ? '全部已是最新'
                  : `一键运行（${pending} 条待执行）`}
          </button>
          <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
            只执行仓库自带的迁移脚本，按顺序逐条跑，出错即停。每条成功后会记账，下次不再重复跑。
          </p>
        </>
      )}
    </>
  );
}

/* ---------------- Mas 回复草稿轮盘 ---------------- */

function ReplyDraftsPane() {
  // 草稿被清空后（全部已用完），不渲染空轮盘
  if (REPLY_DRAFTS.length === 0) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 text-center">
        <p className="text-xs text-slate-500">暂无回复草稿，有新的再补进来。</p>
      </div>
    );
  }
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState(REPLY_DRAFTS[0].text);
  const [copied, setCopied] = useState(false);

  const edited = text !== REPLY_DRAFTS[idx].text;

  function pick(i: number) {
    if (i === idx) return;
    if (edited && !window.confirm('换一条草稿？当前已修改的内容会被替换。')) return;
    setIdx(i);
    setText(REPLY_DRAFTS[i].text);
    setCopied(false);
  }

  async function copy() {
    const t = text.trim();
    if (!t) return;
    try {
      await navigator.clipboard.writeText(t);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-2.5">
      {/* 轮盘：左右切换 */}
      <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 p-3">
        <div className="text-[11px] font-semibold text-sky-300 mb-1">{REPLY_DRAFTS[idx].label}</div>
        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">
          {REPLY_DRAFTS[idx].text}
        </p>
      </div>
      <div className="flex items-center justify-between">
        <button
          onClick={() => pick((idx + REPLY_DRAFTS.length - 1) % REPLY_DRAFTS.length)}
          className="flex items-center gap-0.5 text-[11px] text-slate-400 px-2 py-1.5 rounded-lg border border-slate-700 active:bg-slate-800"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> 上一条
        </button>
        <div className="flex gap-1.5">
          {REPLY_DRAFTS.map((d, i) => (
            <button
              key={d.label}
              onClick={() => pick(i)}
              aria-label={d.label}
              className={`w-2 h-2 rounded-full transition ${
                i === idx ? 'bg-sky-400' : 'bg-slate-700'
              }`}
            />
          ))}
        </div>
        <button
          onClick={() => pick((idx + 1) % REPLY_DRAFTS.length)}
          className="flex items-center gap-0.5 text-[11px] text-slate-400 px-2 py-1.5 rounded-lg border border-slate-700 active:bg-slate-800"
        >
          下一条 <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 修改区 */}
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setCopied(false);
        }}
        rows={5}
        maxLength={500}
        placeholder="选中草稿后可在这里修改…"
        className="w-full bg-slate-900/80 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-sky-400 resize-none leading-relaxed"
      />

      <button
        onClick={copy}
        disabled={!text.trim()}
        className="w-full bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? '已复制，去粘贴吧' : '复制这条回复'}
      </button>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        复制后去娱乐页许愿池，点对应留言下的「回复」粘贴发布。草稿不会自动发出，发哪条、发不发都由你亲手决定。
      </p>
    </div>
  );
}

/* ---------------- 市场扫描 ---------------- */

/**
 * 手动触发全市场扫描：每天收盘后有定时任务自动跑，
 * 这里是手动补跑/立即刷新用。分片循环调用直到 done。
 */
function ScanPane() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  async function run() {
    setRunning(true);
    setResult('');
    setError('');
    setProgress('开始…');
    try {
      const { data } = await supabase!.auth.getSession();
      const tk = data.session?.access_token ?? '';
      let offset = 0;
      let total = 0;
      let scanned = 0;
      for (;;) {
        const res = await fetch('/api/admin/market-scan', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            Authorization: `Bearer ${tk}`,
          },
          body: JSON.stringify({ offset, limit: 8 }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.ok) throw new Error((j && j.error) || `扫描失败（${res.status}）`);
        total = j.total;
        scanned += j.scanned;
        offset += j.limit;
        setProgress(`已扫 ${scanned}/${total} 只…`);
        if (j.done) break;
        await new Promise((r) => setTimeout(r, 1200));
      }
      setProgress('');
      setResult(`✓ 扫描完成，共 ${scanned}/${total} 只，首页「今日信号」已更新`);
    } catch (e) {
      setProgress('');
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-400 leading-relaxed">
        每天美股收盘后自动扫描精选池（律动分/信号/涨跌/昨日估算资金流），
        结果供首页「今日信号」和盘前盘后两报使用。这里可手动立即跑一次。
      </p>
      {progress && <p className="text-xs text-sky-300 text-center py-2">{progress}</p>}
      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-300 leading-relaxed">
          {result}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-300 leading-relaxed break-words">
          {error}
        </div>
      )}
      <button
        onClick={run}
        disabled={running}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition"
      >
        <Play className="w-4 h-4" />
        {running ? '扫描中…' : '运行一次全市场扫描'}
      </button>
      <p className="text-[11px] text-slate-500 leading-relaxed">
        约 200 只股票，分片依次扫描，需要几分钟，请勿关闭弹窗。
      </p>
    </div>
  );
}
