'use client';

import React, { useEffect, useState } from 'react';
import { X, Database, Play, CheckCircle2, CircleDashed, AlertTriangle } from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

/** 站长专属：数据库迁移一键执行弹窗 */
export default function AdminMigrateModal({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(true);
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
    try {
      const res = await fetch('/api/admin/migrate', {
        headers: { Authorization: `Bearer ${await token()}` },
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '读取失败');
      setConfigured(j.configured !== false);
      setHint(j.hint || '');
      setList(j.migrations || []);
    } catch (e) {
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
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || '执行失败');
      setResults(j.results || []);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  const pending = list.filter((m) => m.applied === false).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-slate-100 font-semibold text-sm">
            <Database className="w-4 h-4 text-emerald-400" />
            数据库迁移
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 overflow-y-auto">
          {loading && <p className="text-slate-400 text-sm py-4 text-center">读取迁移状态…</p>}

          {!loading && !configured && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200 leading-relaxed">
              <div className="font-semibold mb-1 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> 还差一步配置
              </div>
              {hint || '服务端未配置数据库连接串。'}
            </div>
          )}

          {!loading && configured && (
            <>
              <div className="space-y-1.5 mb-3">
                {list.map((m) => (
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
              </div>

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

              {error && <p className="text-red-400 text-xs mb-3 break-words">{error}</p>}

              <button
                onClick={run}
                disabled={running || pending === 0}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-semibold rounded-xl py-2.5 flex items-center justify-center gap-2 active:scale-[0.98] transition"
              >
                <Play className="w-4 h-4" />
                {running ? '执行中…' : pending === 0 ? '全部已是最新' : `一键运行（${pending} 条待执行）`}
              </button>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                只执行仓库自带的迁移脚本，按顺序逐条跑，出错即停。每条成功后会记账，下次不再重复跑。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
