'use client';

/**
 * 券商截图批量导入：在记忆页选多张交易历史截图 -> Gemini vision 识别
 * -> 预览勾选 -> 批量记入操作记录，并按日期从旧到新同步到持仓（买入加权成本，卖出扣减股数）。
 * 已存在于操作记录的交易自动去重（不重复记）。
 * 例外：已存在、但从未同步到持仓的记录会单独标出（「已存在 · 未同步到持仓」），
 * 勾选后只补同步、不重复记账——流水与持仓是两本账，去重不能默认"已同步"。
 */
import { useRef, useState } from 'react';
import { Camera, CheckCircle2, Loader2, XCircle, Upload } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tx } from '@/lib/hant';
import { loadOperations } from '@/lib/operations';
import { saveOperationAndSync, applyOperationToPositions, lastSyncAt, markSynced } from '@/lib/positions';

interface ScannedOp {
  date: string;
  symbol: string;
  action: 'buy' | 'sell';
  qty: number;
  price: number;
  checked: boolean;
  dup: boolean;
  /** 已存在、且同步日志里没有它的同步记录：可勾选只补同步，不重复记账 */
  dupUnsynced?: boolean;
  /** 已存在时对应操作记录的 id（补同步用） */
  dupOpId?: string;
}

type Phase = 'idle' | 'working' | 'preview' | 'done';

const CHUNK = 4;
const REQUEST_TIMEOUT_MS = 55000;

/**
 * 永远不把原生错误英文直接甩给用户。
 * 背景：iOS Safari 的 Response.json() 解析失败时抛的是
 * "The string did not match the expected pattern."（Chrome 会说 Unexpected token），
 * 根因通常是服务端超时/413 返回了 HTML 错误页。
 */
function friendlyError(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return '识别超时了：试试一次少选几张图片，或等网络好一点再试。';
  }
  if (e instanceof Error) {
    const m = e.message || '';
    if (e.name === 'SyntaxError' || /did not match the expected pattern/i.test(m)) {
      return '网络返回异常（可能是识别超时），请重试；如果反复出现，试试一次只选 1–2 张。';
    }
    if (/failed to fetch|load failed|networkerror/i.test(m)) {
      return '网络连接失败，请检查网络后重试。';
    }
    // 服务端已做过友好化，直接透出（都是中文短句）
    return m;
  }
  return '识别失败，请重试。';
}

async function compressImage(file: File): Promise<{ data: string; mimeType: string }> {
  const bitmap = await createImageBitmap(file);
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 不可用');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.82));
  if (!blob) throw new Error('图片压缩失败');
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CH)) as number[]);
  }
  return { data: btoa(binary), mimeType: 'image/jpeg' };
}

const dupKey = (o: { symbol: string; date: string; action: string; qty: number; price: number }) =>
  `${o.symbol}|${o.date}|${o.action}|${o.qty}|${o.price}`;

export default function ScreenshotImport({ onImported }: { onImported: () => void }) {
  const { lang } = useLanguage();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState('');
  const [ops, setOps] = useState<ScannedOp[]>([]);
  const [error, setError] = useState('');
  const [notices, setNotices] = useState<string[]>([]);
  const [result, setResult] = useState('');

  const startPick = () => {
    setError('');
    setNotices([]);
    setResult('');
    fileRef.current?.click();
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setPhase('working');
    setError('');
    setNotices([]);
    setOps([]);
    try {
      const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (list.length === 0) throw new Error(tx(lang, 'No images selected', '没有选中图片'));
      setProgress(tx(lang, `Compressing ${list.length} images…`, `压缩 ${list.length} 张图片…`));
      const compressed = [];
      for (const f of list) compressed.push(await compressImage(f));

      const all: ScannedOp[] = [];
      const failedBatches: number[] = [];
      const allNotices: string[] = [];
      for (let i = 0; i < compressed.length; i += CHUNK) {
        const chunk = compressed.slice(i, i + CHUNK);
        // 单批 payload 过大（Vercel 请求体上限）时提前拦下，给明确指引而不是等 413
        const payloadBytes = chunk.reduce((n, c) => n + c.data.length, 0);
        if (payloadBytes > 3_000_000) {
          throw new Error(
            tx(
              lang,
              'Images too large — pick fewer at a time',
              '图片太大：一次少选几张再试（建议一次 2 张）',
            ),
          );
        }
        setProgress(
          tx(
            lang,
            `Recognizing ${Math.min(i + CHUNK, compressed.length)}/${compressed.length}…`,
            `识别中 ${Math.min(i + CHUNK, compressed.length)}/${compressed.length}…`,
          ),
        );
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
        let j: any;
        try {
          const res = await fetch('/api/operations/import-scan', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ images: chunk }),
            signal: ctrl.signal,
          });
          if (!res.ok) {
            // 先尝试读 JSON 错误体（no_key / too_many 这类业务错误）
            let bj: any = null;
            try {
              bj = await res.json();
            } catch {
              /* HTML 错误页，走友好映射 */
            }
            if (bj && bj.ok === false) {
              if (bj.error === 'no_key') throw new Error(bj.message);
              throw new Error(bj.message || tx(lang, 'Recognition failed', '识别失败'));
            }
            throw new Error(
              tx(lang, `Server busy (HTTP ${res.status}) — try again`, `服务器忙（${res.status}），请重试`),
            );
          }
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) {
            throw new Error(tx(lang, 'Bad server response — try again', '服务器返回异常，请重试'));
          }
          try {
            j = await res.json();
          } catch (e) {
            throw e instanceof DOMException ? e : new Error('json_parse_failed');
          }
        } finally {
          clearTimeout(timer);
        }
        if (!j.ok) {
          if (j.error === 'no_key') throw new Error(j.message);
          throw new Error(j.message || tx(lang, 'Recognition failed', '识别失败'));
        }
        for (const o of j.operations || []) {
          all.push({ ...o, checked: true, dup: false });
        }
        for (const n of j.notices || []) {
          if (typeof n === 'string' && n && !allNotices.includes(n)) allNotices.push(n);
        }
        if (j.failed && j.failed.length > 0) failedBatches.push(i / CHUNK + 1);
      }
      setNotices(allNotices);
      if (all.length === 0) {
        if (allNotices.length > 0) {
          // 识别成功但无交易（截图不是 History 页）：只展示指引，不抛错
          setPhase('idle');
          return;
        }
        throw new Error(
          tx(lang, 'No trades recognized — try clearer screenshots', '没识别出交易记录，换更清晰的截图试试'),
        );
      }
      // 去重：跟已有操作记录比。注意"记录已存在"不等于"已同步到持仓"——
      // 流水和持仓是两本账，一条记录可能只进了流水、从未动过持仓。
      // 这种记录单独标出，可勾选只补同步（不重复记账）。
      const existingByKey = new Map<string, string>();
      for (const r of loadOperations()) {
        existingByKey.set(
          dupKey({
            symbol: r.symbol,
            date: r.date,
            action: r.action,
            qty: r.qty ?? 0,
            price: r.price,
          }),
          r.id,
        );
      }
      const seen = new Set<string>();
      for (const o of all) {
        const k = dupKey(o);
        const exId = existingByKey.get(k);
        if (exId !== undefined) {
          o.dup = true;
          o.checked = false;
          o.dupOpId = exId;
          // 只有第一次出现才可补同步；同一批里重复出现的是纯重复。
          // lastSyncAt 为空也可能是同步日志被裁剪（只留最近 200 条）的老记录，
          // 所以补同步默认不勾选，由用户逐笔确认。
          if (!seen.has(k) && lastSyncAt(exId) === null) o.dupUnsynced = true;
        } else if (seen.has(k)) {
          o.dup = true;
          o.checked = false;
        }
        seen.add(k);
      }
      // 按日期倒序
      all.sort((a, b) => b.date.localeCompare(a.date));
      setOps(all);
      setPhase('preview');
      if (failedBatches.length > 0) {
        setError(
          tx(
            lang,
            `Batch ${failedBatches.join(',')} partially failed — some images skipped`,
            `第 ${failedBatches.join('、')} 批部分失败，有图片被跳过`,
          ),
        );
      }
    } catch (e) {
      setError(friendlyError(e));
      setPhase('idle');
    }
  };

  const toggle = (i: number) => {
    setOps((prev) => prev.map((o, idx) => (idx === i ? { ...o, checked: !o.checked } : o)));
  };

  const confirmImport = () => {
    // 按日期从旧到新同步：同一只股票先买后卖，卖出才不会因持仓不足失败。
    // 未同步的重复记录（dupUnsynced）只补同步、不重复记账。
    const picked = ops
      .filter((o) => o.checked && (!o.dup || o.dupUnsynced))
      .sort((a, b) => a.date.localeCompare(b.date));
    const synced: string[] = [];
    const resynced: string[] = [];
    const failed: string[] = [];
    for (const o of picked) {
      if (o.dup && o.dupUnsynced && o.dupOpId) {
        const r = applyOperationToPositions({
          symbol: o.symbol,
          action: o.action,
          price: o.price,
          qty: o.qty,
          date: o.date,
        });
        if (r.ok) {
          markSynced(o.dupOpId);
          resynced.push(r.msg);
        } else {
          failed.push(r.msg);
        }
        continue;
      }
      const { syncMsg, syncOk } = saveOperationAndSync({
        symbol: o.symbol,
        action: o.action,
        price: o.price,
        qty: o.qty,
        date: o.date,
        source: 'import',
        thesis: tx(lang, 'Imported from brokerage screenshot', '券商截图导入'),
      });
      if (syncMsg) (syncOk ? synced : failed).push(syncMsg);
    }
    onImported();
    const importedCount = picked.filter((o) => !o.dup).length;
    const syncLine =
      synced.length > 0
        ? tx(lang, `Holdings synced: ${synced.join('；')}`, `持仓已同步：${synced.join('；')}`)
        : '';
    const resyncLine =
      resynced.length > 0
        ? tx(
            lang,
            `Resynced ${resynced.length}: ${resynced.join('；')}`,
            `补同步 ${resynced.length} 笔：${resynced.join('；')}`,
          )
        : '';
    const failLine =
      failed.length > 0
        ? tx(
            lang,
            `${failed.length} could not sync to holdings: ${failed.join('；')} — tap "Sync to holdings" on the entry in Memory to retry.`,
            `${failed.length} 笔没能同步到持仓：${failed.join('；')}——可去记忆页点这条记录下的「同步到持仓」再试。`,
          )
        : '';
    const inner = [syncLine, resyncLine].filter(Boolean).join('；');
    const head =
      importedCount > 0
        ? tx(lang, `Imported ${importedCount} trades ✓`, `已导入 ${importedCount} 笔 ✓`)
        : tx(lang, 'Nothing new to import ✓', '没有新交易导入 ✓');
    setResult(
      tx(
        lang,
        `${head}${inner ? ` (${inner})` : ''}${failLine ? ` ${failLine}` : ''}`,
        `${head}${inner ? `（${inner}）` : ''}${failLine ? ` ${failLine}` : ''}`,
      ),
    );
    setPhase('done');
    setOps([]);
  };

  const reset = () => {
    setPhase('idle');
    setOps([]);
    setError('');
    setNotices([]);
    setResult('');
    setProgress('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Camera className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-semibold text-slate-100">
          {tx(lang, 'Import from screenshots', '截图导入')}
        </span>
        <span className="text-[10px] text-slate-500">
          {tx(lang, 'Webull / brokerage history', '券商 History 截图')}
        </span>
      </div>

      {phase === 'idle' && (
        <>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {tx(
              lang,
              'Pick your brokerage history screenshots — trades are recognized, you review, then import. Journal/transfer rows are skipped automatically.',
              '选券商 History 截图——自动识别交易，你过目后再导入。Journal 转仓、资金划转会自动跳过。',
            )}
          </p>
          <button
            onClick={startPick}
            className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> {tx(lang, 'Pick screenshots', '选择截图（可多选）')}
          </button>
        </>
      )}

      {phase === 'working' && (
        <div className="flex items-center gap-2 py-3 justify-center">
          <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
          <span className="text-xs text-slate-300">{progress}</span>
        </div>
      )}

      {phase === 'preview' && (
        <>
          <p className="text-[11px] text-slate-400">
            {tx(
              lang,
              `Recognized ${ops.length} — uncheck anything wrong, then import:`,
              `识别出 ${ops.length} 笔——不对的取消勾选，确认后导入：`,
            )}
          </p>
          {ops.some((o) => o.dupUnsynced) && (
            <p className="text-[11px] text-amber-300 leading-relaxed">
              {tx(
                lang,
                'Some entries already exist but were never synced to holdings — check them to sync only, without duplicating the journal.',
                '有几笔记录已存在、但从未同步到持仓——勾选可只补同步，不会重复记账。',
              )}
            </p>
          )}
          <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-800">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-800">
                <tr className="text-slate-400">
                  <th className="py-1.5 px-2 text-left w-8"></th>
                  <th className="py-1.5 px-1 text-left">{tx(lang, 'Date', '日期')}</th>
                  <th className="py-1.5 px-1 text-left">{tx(lang, 'Sym', '代码')}</th>
                  <th className="py-1.5 px-1 text-left">{tx(lang, 'Side', '方向')}</th>
                  <th className="py-1.5 px-1 text-right">{tx(lang, 'Qty', '数量')}</th>
                  <th className="py-1.5 px-1 text-right">{tx(lang, 'Price', '价格')}</th>
                </tr>
              </thead>
              <tbody>
                {ops.map((o, i) => (
                  <tr
                    key={i}
                    className={`border-t border-slate-800 ${
                      o.dupUnsynced ? 'bg-amber-950/40' : o.dup ? 'opacity-40' : ''
                    }`}
                  >
                    <td className="py-1.5 px-2">
                      <input
                        type="checkbox"
                        checked={o.checked}
                        disabled={o.dup && !o.dupUnsynced}
                        onChange={() => toggle(i)}
                        className="w-3.5 h-3.5 accent-emerald-500"
                      />
                    </td>
                    <td className="py-1.5 px-1 text-slate-300 tabular-nums">{o.date.slice(5)}</td>
                    <td className="py-1.5 px-1 text-slate-100 font-semibold">{o.symbol}</td>
                    <td className={`py-1.5 px-1 ${o.action === 'buy' ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {o.action === 'buy' ? tx(lang, 'Buy', '买入') : tx(lang, 'Sell', '卖出')}
                      {o.dup && (
                        <span className="text-slate-500"> · {tx(lang, 'dup', '已存在')}</span>
                      )}
                      {o.dupUnsynced && (
                        <span className="text-amber-300">
                          {' '}
                          · {tx(lang, 'not synced to holdings', '未同步到持仓')}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-1 text-right text-slate-300 tabular-nums">{o.qty}</td>
                    <td className="py-1.5 px-1 text-right text-slate-300 tabular-nums">${o.price}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" /> {tx(lang, 'Cancel', '取消')}
            </button>
            <button
              onClick={confirmImport}
              disabled={!ops.some((o) => o.checked && (!o.dup || o.dupUnsynced))}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs py-2 rounded-lg font-medium flex items-center justify-center gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />{' '}
              {tx(lang, 'Import selected', '导入选中')} (
              {ops.filter((o) => o.checked && (!o.dup || o.dupUnsynced)).length})
            </button>
          </div>
        </>
      )}

      {phase === 'done' && (
        <div className="flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <p className="flex-1 text-xs text-slate-200 leading-relaxed">{result}</p>
          <button onClick={reset} className="text-[11px] text-sky-400 font-medium shrink-0">
            {tx(lang, 'Import more', '继续导入')}
          </button>
        </div>
      )}

      {error && phase !== 'working' && (
        <p className="text-[11px] text-amber-300 leading-relaxed">⚠️ {error}</p>
      )}

      {notices.length > 0 && phase !== 'working' && (
        <div className="space-y-2">
          {notices.map((n, i) => (
            <p key={i} className="text-[11px] text-sky-300 leading-relaxed bg-sky-950/60 border border-sky-800 rounded-lg p-2">
              💡 {n}
            </p>
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
